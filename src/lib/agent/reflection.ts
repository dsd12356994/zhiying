import type { AgentProvider, ToolExecutionObservation } from "./llmAgent";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const FAILURE_CASES_KEY = "zhiying.agent.failureCases.v1";
const MAX_FAILURE_CASES = 200;

interface ReflectionProviderConfig { apiUrl: string; apiKey: string; model: string }

function getReflectionProviderConfig(provider: AgentProvider): ReflectionProviderConfig | null {
  // Runtime config (localStorage) takes priority over env vars
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("zhiying.aiConfig.v1") : null;
    if (raw) {
      const cfg = JSON.parse(raw) as Record<string, Record<string, string> | undefined>;
      const pKey = provider as "openai" | "deepseek" | "claude";
      const p = cfg[pKey];
      if (p?.apiKey) {
        const defaultUrls: Record<string, string> = { openai: OPENAI_API_URL, deepseek: DEEPSEEK_API_URL, claude: CLAUDE_API_URL };
        const defaultModels: Record<string, string> = { openai: "gpt-4.1-mini", deepseek: "deepseek-chat", claude: "claude-sonnet-4-6" };
        return { apiKey: p.apiKey, model: p.model || defaultModels[pKey], apiUrl: p.apiUrl || defaultUrls[pKey] };
      }
    }
  } catch { /* ignore */ }

  if (provider === "openai") {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
    if (!apiKey) return null;
    return {
      apiUrl: (import.meta.env.VITE_OPENAI_API_URL as string | undefined) || OPENAI_API_URL,
      apiKey,
      model: (import.meta.env.VITE_OPENAI_MODEL as string | undefined) || "gpt-4.1-mini",
    };
  }
  if (provider === "deepseek") {
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
    if (!apiKey) return null;
    return {
      apiUrl: (import.meta.env.VITE_DEEPSEEK_API_URL as string | undefined) || DEEPSEEK_API_URL,
      apiKey,
      model: (import.meta.env.VITE_DEEPSEEK_MODEL as string | undefined) || "deepseek-chat",
    };
  }
  return null;
}

export interface FailureCase {
  id: string;
  ts: number;
  userInput: string;
  provider: AgentProvider | "fallback-mock";
  observations: ToolExecutionObservation[];
  reflection: string;
}

export interface RepairSuggestion {
  label: string;
  toolName: string;
  params: Record<string, unknown>;
  reason: string;
}

function readFailureCases(): FailureCase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAILURE_CASES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FailureCase[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFailureCases(cases: FailureCase[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      FAILURE_CASES_KEY,
      JSON.stringify(cases.slice(-MAX_FAILURE_CASES))
    );
  } catch {
    // ignore storage errors
  }
}

export function saveFailureCase(caseItem: Omit<FailureCase, "id" | "ts">) {
  const cases = readFailureCases();
  cases.push({
    id: `failure-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    ...caseItem,
  });
  writeFailureCases(cases);
}

export function getFailureCases(): FailureCase[] {
  return readFailureCases();
}

export async function reflectOnExecution(
  userInput: string,
  observations: ToolExecutionObservation[],
  provider: AgentProvider | "fallback-mock" = "mock"
): Promise<string> {
  const failed = observations.filter((o) => !o.ok);
  if (!failed.length) {
    return "执行成功，目标已达成。建议保持当前工具调用顺序。";
  }

  const fallback = `本次存在 ${failed.length} 个失败步骤。主要失败：${failed
    .map((f) => `${f.name}(${f.message})`)
    .join("；")}。建议检查参数范围、片段选择状态，并在必要时先分割再删除。`;

  if (provider !== "openai" && provider !== "deepseek" && provider !== "claude") return fallback;
  const config = getReflectionProviderConfig(provider);
  if (!config) return fallback;

  const systemPrompt = "你是视频编辑 Agent 的反思器。请分析失败原因并给出最多三条可执行修正建议，简洁中文。";
  const userContent = JSON.stringify({ userInput, observations });

  try {
    let response: Response;
    if (provider === "claude") {
      response = await fetch(config.apiUrl || CLAUDE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 256,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      });
      if (!response.ok) return fallback;
      const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
      return data.content?.find((b) => b.type === "text")?.text?.trim() || fallback;
    }

    response = await fetch(config.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export function buildRepairSuggestions(
  observations: ToolExecutionObservation[],
  reflection: string
): RepairSuggestion[] {
  const failed = observations.filter((o) => !o.ok);
  if (!failed.length) return [];

  const suggestions: RepairSuggestion[] = [];

  for (const obs of failed) {
    suggestions.push({
      label: `重试 ${obs.name}`,
      toolName: obs.name,
      params: obs.params,
      reason: obs.message,
    });

    if (obs.name === "splitClip") {
      suggestions.push({
        label: "改用 splitAtPlayhead",
        toolName: "splitAtPlayhead",
        params: {},
        reason: "分割时间点可能越界，尝试按播放头分割。",
      });
    } else if (obs.name === "trimClip") {
      const seconds =
        (typeof obs.params.time === "number" ? obs.params.time : undefined) ??
        (typeof obs.params.seconds === "number" ? obs.params.seconds : undefined);
      if (typeof seconds === "number") {
        suggestions.push({
          label: "改用 trimTo",
          toolName: "trimTo",
          params: { seconds },
          reason: "边缘裁剪失败时，先尝试高层 trimTo。",
        });
      }
    } else if (obs.name === "deleteClip") {
      suggestions.push({
        label: "删除当前选中片段",
        toolName: "deleteClip",
        params: { ripple: false },
        reason: "索引/ID 失败时，改为删除当前选中片段。",
      });
    } else if (obs.name === "moveClip") {
      if (typeof obs.params.start === "number") {
        suggestions.push({
          label: "仅移动时间，不改轨道",
          toolName: "moveClip",
          params: { start: obs.params.start },
          reason: "跨轨冲突时先测试同轨移动。",
        });
      }
    } else if (obs.name === "exportVideo") {
      suggestions.push({
        label: "导出默认文件名",
        toolName: "exportVideo",
        params: {},
        reason: "先去掉自定义 filename 变量影响。",
      });
    }
  }

  if (reflection.includes("先分割再删除")) {
    suggestions.push({
      label: "先 splitAtPlayhead",
      toolName: "splitAtPlayhead",
      params: {},
      reason: "反思建议：先分割再执行后续操作。",
    });
  }

  const dedup = new Map<string, RepairSuggestion>();
  for (const s of suggestions) {
    const key = `${s.toolName}:${JSON.stringify(s.params)}`;
    if (!dedup.has(key)) dedup.set(key, s);
  }
  return Array.from(dedup.values()).slice(0, 5);
}
