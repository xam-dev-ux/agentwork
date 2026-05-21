/**
 * AgentWork Agent — monitoriza tareas abiertas en el contrato,
 * las ejecuta con Gemini (Google AI Studio free tier) y cobra en USDC.
 *
 * SEGURIDAD: AGENT_PRIVATE_KEY solo se usa para firmar transacciones localmente.
 * Nunca se loguea, nunca sale del proceso, solo se configura en Render como env var.
 *
 * Desplegado en Render free tier:
 *   - Expone /health para mantenerse activo
 *   - Self-ping cada 14 min para evitar que Render duerma el servicio
 *   - Polling cada 30 s buscando tareas abiertas
 */
import express from "express";
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Config ────────────────────────────────────────────────────────────────────

const AGENT_WORK_ADDRESS = process.env.AGENT_WORK_ADDRESS as `0x${string}`;
const USDC_ADDRESS       = (process.env.USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000") as `0x${string}`;
const POLL_INTERVAL_MS   = 30_000;

for (const v of ["AGENT_PRIVATE_KEY", "AGENT_WORK_ADDRESS", "GOOGLE_AI_KEY"]) {
  if (!process.env[v]) { console.error(`✗ ${v} no está en env`); process.exit(1); }
}

// ── Cadena Arc Testnet ────────────────────────────────────────────────────────

const ARC_TESTNET = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
} as const;

// ── ABI (solo las funciones que usa el agente) ────────────────────────────────

const ABI = parseAbi([
  "function getAllTasks() view returns ((uint256 id, address poster, string description, uint256 reward, address agent, string result, uint8 state, uint256 createdAt, uint256 claimedAt)[])",
  "function claimTask(uint256 taskId)",
  "function submitResult(uint256 taskId, string result)",
]);

const TASK_STATE = { OPEN: 0, CLAIMED: 1, COMPLETED: 2, REFUNDED: 3 };

// ── Clientes viem ─────────────────────────────────────────────────────────────

function makeClients() {
  const pk      = process.env.AGENT_PRIVATE_KEY!;
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
  const wallet  = createWalletClient({ account, chain: ARC_TESTNET, transport: http() });
  const pub     = createPublicClient({ chain: ARC_TESTNET, transport: http() });
  return { wallet, pub, account };
}

const { wallet, pub, account } = makeClients();

// ── Gemini (Google AI Studio) ─────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

