import { getToolsForLLM } from "../tools/toolRegistry";
import {
  enrichPromptWithTools,
  retrieveRelevantContext,
} from "../rag/toolKnowledgeBase";

export type AgentProvider = "mock" | "openai" | "deepseek" | "claude" | "local";

export interface AgentToolCall {
  name: string;
  params: Record<string, unknown>;
}

export interface AskLlmOptions {
  provider?: AgentProvider;
}

export interface AskLlmResult {
  toolCalls: AgentToolCall[];
  message: string;
  providerUsed: AgentProvider | "fallback-mock";
  retrievedTools: string[];
  retrievedFailureHints: string[];
}

export interface ToolExecutionObservation {
  name: string;
  params: Record<string, unknown>;
  ok: boolean;
  message: string;
  elapsedMs: number;
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const ZHIYING_AGENT_SYSTEM_PROMPT =
  "你是专业的视频剪辑 AI 助手“智映”。你的核心能力是理解用户自然语言并调用工具完成剪辑。规则：1) 用户说“删除/剪掉 X 秒到 Y 秒”时，直接调用 removeRange({start:X,end:Y,ripple:true})，不要拆分成 split+delete。2) 若用户只说“删除这个区间”但无具体时间，先询问时间范围，或先调用 getTimelineInfo 帮助定位。3) 删除最后几秒优先 trimLast；裁剪到某时刻优先 trimTo。4) 用户要求黑白/复古/电影感等画面风格时，优先调用 applyFilter。5) 用户要求在片段间添加转场时，优先调用 addTransition。6) 用户要求添加字幕/文字时，调用 addText。7) 用户要求卡点时，先 detectBeats，再 snapToBeat。8) 用户要求变速（快放/慢放/几倍速）时调用 changeSpeed。9) 用户要求关键帧动画时调用 addKeyframe。10) 查询类请求优先用 getClipDetails/listTransitions/getTimelineInfo。11) 工具执行后用简洁中文反馈结果。12) 参数必须严格符合工具 schema。示例：用户“给第一段加黑白滤镜” -> applyFilter({clipIndex:1,filterName:'noir',intensity:1})；用户“第一段和第二段加淡入淡出转场” -> addTransition({fromClipIndex:1,toClipIndex:2,type:'fade',duration:1})；用户“5到10秒加字幕Hello” -> addText({content:'Hello',start:5,end:10})；用户“把第二段卡到节拍” -> detectBeats({}) + snapToBeat({})；用户“第三段2倍速” -> changeSpeed({clipIndex:3,speed:2})；用户“2秒时缩放到1.5” -> addKeyframe({property:'scale',time:2,value:1.5})。";

interface ProviderConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

function getProviderConfig(provider: "openai" | "deepseek"): ProviderConfig | null {
  if (provider === "openai") {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
    if (!apiKey) return null;
    return {
      apiUrl: (import.meta.env.VITE_OPENAI_API_URL as string | undefined) || OPENAI_API_URL,
      apiKey,
      model: (import.meta.env.VITE_OPENAI_MODEL as string | undefined) || "gpt-4.1-mini",
    };
  }
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
  if (!apiKey) return null;
  return {
    apiUrl:
      (import.meta.env.VITE_DEEPSEEK_API_URL as string | undefined) || DEEPSEEK_API_URL,
    apiKey,
    model: (import.meta.env.VITE_DEEPSEEK_MODEL as string | undefined) || "deepseek-chat",
  };
}

function extractNumber(input: string): number | null {
  const match = input.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const v = Number.parseFloat(match[1]);
  return Number.isFinite(v) ? v : null;
}

function parseMockToolCalls(userInput: string): AgentToolCall[] {
  const text = userInput.trim().toLowerCase();
  const secs = extractNumber(text);
  const removeRangeMatch = text.match(
    /(?:删除|剪掉|剪去)\s*(\d+(?:\.\d+)?)\s*秒?\s*(?:到|至|-|~)\s*(\d+(?:\.\d+)?)\s*秒?/
  );
  if (removeRangeMatch) {
    const start = Number.parseFloat(removeRangeMatch[1]);
    const end = Number.parseFloat(removeRangeMatch[2]);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return [{ name: "removeRange", params: { start, end, ripple: true } }];
    }
  }

  if (text.includes("分割") || text.includes("split")) {
    if (secs === null) return [{ name: "splitAtPlayhead", params: {} }];
    return [{ name: "splitClip", params: { time: secs } }];
  }

  if (text.includes("裁剪") || text.includes("trim")) {
    if (text.includes("到") && secs !== null) {
      return [{ name: "trimTo", params: { seconds: secs } }];
    }
    if (secs !== null) {
      if (text.includes("起点") || text.includes("开始")) {
        return [{ name: "trimClip", params: { edge: "start", time: secs } }];
      }
      return [{ name: "trimClip", params: { edge: "end", time: secs } }];
    }
    return [];
  }

