"use client";

import { useCallback, useRef } from "react";
import { WalletButton } from "@/components/WalletButton";
import { TaskList } from "@/components/TaskList";
import { PostTaskForm } from "@/components/PostTaskForm";

export default function Home() {
  const listRef = useRef<{ refetch?: () => void }>({});

  const handlePosted = useCallback(() => {
    // small delay so the chain has time to index
    setTimeout(() => {
      (document.getElementById("task-list-refresh") as HTMLButtonElement | null)?.click();
    }, 3000);
  }, []);

  return (
    <div>
      <div className="flex justify-end mb-6">
        <WalletButton />
      </div>

      <div className="mb-8">
        <p className="text-gray-600 text-sm mb-6">
          Post a task with a USDC reward — an AI agent running on Arc Testnet will
          claim it, complete it with Gemini AI, and be paid automatically on-chain.
        </p>
        <PostTaskForm onPosted={handlePosted} />
      </div>

      <TaskList />
    </div>
  );
}
