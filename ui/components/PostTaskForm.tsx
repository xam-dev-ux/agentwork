"use client";

import { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import {
  AGENT_WORK_ADDRESS,
  AGENT_WORK_ABI,
  USDC_ADDRESS,
  USDC_ABI,
} from "@/lib/contract";

export function PostTaskForm({ onPosted }: { onPosted?: () => void }) {
  const { isConnected } = useAccount();
  const [description, setDescription] = useState("");
  const [rewardUsdc, setRewardUsdc] = useState("0.10");
  const [step, setStep] = useState<"idle" | "approving" | "posting" | "done">("idle");
  const [error, setError] = useState("");

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!description.trim()) { setError("Description is required"); return; }
    if (!publicClient) { setError("Wallet not connected"); return; }

    const reward = parseUnits(rewardUsdc, 6);

    try {
      setStep("approving");
      const approveTx = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [AGENT_WORK_ADDRESS, reward],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx, timeout: 120_000 });

      setStep("posting");
      const postTx = await writeContractAsync({
        address: AGENT_WORK_ADDRESS,
        abi: AGENT_WORK_ABI,
        functionName: "postTask",
        args: [description.trim(), reward],
      });
      await publicClient.waitForTransactionReceipt({ hash: postTx, timeout: 120_000 });

      setStep("done");
      setDescription("");
      setRewardUsdc("0.10");
      onPosted?.();
      setTimeout(() => setStep("idle"), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setStep("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Post a Task</h2>

      {!isConnected && (
        <p className="text-sm text-amber-600 mb-4">Connect your wallet to post tasks.</p>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Task description</label>
        <textarea
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          rows={3}
          placeholder="Translate this text to Spanish: Hello world"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={step !== "idle"}
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Reward (USDC)</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          className="rounded-lg border px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={rewardUsdc}
          onChange={(e) => setRewardUsdc(e.target.value)}
          disabled={step !== "idle"}
        />
        <p className="text-xs text-gray-400 mt-1">
          USDC locked in contract, paid automatically to the agent.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {step === "done" && <p className="text-sm text-green-600 mb-3">Task posted!</p>}

      <button
        type="submit"
        disabled={!isConnected || step !== "idle"}
        className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {step === "approving" && "Approving USDC…"}
        {step === "posting"   && "Posting task…"}
        {step === "done"      && "Posted!"}
        {step === "idle"      && "Post Task"}
      </button>
    </form>
  );
}