  if (text.includes("删除") || text.includes("delete")) {
    if ((text.includes("最后") || text.includes("last")) && secs !== null) {
      return [{ name: "trimLast", params: { seconds: secs } }];
    }
    const ripple = text.includes("闭合") || text.includes("ripple");
    const indexMatch = text.match(/第\s*(\d+)\s*段/);
    if (indexMatch) {
      return [{ name: "deleteClip", params: { clipIndex: Number(indexMatch[1]), ripple } }];
    }
    return [{ name: "deleteClip", params: { ripple } }];
  }

  if (text.includes("移动") || text.includes("move")) {
    if (secs !== null) return [{ name: "moveClip", params: { start: secs } }];
    return [];
  }

  if (text.includes("滤镜") || text.includes("黑白") || text.includes("复古")) {
    if (text.includes("黑白")) {
      return [{ name: "applyFilter", params: { filterName: "noir", intensity: 1 } }];
    }
    if (text.includes("复古")) {
      return [{ name: "applyFilter", params: { filterName: "vintage", intensity: 1 } }];
    }
    if (text.includes("电影")) {
      return [{ name: "applyFilter", params: { filterName: "cinematic", intensity: 1 } }];
    }
    return [{ name: "applyFilter", params: { filterName: "vintage", intensity: 0.8 } }];
  }

  if ((text.includes("转场") && text.includes("列表")) || text.includes("有哪些转场")) {
    return [{ name: "listTransitions", params: {} }];
  }
  if ((text.includes("片段") && text.includes("详情")) || text.includes("当前片段信息")) {
    return [{ name: "getClipDetails", params: {} }];
  }

  if (text.includes("转场") || text.includes("过渡")) {
    if (text.includes("淡入") || text.includes("淡出")) {
      return [{ name: "addTransition", params: { type: "fade", duration: 1 } }];
    }
    if (text.includes("滑动")) {
      return [{ name: "addTransition", params: { type: "slide", duration: 1 } }];
    }
    if (text.includes("擦除")) {
      return [{ name: "addTransition", params: { type: "wipe", duration: 1 } }];
    }
    return [{ name: "addTransition", params: { type: "crossDissolve", duration: 1 } }];
  }

  if (text.includes("字幕") || text.includes("文字")) {
    const range = text.match(/(\d+(?:\.\d+)?)\s*(?:秒)?\s*(?:到|至|-|~)\s*(\d+(?:\.\d+)?)/);
    if (range) {
      const start = Number.parseFloat(range[1]);
      const end = Number.parseFloat(range[2]);
      const content = userInput
        .replace(/.*(?:字幕|文字)\s*/i, "")
        .replace(/(\d+(?:\.\d+)?)\s*(?:秒)?\s*(?:到|至|-|~)\s*(\d+(?:\.\d+)?).*/i, "")
        .trim();
      return [
        {
          name: "addText",
          params: { content: content || "新字幕", start, end },
        },
      ];
    }
    if (secs !== null) {
      const content = userInput.replace(/.*(?:字幕|文字)\s*/i, "").trim() || "新字幕";
      return [{ name: "addText", params: { content, start: secs, end: secs + 2 } }];
    }
  }

  if (text.includes("节拍") || text.includes("卡点")) {
    if (text.includes("分析") || text.includes("检测")) {
      return [{ name: "detectBeats", params: {} }];
    }
    return [
      { name: "detectBeats", params: {} },
      { name: "snapToBeat", params: {} },
    ];
  }

  if (text.includes("倍速") || text.includes("快放") || text.includes("慢放") || text.includes("加速")) {
    const speedMatch = text.match(/(\d+(?:\.\d+)?)\s*倍/);
    const speed = speedMatch ? Number.parseFloat(speedMatch[1]) : null;
    if (speed !== null && Number.isFinite(speed)) {
      return [{ name: "changeSpeed", params: { speed } }];
    }
    if (text.includes("慢放")) return [{ name: "changeSpeed", params: { speed: 0.5 } }];
    if (text.includes("快放") || text.includes("加速")) {
      return [{ name: "changeSpeed", params: { speed: 2 } }];
    }
  }

  if (text.includes("关键帧") || text.includes("放大") || text.includes("透明度")) {
    const t = secs ?? 0;
    if (text.includes("放大")) {
      const v = text.match(/(\d+(?:\.\d+)?)\s*倍/)?.[1];
      return [
        {
          name: "addKeyframe",
          params: { property: "scale", time: t, value: v ? Number.parseFloat(v) : 1.5 },
        },
      ];
    }
    if (text.includes("透明")) {
      const v = text.match(/(\d+(?:\.\d+)?)/)?.[1];
      return [
        {
          name: "addKeyframe",
          params: { property: "opacity", time: t, value: v ? Number.parseFloat(v) : 0 },
        },
      ];
    }
  }

  if (text.includes("导出") || text.includes("export")) {
    return [{ name: "exportVideo", params: {} }];
  }

