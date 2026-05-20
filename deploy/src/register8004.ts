/**
 * register8004.ts — Registra el agente AgentWork en el IdentityRegistry ERC-8004
 * de Arc Testnet para que aparezca en https://testnet.8004scan.io/
 *
 * Uso:
 *   RENDER_EXTERNAL_URL=https://tu-agente.onrender.com npx tsx src/register8004.ts
 *
 * La clave privada solo firma la tx localmente. Nunca sale del proceso.
 */
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ── Arc Testnet ────────────────────────────────────────────────────────────────

const ARC_TESTNET = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
} as const;

// ── ERC-8004 IdentityRegistry en Arc Testnet ──────────────────────────────────

const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;

const IDENTITY_ABI = parseAbi([
  "function register(string metadataURI) returns (uint256 agentId)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pk      = process.env.PRIVATE_KEY ?? process.env.AGENT_PRIVATE_KEY;
  const agentUrl = process.env.RENDER_EXTERNAL_URL;

  if (!pk)       throw new Error("Falta PRIVATE_KEY o AGENT_PRIVATE_KEY en .env");
  if (!agentUrl) throw new Error("Falta RENDER_EXTERNAL_URL (URL pública del agente en Render)");

  const metadataURI = `${agentUrl}/metadata`;

  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
  const wallet  = createWalletClient({ account, chain: ARC_TESTNET, transport: http() });
  const pub     = createPublicClient({ chain: ARC_TESTNET, transport: http() });

  console.log(`Registrando agente en ERC-8004 IdentityRegistry...`);
  console.log(`  Wallet:      ${account.address}`);
  console.log(`  MetadataURI: ${metadataURI}`);

  const hash = await wallet.writeContract({
    address:      IDENTITY_REGISTRY,
    abi:          IDENTITY_ABI,
    functionName: "register",
    args:         [metadataURI],
  });

  console.log(`  Tx enviada:  ${hash}`);
  console.log(`  Esperando confirmación...`);

  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error("Transacción revertida");

  // Extraer agentId del evento Transfer (tokenId = agentId)
  const transferLog = receipt.logs.find(
    (l) => l.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase()
  );
  const agentId = transferLog ? BigInt(transferLog.topics[3] ?? "0x0") : null;

  console.log(`\n✓ Agente registrado en ERC-8004`);
  if (agentId !== null) console.log(`  Agent ID:    ${agentId}`);
  console.log(`  Explorer:    https://testnet.8004scan.io/agents/${account.address}`);
  console.log(`  ArcScan tx:  https://testnet.arcscan.app/tx/${hash}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
