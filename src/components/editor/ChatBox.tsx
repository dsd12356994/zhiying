import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Bot, Zap } from "lucide-react";
import { useChatStore } from "../../stores/chat-store";
import { useEditorStore } from "../../stores/editor-store";
import { useSettingsStore } from "../../stores/settings-store";
import {
  askLLM,
  summarizeAfterToolExecution,
  type AgentProvider,
  type ToolExecutionObservation,
} from "../../lib/agent/llmAgent";
import { executeTool } from "../../lib/tools/toolRegistry";
import { parseAndExecute } from "../../lib/commandParser";
import {
  getAgentMetrics,
  getToolCallSuccessScore,
  logAgentExecution,
} from "../../lib/agent/logger";
import {
  buildRepairSuggestions,
  reflectOnExecution,
  saveFailureCase,
  type RepairSuggestion,
} from "../../lib/agent/reflection";

let _aiMode = false;
export function getAiMode() {
  return _aiMode;
}

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

function suggestionKey(suggestion: RepairSuggestion): string {
  return `${suggestion.toolName}:${stableStringify(suggestion.params)}`;
}

function getDefaultProvider(): AgentProvider {
  if (import.meta.env.VITE_DEEPSEEK_API_KEY) return "deepseek";
  return "mock";
}

const AI_SMOKE_CASES: Array<{ prompt: string; expectedTool: string }> = [
  { prompt: "删除 25 秒到 30 秒", expectedTool: "removeRange" },
  { prompt: "给第一段加黑白滤镜", expectedTool: "applyFilter" },
  { prompt: "在第一段和第二段之间加转场", expectedTool: "addTransition" },
  { prompt: "列出当前转场列表", expectedTool: "listTransitions" },
  { prompt: "给我当前片段详情", expectedTool: "getClipDetails" },
  { prompt: "在 5 秒到 8 秒添加字幕 hello", expectedTool: "addText" },
  { prompt: "把当前片段卡到节拍", expectedTool: "detectBeats" },
  { prompt: "第三段 2 倍速", expectedTool: "changeSpeed" },
  { prompt: "2 秒时缩放到 1.5", expectedTool: "addKeyframe" },
  { prompt: "导出视频", expectedTool: "exportVideo" },
];

