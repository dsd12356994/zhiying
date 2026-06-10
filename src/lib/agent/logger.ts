import type { AgentProvider } from "./llmAgent";

export interface AgentLogEntry {
  id: string;
  ts: number;
  userInput: string;
  provider: AgentProvider | "fallback-mock";
  toolName: string;
  params: Record<string, unknown>;
  ok: boolean;
  message: string;
  elapsedMs: number;
}

const LOG_KEY = "zhiying.agent.logs.v1";
const MAX_LOGS = 400;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`;
}

function readLogs(): AgentLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AgentLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLogs(logs: AgentLogEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-MAX_LOGS)));
  } catch {
    // ignore quota/storage errors
  }
}

export function logAgentExecution(entry: Omit<AgentLogEntry, "id" | "ts">) {
  const logs = readLogs();
  logs.push({
    id: `agent-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    ...entry,
  });
  writeLogs(logs);
}

export function getAgentLogs(): AgentLogEntry[] {
  return readLogs();
}

export function getAgentMetrics() {
  const logs = readLogs();
  if (!logs.length) {
    return { total: 0, successRate: 0, avgElapsedMs: 0, failed: 0 };
  }
  const success = logs.filter((l) => l.ok).length;
  const totalElapsed = logs.reduce((sum, l) => sum + l.elapsedMs, 0);
  return {
    total: logs.length,
    successRate: success / logs.length,
    avgElapsedMs: totalElapsed / logs.length,
    failed: logs.length - success,
  };
}

export function getToolCallSuccessScore(
  toolName: string,
  params: Record<string, unknown>
): { score: number; samples: number } {
  const logs = readLogs();
  if (!logs.length) return { score: 0.5, samples: 0 };

  const paramsSig = stableStringify(params);
  const exact = logs.filter(
    (l) => l.toolName === toolName && stableStringify(l.params) === paramsSig
  );
  if (exact.length >= 2) {
    const success = exact.filter((l) => l.ok).length;
    return { score: success / exact.length, samples: exact.length };
  }

  const byTool = logs.filter((l) => l.toolName === toolName);
  if (!byTool.length) return { score: 0.5, samples: 0 };
  const success = byTool.filter((l) => l.ok).length;
  return { score: success / byTool.length, samples: byTool.length };
}
