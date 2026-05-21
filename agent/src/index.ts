/**
 * AgentWork Agent — expone endpoints REST para ejecutar tareas bajo demanda.
 * La ejecución ya NO es automática: la UI dispara POST /execute/:taskId.
 *
 * SEGURIDAD: AGENT_PRIVATE_KEY solo se usa para firmar transacciones localmente.
 * Nunca se loguea, nunca sale del proceso.
 */
import express from "express";
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import Anthropic from "@anthropic-ai/sdk";

// ── Config ────────────────────────────────────────────────────────────────────

const AGENT_WORK_ADDRESS = process.env.AGENT_WORK_ADDRESS as `0x${string}`;
const POLL_INTERVAL_MS   = 30_000;

for (const v of ["AGENT_PRIVATE_KEY", "AGENT_WORK_ADDRESS", "ANTHROPIC_API_KEY"]) {
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

// ── ABI ───────────────────────────────────────────────────────────────────────

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

// ── Claude (Anthropic) ────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function executeTask(description: string): Promise<string> {
  const message = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{
      role:    "user",
      content: `Eres un agente de trabajo autónomo. Completa la siguiente tarea de forma concisa y útil:\n\n${description}`,
    }],
  });
  const block = message.content[0];
  if (block.type !== "text") throw new Error("Respuesta inesperada de Claude");
  return block.text.trim();
}

// ── Estado de ejecuciones en curso ────────────────────────────────────────────

interface ExecStatus {
  status:       "processing" | "done" | "error";
  result?:      string;
  error?:       string;
  startedAt:    number;
  completedAt?: number;
}

const processing   = new Set<bigint>();
const taskStatuses = new Map<string, ExecStatus>();

// ── Helper: leer una tarea del contrato ───────────────────────────────────────

async function getTask(taskId: bigint) {
  const tasks = await pub.readContract({
    address: AGENT_WORK_ADDRESS,
    abi:     ABI,
    functionName: "getAllTasks",
  });
  return tasks.find((t) => t.id === taskId) ?? null;
}

// ── Express ───────────────────────────────────────────────────────────────────

const app  = express();
const PORT = process.env.PORT ?? 3001;

// CORS — permite llamadas desde la UI en Vercel
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});
app.options("*", (_req, res) => { res.sendStatus(200); });

// ── Health / metadata ─────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", agent: account.address, uptime: process.uptime(), time: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.json({ name: "AgentWork Agent", agent: account.address });
});

app.get("/metadata", (_req, res) => {
  const selfUrl = process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${PORT}`;
  res.json({
    name:        "AgentWork AI Agent",
    description: "Autonomous AI agent that claims on-chain tasks, executes them with Gemini AI, and self-pays in USDC on Arc Testnet.",
    version:     "1.0.0",
    image:       "",
    endpoints: [{ protocol: "http", url: `${selfUrl}/health` }],
    skills: [{ name: "execute_task", description: "Executes a natural language task using Claude AI and submits the result on-chain." }],
    payment: { currency: "USDC", network: "Arc Testnet", address: account.address },
  });
});

// ── POST /execute/:taskId — lanza la ejecución y devuelve inmediatamente ──────

app.post("/execute/:taskId", async (req, res) => {
  let taskId: bigint;
  try { taskId = BigInt(req.params.taskId); }
  catch { res.status(400).json({ status: "error", error: "Invalid taskId" }); return; }

  const key = taskId.toString();

  // Si ya está en proceso, devolver estado actual
  if (processing.has(taskId)) {
    res.json(taskStatuses.get(key) ?? { status: "processing" });
    return;
  }

  // Leer estado actual del contrato
  let task: Awaited<ReturnType<typeof getTask>>;
  try { task = await getTask(taskId); }
  catch (e) {
    res.status(503).json({ status: "error", error: "No se pudo leer el contrato" });
    return;
  }

  if (!task) {
    res.status(404).json({ status: "error", error: `Tarea #${taskId} no encontrada` });
    return;
  }

  const isOpen     = task.state === TASK_STATE.OPEN;
  const isClaimedByMe =
    task.state === TASK_STATE.CLAIMED &&
    task.agent.toLowerCase() === account.address.toLowerCase();

  if (!isOpen && !isClaimedByMe) {
    res.status(400).json({
      status: "error",
      error:  `La tarea está en estado ${task.state} — solo se pueden ejecutar tareas Open o Claimed por este agente`,
    });
    return;
  }

  // Marcar como en proceso y responder de inmediato
  processing.add(taskId);
  taskStatuses.set(key, { status: "processing", startedAt: Date.now() });
  res.json({ status: "processing" });

  // Ejecutar de forma asíncrona
  void (async () => {
    const startedAt = taskStatuses.get(key)!.startedAt;
    try {
      // 1. Claim si está Open
      if (isOpen) {
        console.log(`→ Reclamando tarea #${taskId}: "${task!.description.slice(0, 60)}"`);
        const claimHash = await wallet.writeContract({
          address: AGENT_WORK_ADDRESS, abi: ABI, functionName: "claimTask", args: [taskId],
        });
        await pub.waitForTransactionReceipt({ hash: claimHash, timeout: 60_000 });
        console.log(`  ✓ Tarea #${taskId} reclamada`);
      } else {
        console.log(`→ Ejecutando tarea #${taskId} (ya reclamada): "${task!.description.slice(0, 60)}"`);
      }

      // 2. Gemini
      console.log(`  → Llamando a Gemini...`);
      const result = await executeTask(task!.description);
      console.log(`  ✓ Resultado (${result.length} chars)`);

      // 3. Submit result → pago automático on-chain
      const submitHash = await wallet.writeContract({
        address: AGENT_WORK_ADDRESS, abi: ABI, functionName: "submitResult",
        args: [taskId, result],
      });
      await pub.waitForTransactionReceipt({ hash: submitHash, timeout: 60_000 });
      console.log(`  ✓ Tarea #${taskId} completada. Tx: ${submitHash}`);

      taskStatuses.set(key, { status: "done", result, startedAt, completedAt: Date.now() });

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Error en tarea #${taskId}:`, error);
      taskStatuses.set(key, { status: "error", error, startedAt, completedAt: Date.now() });
    } finally {
      processing.delete(taskId);
    }
  })();
});

// ── GET /status/:taskId — estado actual de la ejecución ───────────────────────

app.get("/status/:taskId", (req, res) => {
  const status = taskStatuses.get(req.params.taskId);
  res.json(status ?? { status: "idle" });
});

// ── Arranque ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`AgentWork Agent corriendo en puerto ${PORT}`);
  console.log(`Agente wallet: ${account.address}`);
  console.log(`Contrato:      ${AGENT_WORK_ADDRESS}`);
  console.log(`Modo:          ejecución bajo demanda (POST /execute/:taskId)`);

  // Self-ping cada 14 min para que Render free tier no duerma el servicio
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    setInterval(() => { fetch(`${selfUrl}/health`).catch(() => {}); }, 14 * 60 * 1000);
    console.log(`Self-ping activo → ${selfUrl}/health`);
  }
});