export function ChatBox() {
  const { showChatBox, toggleChatBox } = useEditorStore();
  const { messages, addMessage } = useChatStore();
  const language = useSettingsStore((s) => s.language);
  const text =
    language === "en"
      ? {
          title: "AI Assistant",
          toolHits: "Tool hits",
          failureHints: "Failure hints",
          summary: "Summary",
          reflection: "Reflection",
          repair: "Repair suggestions",
          aiModeOff: "AI mode is off. Message recorded only, no tool execution.",
          aiError: "AI processing error",
          retry: "Retry",
          suggestionRun: "Suggestion",
          smokeHeader: "AI smoke check (parse only, no execution)",
          smokeResult: "Result",
          smokePass: "passed",
          diagnosticsShow: "Show diagnostics",
          diagnosticsHide: "Hide diagnostics",
          smokeBtn: "Smoke",
          smokeRunning: "Running...",
          smokeTitle: "Validate common prompts parser mapping",
          retryFailed: "Retry failed step",
          inputAi: "Edit with AI...",
          inputCmd: "Type command...",
          aiOn: "AI Agent enabled",
          aiOff: "AI Agent disabled",
          providerTitle: "Model provider",
          calls: "Calls",
          successRate: "Success rate",
          avgMs: "Avg latency",
          failed: "Failed",
          justSuccess: "just succeeded",
          justFailed: "just failed",
        }
      : {
          title: "AI 助手",
          toolHits: "命中工具",
          failureHints: "历史失败经验命中",
          summary: "总结",
          reflection: "反思",
          repair: "建议重试方案",
          aiModeOff: "AI 模式已关闭，仅记录消息，不执行工具。",
          aiError: "AI 处理出错",
          retry: "重试",
          suggestionRun: "方案执行",
          smokeHeader: "AI 冒烟检查（仅解析，不执行工具）",
          smokeResult: "结果",
          smokePass: "通过",
          diagnosticsShow: "显示诊断",
          diagnosticsHide: "隐藏诊断",
          smokeBtn: "AI冒烟",
          smokeRunning: "冒烟中…",
          smokeTitle: "快速验证常见命令是否能解析到目标工具",
          retryFailed: "重试失败步骤",
          inputAi: "用 AI 指挥剪辑…",
          inputCmd: "输入指令…",
          aiOn: "AI Agent 已启用",
          aiOff: "AI Agent 已关闭",
          providerTitle: "模型提供方",
          calls: "调用总数",
          successRate: "成功率",
          avgMs: "平均耗时",
          failed: "失败数",
          justSuccess: "刚成功",
          justFailed: "刚失败",
        };
  const [input, setInput] = useState("");
  const [composing, setComposing] = useState(false);
  const [aiMode, setAiMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<AgentProvider>(getDefaultProvider);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [metricsTick, setMetricsTick] = useState(0);
  const [smokeRunning, setSmokeRunning] = useState(false);
  const [lastFailedTool, setLastFailedTool] = useState<{
    name: string;
    params: Record<string, unknown>;
    reason: string;
  } | null>(null);
  const [repairSuggestions, setRepairSuggestions] = useState<RepairSuggestion[]>([]);
  const [repairSuggestionMarks, setRepairSuggestionMarks] = useState<
    Record<string, "success" | "failed">
  >({});
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const metrics = getAgentMetrics();

  useEffect(() => {
    _aiMode = aiMode;
  }, [aiMode]);

  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = useCallback(async () => {
    const userText = input.trim();
    if (!userText || loading) return;
    setInput("");
    setLoading(true);
    addMessage("user", userText);
    setRepairSuggestions([]);
    setRepairSuggestionMarks({});

    try {
      if (aiMode) {
        const llm = await askLLM(userText, { provider });
        const results: string[] = [];
        const observations: ToolExecutionObservation[] = [];

        if (llm.message) {
          results.push(`🤖 [${llm.providerUsed}] ${llm.message}`);
        }
        if (llm.retrievedTools.length > 0) {
          results.push(`🔎 ${text.toolHits}: ${llm.retrievedTools.join(", ")}`);
        }
        if (llm.retrievedFailureHints.length > 0) {
          results.push(
            `🧩 ${text.failureHints}: ${Array.from(
              new Set(llm.retrievedFailureHints)
            ).join(", ")}`
          );
        }

        if (llm.toolCalls.length > 0) {
          let firstFailure: { name: string; params: Record<string, unknown>; reason: string } | null = null;
          for (const toolCall of llm.toolCalls) {
            const t0 = performance.now();
            const result = await executeTool(toolCall.name, toolCall.params);
            const elapsed = Math.max(0, Math.round(performance.now() - t0));
            const status = result.ok ? "✅" : "❌";
            const paramsText = JSON.stringify(toolCall.params ?? {});
            observations.push({
              name: toolCall.name,
              params: toolCall.params ?? {},
              ok: result.ok,
              message: result.message,
              elapsedMs: elapsed,
            });
            logAgentExecution({
              userInput: userText,
              provider: llm.providerUsed,
              toolName: toolCall.name,
              params: toolCall.params ?? {},
              ok: result.ok,
              message: result.message,
              elapsedMs: elapsed,
            });
            results.push(
              `${status} ${toolCall.name} ${paramsText} (${elapsed}ms): ${result.message}`
            );
            if (!result.ok && !firstFailure) {
              firstFailure = {
                name: toolCall.name,
                params: toolCall.params ?? {},
                reason: result.message,
              };
            }
          }
          setLastFailedTool(firstFailure);
        } else {
          const fallback = await parseAndExecute(userText);
          if (fallback.success) {
            results.push(`✅ fallback: ${fallback.message}`);
          } else {
            results.push(`⚠️ ${fallback.message}`);
          }
        }

        if (observations.length > 0) {
          const summary = await summarizeAfterToolExecution(userText, observations, {
            provider,
          });
          results.push(`🧠 ${text.summary}: ${summary}`);
          const reflection = await reflectOnExecution(userText, observations, llm.providerUsed);
          results.push(`🪞 ${text.reflection}: ${reflection}`);
          if (observations.some((o) => !o.ok)) {
            saveFailureCase({
              userInput: userText,
              provider: llm.providerUsed,
              observations,
              reflection,
            });
            const suggestions = buildRepairSuggestions(observations, reflection);
            const ranked = [...suggestions]
              .map((s) => ({
                ...s,
                _rank: getToolCallSuccessScore(s.toolName, s.params),
              }))
              .sort((a, b) => b._rank.score - a._rank.score)
              .map((s) => ({
                ...s,
                label: `${s.label} (${Math.round(s._rank.score * 100)}%/${s._rank.samples})`,
              }));
            setRepairSuggestions(ranked);
            if (suggestions.length > 0) {
              results.push(
                `🛠️ ${text.repair}: ${ranked
                  .map((s) => `${s.toolName}(${JSON.stringify(s.params)})`)
                  .join(" | ")}`
              );
            }
          }
        }

        addMessage("assistant", results.join("\n"));
        setMetricsTick((n) => n + 1);
      } else {
        addMessage("assistant", text.aiModeOff);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误";
      addMessage("assistant", `⚠️ ${text.aiError}: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [input, loading, aiMode, addMessage, provider]);

  const handleRetryLastFailedTool = useCallback(async () => {
    if (!lastFailedTool || loading) return;
    setLoading(true);
    try {
      const t0 = performance.now();
      const result = await executeTool(lastFailedTool.name, lastFailedTool.params);
      const elapsed = Math.max(0, Math.round(performance.now() - t0));
      logAgentExecution({
        userInput: "[retry-last-failed-tool]",
        provider,
        toolName: lastFailedTool.name,
        params: lastFailedTool.params,
        ok: result.ok,
        message: result.message,
        elapsedMs: elapsed,
      });
      addMessage(
        "assistant",
        `${result.ok ? "✅" : "❌"} ${text.retry} ${lastFailedTool.name} (${elapsed}ms): ${result.message}`
      );
      if (result.ok) setLastFailedTool(null);
      setMetricsTick((n) => n + 1);
    } finally {
      setLoading(false);
    }
  }, [addMessage, lastFailedTool, loading, provider]);

  const handleApplyRepairSuggestion = useCallback(
    async (suggestion: RepairSuggestion) => {
      if (loading) return;
      setLoading(true);
      const key = suggestionKey(suggestion);
      try {
        const t0 = performance.now();
        const result = await executeTool(suggestion.toolName, suggestion.params);
        const elapsed = Math.max(0, Math.round(performance.now() - t0));
        logAgentExecution({
          userInput: "[apply-repair-suggestion]",
          provider,
          toolName: suggestion.toolName,
          params: suggestion.params,
          ok: result.ok,
          message: result.message,
          elapsedMs: elapsed,
        });
        addMessage(
          "assistant",
          `${result.ok ? "✅" : "❌"} ${text.suggestionRun} ${suggestion.toolName} (${elapsed}ms): ${result.message}`
        );
        setRepairSuggestionMarks((prev) => ({
          ...prev,
          [key]: result.ok ? "success" : "failed",
        }));
        if (result.ok) {
          setRepairSuggestions((prev) => {
            const idx = prev.findIndex((s) => suggestionKey(s) === key);
            if (idx <= 0) return prev;
            const next = [...prev];
            const [hit] = next.splice(idx, 1);
            next.unshift(hit);
            return next;
          });
        }
        setMetricsTick((n) => n + 1);
      } finally {
        setLoading(false);
      }
    },
    [addMessage, loading, provider]
  );

  const handleRunSmoke = useCallback(async () => {
    if (loading || smokeRunning) return;
    setSmokeRunning(true);
    try {
      const lines: string[] = [`🧪 ${text.smokeHeader}`];
      let pass = 0;
      for (const c of AI_SMOKE_CASES) {
        const result = await askLLM(c.prompt, { provider: "mock" });
        const hit = result.toolCalls.some((t) => t.name === c.expectedTool);
        if (hit) pass++;
        lines.push(`${hit ? "✅" : "❌"} ${c.prompt} -> 期望 ${c.expectedTool}`);
      }
      lines.push(`${text.smokeResult}: ${pass}/${AI_SMOKE_CASES.length} ${text.smokePass}`);
      addMessage("assistant", lines.join("\n"));
    } finally {
      setSmokeRunning(false);
    }
  }, [addMessage, loading, smokeRunning]);

  return (
    <>
      {!showChatBox && (
        <button
          onClick={toggleChatBox}
          className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg transition-all hover:scale-105"
        >
          <MessageSquare size={18} />
        </button>
      )}

      {showChatBox && (
        <div className="fixed bottom-6 right-6 z-50 flex w-72 flex-col overflow-hidden rounded-xl border border-border bg-bg-elev shadow-xl animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Bot size={14} className="text-accent" />
              <span className="text-xs font-medium text-fg">{text.title}</span>
            </div>
            <div className="flex items-center gap-1">
              {/* AI mode toggle */}
              <button
                onClick={() => setAiMode(!aiMode)}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] transition-colors ${
                  aiMode
                    ? "bg-accent text-accent-fg"
                    : "text-fg-muted hover:bg-hover"
                }`}
                title={aiMode ? text.aiOn : text.aiOff}
              >
                <Zap size={10} />
                {aiMode ? "Agent" : "关闭"}
              </button>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as AgentProvider)}
                className="rounded border border-border bg-bg-2 px-1 py-0.5 text-[10px] text-fg"
                title={text.providerTitle}
              >
                <option value="mock">Mock</option>
                <option value="deepseek">DeepSeek</option>
              </select>
              <button onClick={toggleChatBox} className="text-fg-muted hover:text-fg">
                <X size={14} />
              </button>
            </div>
          </div>
          {showDiagnostics && (
            <div className="border-b border-border px-3 py-2 text-[10px] text-fg-muted">
              <div>{text.calls}: {metrics.total}</div>
              <div>{text.successRate}: {(metrics.successRate * 100).toFixed(1)}%</div>
              <div>{text.avgMs}: {metrics.avgElapsedMs.toFixed(1)}ms</div>
              <div>{text.failed}: {metrics.failed}</div>
            </div>
          )}

          {/* Messages */}
          <div
            ref={listRef}
            className="flex max-h-64 flex-col gap-2 overflow-y-auto px-3 py-2"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent text-accent-fg"
                      : "bg-bg-2 text-fg-2"
                  }`}
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-lg bg-bg-2 px-3 py-2">
                  <div className="flex gap-1">
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-muted" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-muted [animation-delay:0.1s]" />
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-muted [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowDiagnostics((v) => !v)}
                  className="rounded px-1.5 py-0.5 text-[10px] text-fg-muted hover:bg-hover"
                >
                  {showDiagnostics ? text.diagnosticsHide : text.diagnosticsShow} · #{metricsTick}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRunSmoke()}
                  disabled={smokeRunning || loading}
                  className="rounded px-1.5 py-0.5 text-[10px] text-fg-muted hover:bg-hover disabled:opacity-50"
                  title={text.smokeTitle}
                >
                  {smokeRunning ? text.smokeRunning : text.smokeBtn}
                </button>
              </div>
              {lastFailedTool && (
                <button
                  type="button"
                  onClick={handleRetryLastFailedTool}
                  className="rounded px-1.5 py-0.5 text-[10px] text-fg-muted hover:bg-hover"
                  title={`重试 ${lastFailedTool.name}: ${lastFailedTool.reason}`}
                >
                  {text.retryFailed}
                </button>
              )}
            </div>
            {repairSuggestions.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {repairSuggestions.map((s, i) => (
                  (() => {
                    const key = suggestionKey(s);
                    const mark = repairSuggestionMarks[key];
                    const label =
                      mark === "success"
                        ? `${s.label} · ${text.justSuccess}`
                        : mark === "failed"
                          ? `${s.label} · ${text.justFailed}`
                          : s.label;
                    return (
                  <button
                    key={`${s.toolName}-${i}`}
                    type="button"
                    onClick={() => void handleApplyRepairSuggestion(s)}
                    className={`rounded border px-1.5 py-0.5 text-[10px] ${
                      mark === "success"
                        ? "border-accent bg-bg-2 text-accent"
                        : mark === "failed"
                          ? "border-border-strong bg-bg-2 text-fg"
                          : "border-border bg-bg-2 text-fg-muted"
                    } hover:bg-hover`}
                    title={`${s.reason}\n${JSON.stringify(s.params)}`}
                  >
                    {label}
                  </button>
                    );
                  })()
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={() => setComposing(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !composing) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={aiMode ? text.inputAi : text.inputCmd}
                rows={1}
                className="flex-1 resize-none rounded-lg border border-border bg-bg-2 px-3 py-2 text-xs text-fg outline-none placeholder:text-fg-muted focus:border-accent"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
