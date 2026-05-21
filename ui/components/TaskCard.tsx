"use client";

import { useState, useEffect, useRef } from "react";
import { Task, TASK_STATE, STATE_COLORS, AGENT_ADDRESS, AGENT_URL } from "@/lib/contract";
import { formatUnits } from "viem";

type ExecStatus = "idle" | "processing" | "done" | "error";

interface AgentStatus {
  status:  ExecStatus;
  result?: string;
  error?:  string;
}

type Props = { task: Task; onCompleted?: () => void };

export function TaskCard({ task, onCompleted }: Props) {
  const reward     = formatUnits(task.reward, 6);
  const stateLabel = TASK_STATE[task.state] ?? "Unknown";
  const stateClass = STATE_COLORS[task.state] ?? "bg-gray-100 text-gray-600";
  const posted     = new Date(Number(task.createdAt) * 1000).toLocaleString();

  const [exec, setExec]     = useState<AgentStatus>({ status: "idle" });
  const pollRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  const taskId = task.id.toString();

  const isOpen        = task.state === 0;
  const isClaimedByMe =
    task.state === 1 &&
    task.agent.toLowerCase() === AGENT_ADDRESS.toLowerCase();
  const canExecute = isOpen || isClaimedByMe;

  // Poll /status/:id while processing
  useEffect(() => {
    if (exec.status !== "processing") {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${AGENT_URL}/status/${taskId}`);
        const data: AgentStatus = await r.json();
        if (data.status !== "processing") {
          setExec(data);
          if (data.status === "done" && onCompleted) onCompleted();
        }
      } catch { /* network hiccup, keep polling */ }
    }, 2_000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [exec.status, taskId, onCompleted]);

  async function handleExecute() {
    setExec({ status: "processing" });
    try {
      const r = await fetch(`${AGENT_URL}/execute/${taskId}`, { method: "POST" });
      const data: AgentStatus = await r.json();
      if (data.status === "error") {
        setExec(data);
      }
      // if "processing", useEffect starts polling
    } catch (e) {
      setExec({ status: "error", error: e instanceof Error ? e.message : "Network error" });
    }
  }

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-400 mb-1">Task #{taskId}</p>
          <p className="font-medium break-words">{task.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-lg font-bold text-indigo-600">{reward} USDC</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateClass}`}>
            {stateLabel}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-3 text-xs text-gray-400 flex flex-wrap gap-x-4">
        <span>Posted: {posted}</span>
        {task.agent !== "0x0000000000000000000000000000000000000000" && (
          <span>Agent: {task.agent.slice(0, 6)}…{task.agent.slice(-4)}</span>
        )}
      </div>

      {/* On-chain result (Completed state) */}
      {task.result && (
        <div className="mt-3 rounded-lg bg-green-50 border border-green-100 p-3">
          <p className="text-xs font-medium text-green-700 mb-1">Result (on-chain)</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.result}</p>
        </div>
      )}

      {/* Execute button */}
      {canExecute && (
        <div className="mt-4">
          <button
            onClick={handleExecute}
            disabled={exec.status === "processing"}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {exec.status === "processing" ? (
              <>
                <Spinner />
                Ejecutando…
              </>
            ) : isClaimedByMe ? "Reintentar ejecución" : "Ejecutar con Gemini"}
          </button>
        </div>
      )}

      {/* Agent execution status */}
      {exec.status === "processing" && (
        <div className="mt-3 rounded-lg bg-yellow-50 border border-yellow-100 p-3 flex items-center gap-2">
          <Spinner className="text-yellow-600" />
          <p className="text-sm text-yellow-800">El agente está procesando la tarea…</p>
        </div>
      )}

      {exec.status === "error" && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-xs font-medium text-red-700 mb-1">Error del agente</p>
          <p className="text-sm text-red-600 break-words">{exec.error}</p>
        </div>
      )}

      {exec.status === "done" && exec.result && (
        <div className="mt-3 rounded-lg bg-indigo-50 border border-indigo-100 p-3">
          <p className="text-xs font-medium text-indigo-700 mb-1">Resultado del agente (pendiente confirmación on-chain)</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{exec.result}</p>
        </div>
      )}
    </div>
  );
}

function Spinner({ className = "text-white" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      fill="none" viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