  if (text.includes("撤销") || text === "undo") {
    return [{ name: "undo", params: {} }];
  }

  if (text.includes("重做") || text === "redo") {
    return [{ name: "redo", params: {} }];
  }

  return [];
}

async function askProvider(
  userInput: string,
  provider: "openai" | "deepseek"
): Promise<AskLlmResult> {
  const config = getProviderConfig(provider);
  if (!config) {
    const mockCalls = parseMockToolCalls(userInput);
    const context = await retrieveRelevantContext(userInput, 5, 3);
    return {
      toolCalls: mockCalls,
      message: mockCalls.length > 0 ? "已进入 mock 模式并生成工具调用。" : "未检测到可执行工具（mock 模式）。",
      providerUsed: "fallback-mock",
      retrievedTools: context.tools.map((t) => t.name),
      retrievedFailureHints: context.failureHints.map((h) => h.toolName),
    };
  }

  const context = await retrieveRelevantContext(userInput, 5, 3);
  const relevantTools = context.tools;
  const enrichedPrompt = enrichPromptWithTools(
    userInput,
    relevantTools,
    context.failureHints
  );
  const allTools = getToolsForLLM();
  const relevantNames = new Set(relevantTools.map((t) => t.name));
  const scopedTools =
    relevantNames.size > 0
      ? allTools.filter((tool) => relevantNames.has(tool.function.name))
      : allTools;

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: ZHIYING_AGENT_SYSTEM_PROMPT,
        },
        { role: "user", content: enrichedPrompt },
      ],
      tools: scopedTools.length > 0 ? scopedTools : allTools,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const mockCalls = parseMockToolCalls(userInput);
    const providerLabel = provider === "deepseek" ? "DeepSeek" : "OpenAI";
    return {
      toolCalls: mockCalls,
      message:
        mockCalls.length > 0
          ? `${providerLabel} 请求失败(${response.status})，已回退 mock 执行。`
          : `${providerLabel} 请求失败(${response.status})，且 mock 未匹配到命令。`,
      providerUsed: "fallback-mock",
      retrievedTools: relevantTools.map((t) => t.name),
      retrievedFailureHints: context.failureHints.map((h) => h.toolName),
    };
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
  };

  const message = data.choices?.[0]?.message;
  const toolCalls =
    message?.tool_calls
      ?.map((call) => {
        const name = call.function?.name?.trim();
        if (!name) return null;
        try {
          const params = call.function?.arguments
            ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
            : {};
          return { name, params };
        } catch {
          return { name, params: {} };
        }
      })
      .filter((v): v is AgentToolCall => Boolean(v)) ?? [];

  return {
    toolCalls,
    message:
      message?.content?.trim() ||
      (toolCalls.length
        ? `已生成工具调用（RAG命中 ${relevantTools.length} 个工具）。`
        : "我没有找到可以执行的工具动作。"),
    providerUsed: provider,
    retrievedTools: relevantTools.map((t) => t.name),
    retrievedFailureHints: context.failureHints.map((h) => h.toolName),
  };
}

export async function summarizeAfterToolExecution(
  userInput: string,
  observations: ToolExecutionObservation[],
  options: AskLlmOptions = {}
): Promise<string> {
  const provider = options.provider ?? "mock";
  if (!observations.length) return "没有执行任何工具。";

  const success = observations.filter((o) => o.ok).length;
  const failed = observations.length - success;
  const localSummary = `已执行 ${observations.length} 个工具：成功 ${success}，失败 ${failed}。`;

  if (provider !== "openai" && provider !== "deepseek") {
    return `${localSummary}\n${observations
      .map((o) => `${o.ok ? "✅" : "❌"} ${o.name}: ${o.message}`)
      .join("\n")}`;
  }

  const config = getProviderConfig(provider);
  if (!config) return localSummary;

  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "你是视频剪辑助手。根据用户请求与工具执行结果，给出简短自然语言总结（2-4句），强调是否达成目标及下一步建议。",
          },
          {
            role: "user",
            content: JSON.stringify({ userInput, observations }),
          },
        ],
      }),
    });
    if (!response.ok) return localSummary;
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || localSummary;
  } catch {
    return localSummary;
  }
}

export async function askLLM(
  userInput: string,
  options: AskLlmOptions = {}
): Promise<AskLlmResult> {
  const provider = options.provider ?? "mock";
  const context = await retrieveRelevantContext(userInput, 5, 3);

  if (provider === "openai" || provider === "deepseek") {
    return askProvider(userInput, provider);
  }

  const toolCalls = parseMockToolCalls(userInput);
  return {
    toolCalls,
    message:
      toolCalls.length > 0
        ? "已解析命令并生成工具调用。"
        : "我暂时无法从这句话中确定可执行工具。",
    providerUsed: provider === "mock" ? "mock" : "fallback-mock",
    retrievedTools: context.tools.map((t) => t.name),
    retrievedFailureHints: context.failureHints.map((h) => h.toolName),
  };
}
