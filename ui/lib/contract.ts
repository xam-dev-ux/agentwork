import { parseAbi } from "viem";

export const AGENT_WORK_ADDRESS = (
  process.env.NEXT_PUBLIC_AGENT_WORK_ADDRESS ?? ""
) as `0x${string}`;

export const AGENT_ADDRESS = "0x63F3b112F491b667d50A94a2693dE3Ac2BF564cF" as `0x${string}`;
export const AGENT_URL     = process.env.NEXT_PUBLIC_AGENT_URL ?? "https://agentwork.onrender.com";

export const USDC_ADDRESS = (
  process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x3600000000000000000000000000000000000000"
) as `0x${string}`;

export const AGENT_WORK_ABI = parseAbi([
  "function postTask(string description, uint256 reward) returns (uint256)",
  "function claimTask(uint256 taskId)",
  "function submitResult(uint256 taskId, string result)",
  "function refund(uint256 taskId)",
  "function getAllTasks() view returns ((uint256 id, address poster, string description, uint256 reward, address agent, string result, uint8 state, uint256 createdAt, uint256 claimedAt)[])",
  "event TaskPosted(uint256 indexed taskId, address indexed poster, string description, uint256 reward)",
  "event TaskCompleted(uint256 indexed taskId, address indexed agent, string result)",
  "event TaskPaid(uint256 indexed taskId, address indexed agent, uint256 amount)",
]);

export const USDC_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export const TASK_STATE: Record<number, string> = {
  0: "Open",
  1: "Claimed",
  2: "Completed",
  3: "Refunded",
};

export const STATE_COLORS: Record<number, string> = {
  0: "bg-green-100 text-green-800",
  1: "bg-yellow-100 text-yellow-800",
  2: "bg-blue-100 text-blue-800",
  3: "bg-gray-100 text-gray-600",
};

export type Task = {
  id: bigint;
  poster: `0x${string}`;
  description: string;
  reward: bigint;
  agent: `0x${string}`;
  result: string;
  state: number;
  createdAt: bigint;
  claimedAt: bigint;
};
