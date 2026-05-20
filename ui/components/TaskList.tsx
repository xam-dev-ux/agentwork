"use client";

import { useReadContract } from "wagmi";
import { AGENT_WORK_ADDRESS, AGENT_WORK_ABI, Task } from "@/lib/contract";
import { TaskCard } from "./TaskCard";

export function TaskList() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: AGENT_WORK_ADDRESS,
    abi: AGENT_WORK_ABI,
    functionName: "getAllTasks",
  });

  const tasks = (data as Task[] | undefined) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">All Tasks ({tasks.length})</h2>
        <button
          onClick={() => refetch()}
          className="text-sm text-indigo-600 hover:underline"
        >
          Refresh
        </button>
      </div>

      {isLoading && (
        <p className="text-gray-500 text-sm">Loading tasks…</p>
      )}

      {error && (
        <p className="text-red-600 text-sm">
          Error loading tasks. Check that NEXT_PUBLIC_AGENT_WORK_ADDRESS is set.
        </p>
      )}

      {!isLoading && tasks.length === 0 && (
        <p className="text-gray-500 text-sm">No tasks yet. Be the first to post one!</p>
      )}

      <div className="flex flex-col gap-3">
        {[...tasks].reverse().map((task) => (
          <TaskCard key={task.id.toString()} task={task} />
        ))}
      </div>
    </div>
  );
}
