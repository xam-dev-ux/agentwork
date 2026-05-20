/**
 * deploy.ts — compila y despliega AgentWork.sol en Arc Testnet.
 * La clave privada solo se usa para firmar la tx localmente, nunca sale del proceso.
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
// @ts-ignore
import solc from "solc";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ARC_TESTNET = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
} as const;

function compile() {
  const source = readFileSync(join(ROOT, "contracts", "AgentWork.sol"), "utf8");
  const input  = JSON.stringify({
    language: "Solidity",
    sources:  { "AgentWork.sol": { content: source } },
    settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } },
  });
  const out = JSON.parse(solc.compile(input));
  const errors = (out.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e: { formattedMessage: string }) => e.formattedMessage).join("\n"));
  const contract = out.contracts["AgentWork.sol"]["AgentWork"];
  return { abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}` as `0x${string}` };
}

async function main() {
  const pk          = process.env.PRIVATE_KEY;
  const usdcAddress = process.env.USDC_ADDRESS as `0x${string}`;
  if (!pk)          throw new Error("PRIVATE_KEY no está en .env");
  if (!usdcAddress) throw new Error("USDC_ADDRESS no está en .env");

  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
  const wallet  = createWalletClient({ account, chain: ARC_TESTNET, transport: http() });
  const pub     = createPublicClient({ chain: ARC_TESTNET, transport: http() });

  console.log("Compilando AgentWork.sol...");
  const { abi, bytecode } = compile();
  console.log("✓ Compilado");

  console.log(`Desplegando desde: ${account.address}`);
  const hash = await wallet.deployContract({ abi, bytecode, args: [usdcAddress] });
  console.log(`Tx enviada: ${hash}`);

  const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== "success") throw new Error("Transacción revertida");

  console.log(`\n✓ AgentWork desplegado en: ${receipt.contractAddress}`);
  console.log(`  Explorer: https://testnet.arcscan.app/address/${receipt.contractAddress}`);
  console.log(`\n  Añade a tus .env:`);
  console.log(`  AGENT_WORK_ADDRESS=${receipt.contractAddress}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
