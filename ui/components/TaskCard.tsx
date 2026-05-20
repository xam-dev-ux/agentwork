"use client";

import { Task, TASK_STATE, STATE_COLORS } from "@/lib/contract";
import { formatUnits } from "viem";

type Props = { task: Task };

export function TaskCard({ task }: Props) {
  const reward = formatUnits(task.reward, 6);
  const stateLabel = TASK_STATE[task.state] ?? "Unknown";
  const stateClass = STATE_COLORS[task.state] ?? "bg-gray-100 text-gray-600";
  const posted = new Date(Number(task.createdAt) * 1000).toLocaleString();

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-400 mb-1">Task #{task.id.toString()}</p>
          <p className="font-medium break-words">{task.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-lg font-bold text-indigo-600">{reward} USDC</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateClass}`}>
            {stateLabel}
          </span>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-400">
        <span>Posted: {posted}</span>
        {task.agent !== "0x0000000000000000000000000000000000000000" && (
          <span className="ml-4">
            Agent: {task.agent.slice(0, 6)}…{task.agent.slice(-4)}
          </span>
        )}
      </div>

      {task.result && (
        <div className="mt-3 rounded-lg bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Result</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.result}</p>
        </div>
      )}
    </div>
  );
}