async function executeTask(description: string): Promise<string> {
  const prompt = `Eres un agente de trabajo autónomo. Completa la siguiente tarea de forma concisa y útil:\n\n${description}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") && attempt < 5) {
        const wait = attempt * 15_000;
        console.log(`  ⏳ Gemini 429 — reintento ${attempt}/5 en ${wait/1000}s`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Gemini: máximo de reintentos alcanzado");
}

// ── Conjunto de tareas en proceso (evita reclamar la misma dos veces) ─────────

const processing = new Set<bigint>();

// ── Loop principal ────────────────────────────────────────────────────────────

async function processOpenTasks() {
  try {
    const tasks = await pub.readContract({
      address: AGENT_WORK_ADDRESS,
      abi:     ABI,
      functionName: "getAllTasks",
    });

    // Tareas abiertas que no son del propio agente y no están en proceso
    const openTasks = tasks.filter(
      (t) =>
        t.state === TASK_STATE.OPEN &&
        t.poster.toLowerCase() !== account.address.toLowerCase() &&
        !processing.has(t.id)
    );

    // Tareas que este agente reclamó pero cuyo submitResult no se completó (retry tras restart)
    const claimedByMe = tasks.filter(
      (t) =>
        t.state === TASK_STATE.CLAIMED &&
        t.agent.toLowerCase() === account.address.toLowerCase() &&
        !processing.has(t.id)
    );

    const toProcess = [...openTasks, ...claimedByMe];
    if (toProcess.length === 0) return;

    console.log(`[${new Date().toISOString()}] ${openTasks.length} abierta(s), ${claimedByMe.length} reclamada(s) pendiente(s)`);

    for (const task of toProcess) {
      processing.add(task.id);

      void (async () => {
        try {
          // 1. Claim solo si está Open (skip si ya está Claimed por nosotros)
          if (task.state === TASK_STATE.OPEN) {
            console.log(`→ Reclamando tarea #${task.id}: "${task.description.slice(0, 60)}"`);
            const claimHash = await wallet.writeContract({
              address: AGENT_WORK_ADDRESS, abi: ABI, functionName: "claimTask", args: [task.id],
            });
            await pub.waitForTransactionReceipt({ hash: claimHash, timeout: 60_000 });
            console.log(`  ✓ Tarea #${task.id} reclamada`);
          } else {
            console.log(`→ Retomando tarea #${task.id} (ya reclamada): "${task.description.slice(0, 60)}"`);
          }

          // 2. Ejecutar con Gemini
          console.log(`  → Ejecutando con Gemini...`);
          const result = await executeTask(task.description);
          console.log(`  ✓ Resultado (${result.length} chars)`);

          // 3. Submit result → pago automático on-chain
          const submitHash = await wallet.writeContract({
            address: AGENT_WORK_ADDRESS, abi: ABI, functionName: "submitResult",
            args: [task.id, result],
          });
          await pub.waitForTransactionReceipt({ hash: submitHash, timeout: 60_000 });
          console.log(`  ✓ Tarea #${task.id} completada y pagada`);
          console.log(`    https://testnet.arcscan.app/tx/${submitHash}`);

        } catch (err) {
          console.error(`  ✗ Error en tarea #${task.id}:`, err instanceof Error ? err.message : err);
        } finally {
          processing.delete(task.id);
        }
      })();
    }
  } catch (err) {
    console.error("Error en poll:", err instanceof Error ? err.message : err);
  }
}

// ── Express (health check + keep-alive) ──────────────────────────────────────

const app  = express();
const PORT = process.env.PORT ?? 3001;

app.get("/health", (_req, res) => {
  res.json({
    status:  "ok",
    agent:   account.address,
    uptime:  process.uptime(),
    time:    new Date().toISOString(),
  });
});

app.get("/", (_req, res) => {
  res.json({ name: "AgentWork Agent", agent: account.address });
});

// ERC-8004 metadata endpoint — usado por IdentityRegistry y 8004scan.io
app.get("/metadata", (_req, res) => {
  const selfUrl = process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${PORT}`;
  res.json({
    name:        "AgentWork AI Agent",
    description: "Autonomous AI agent that claims on-chain tasks, executes them with Gemini AI, and self-pays in USDC on Arc Testnet.",
    version:     "1.0.0",
    image:       "",
    endpoints: [
      { protocol: "http", url: `${selfUrl}/health` },
    ],
    skills: [
      {
        name:        "execute_task",
        description: "Executes a natural language task using Gemini AI and submits the result on-chain.",
      },
    ],
    payment: {
      currency: "USDC",
      network:  "Arc Testnet",
      address:  account.address,
    },
  });
});

app.listen(PORT, () => {
  console.log(`AgentWork Agent corriendo en puerto ${PORT}`);
  console.log(`Agente wallet: ${account.address}`);
  console.log(`Contrato:      ${AGENT_WORK_ADDRESS}`);
  console.log(`Polling cada   ${POLL_INTERVAL_MS / 1000}s`);

  // Arrancar polling
  setInterval(processOpenTasks, POLL_INTERVAL_MS);
  void processOpenTasks(); // primera ejecución inmediata

  // Self-ping cada 14 min para que Render free tier no duerma el servicio
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    setInterval(() => {
      fetch(`${selfUrl}/health`).catch(() => {});
    }, 14 * 60 * 1000);
    console.log(`Self-ping activo → ${selfUrl}/health`);
  }
});
