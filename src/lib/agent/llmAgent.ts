import { getToolsForLLM } from "../tools/toolRegistry";
import {
  enrichPromptWithTools,
  retrieveRelevantContext,
} from "../rag/toolKnowledgeBase";

export type AgentProvider = "mock" | "openai" | "deepseek" | "claude" | "zhipu";

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
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
  `你是专业的 AI 视频创作助手"智映"。你帮助保险/金融从业者制作专业知识分享视频，用于线上获客。

核心工作流（当用户说"帮我做一个XX视频"时，按 Phase 顺序执行）：
Phase 1: 搜索 → 调用 searchWeb({query}) 获取权威信息
Phase 2: 脚本 → 调用 generateScript({topic, research, tone}) 生成口播脚本
Phase 3: 分镜 → 调用 generateStoryboard({script, topic}) 将脚本拆分为视频镜头
Phase 4: 文生视频 → 逐一调用 generateVideoClip({prompt, duration}) 为每个镜头生成AI画面
Phase 5: 语音 → 调用 synthesizeSpeech({text, voice}) 生成配音（Edge TTS 免费）
Phase 6: 合成 → 调用 composeVideo({avatarVideoUrl, subtitles, branding}) 拼接场景+字幕+品牌
Phase 7: 导出 → 调用 exportVideo({filename}) 输出最终视频

编辑类工具：splitClip/trimTo/trimLast/trimClip/deleteClip/removeRange/moveClip 用于微调。
效果类工具：applyFilter/addTransition/addText/changeSpeed/addKeyframe 用于增强画面。
品牌工具：setBranding({watermarkText, introText, outroText, primaryColor}) 设置水印和片头片尾。

规则：
1) 脚本生成前必须先 searchWeb 确保内容准确可靠。
2) generateStoryboard 的 script 参数使用 generateScript 返回的 data.script。
3) generateVideoClip 的 prompt 参数使用 generateStoryboard 返回的 scenes[].prompt。
4) 文生视频需要配置视频生成 API Key（设置->AI 配置）。
5) 所有工具参数必须严格符合 JSON Schema。
6) 工具执行后用简洁中文反馈结果。
7) 默认输出竖版视频（9:16），适配抖音/视频号/小红书。`;

interface ProviderConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

const ZHIIPU_TEXT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

const DEFAULT_URLS: Record<string, string> = {
  openai: OPENAI_API_URL,
  deepseek: DEEPSEEK_API_URL,
  claude: CLAUDE_API_URL,
  zhipu: ZHIIPU_TEXT_URL,
};

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4.1-mini",
  deepseek: "deepseek-chat",
  claude: "claude-sonnet-4-6",
  zhipu: "glm-4-flash",
};

function readRuntimeConfig(provider: "openai" | "deepseek" | "claude"): ProviderConfig | null {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("zhiying.aiConfig.v1") : null;
    if (!raw) return null;
    const cfg = JSON.parse(raw) as Record<string, Record<string, string> | undefined>;
    const p = cfg[provider];
    if (!p?.apiKey) return null;
    return {
      apiKey: p.apiKey,
      model: p.model || DEFAULT_MODELS[provider],
      apiUrl: p.apiUrl || DEFAULT_URLS[provider],
    };
  } catch {
    return null;
  }
}

function getProviderConfig(provider: "openai" | "deepseek" | "claude" | "zhipu"): ProviderConfig | null {
  // Runtime config (set via Settings UI) takes priority over env vars
  const runtime = readRuntimeConfig(provider);
  if (runtime) return runtime;

  if (provider === "openai") {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
    if (!apiKey) return null;
    return {
      apiUrl: (import.meta.env.VITE_OPENAI_API_URL as string | undefined) || OPENAI_API_URL,
      apiKey,
      model: (import.meta.env.VITE_OPENAI_MODEL as string | undefined) || DEFAULT_MODELS.openai,
    };
  }
  if (provider === "deepseek") {
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined;
    if (!apiKey) return null;
    return {
      apiUrl: (import.meta.env.VITE_DEEPSEEK_API_URL as string | undefined) || DEEPSEEK_API_URL,
      apiKey,
      model: (import.meta.env.VITE_DEEPSEEK_MODEL as string | undefined) || DEFAULT_MODELS.deepseek,
    };
  }
  if (provider === "zhipu") {
    const apiKey = import.meta.env.VITE_ZHIIPU_API_KEY as string | undefined;
    if (!apiKey) return null;
    return {
      apiUrl: (import.meta.env.VITE_ZHIIPU_API_URL as string | undefined) || ZHIIPU_TEXT_URL,
      apiKey,
      model: (import.meta.env.VITE_ZHIIPU_MODEL as string | undefined) || DEFAULT_MODELS.zhipu,
    };
  }
  return null;
}

function extractNumber(input: string): number | null {
  const match = input.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const v = Number.parseFloat(match[1]);
  return Number.isFinite(v) ? v : null;
}

function parseMockToolCalls(userInput: string): AgentToolCall[] {
  const text = userInput.trim().toLowerCase();

  // Knowledge video workflow detection
  const isVideoRequest =
    /(做|生成|创建|拍|制作|帮我弄|来一个).*(视频|vide|科普|分享|知识|保险|移民|理财|金融)/i.test(text) ||
    /(视频|vide|科普|知识分享)/i.test(text);

  if (isVideoRequest) {
    const calls: AgentToolCall[] = [];
    // Extract topic
    const topicMatch = text.match(/(?:关于|介绍|讲|做|科普).{0,5}([^\s，,。.]{4,30})/);
    const topic = topicMatch?.[1] || text.slice(0, 40);
    calls.push({ name: "searchWeb", params: { query: topic } });
    const tone =
      text.includes("专业") || text.includes("严谨") ? "professional"
      : text.includes("简单") || text.includes("直白") ? "simple"
      : text.includes("权威") ? "authoritative"
      : "friendly";
    calls.push({ name: "generateScript", params: { topic, tone } });
    return calls;
  }

  // Branding
  if (/(水印|品牌|片头|片尾|logo|brand)/i.test(text)) {
    const params: Record<string, unknown> = {};
    const wm = text.match(/水印[：:]\s*["""]?([^"""]+)["""]?/i) || text.match(/水印文字?[是为设为]?\s*["""]?([^"""]+)["""]?/i);
    if (wm) params.watermarkText = wm[1].trim();
    const intro = text.match(/片头[：:]\s*(.+)/i);
    if (intro) params.introText = intro[1].trim();
    const outro = text.match(/片尾[：:]\s*(.+)/i);
    if (outro) params.outroText = outro[1].trim();
    if (Object.keys(params).length > 0) return [{ name: "setBranding", params }];
  }

  // Export
  if (/(导出|输出|下载|export)/i.test(text)) return [{ name: "exportVideo", params: {} }];

  // Script preview
  if (/(预览|看看|检查|脚本|script)/i.test(text)) return [{ name: "previewScript", params: { topic: "topic" } }];

  // Digital human / voice
  if (/(数字人|头像|语音|配音|tts|avatar|speech)/i.test(text)) {
    return [
      { name: "synthesizeSpeech", params: { text: text, voice: "xiaoxiao" } },
      { name: "generateAvatar", params: { photoUrl: "", audioUrl: "" } },
    ];
  }

  // Basic editing tools (kept for compatibility)
  if (/(分割|split)/i.test(text)) return [{ name: "splitAtPlayhead", params: {} }];
  if (/(裁剪|trim)/i.test(text)) return [{ name: "trimTo", params: { seconds: extractNumber(text) ?? 30 } }];
  if (/(滤镜|黑白|复古|电影感|温暖|vintage|noir|warm)/i.test(text)) {
    return [{ name: "applyFilter", params: { filterName: text.includes("黑白") ? "noir" : text.includes("温暖") ? "warm" : "vintage", intensity: 0.8 } }];
  }
  if (/(字幕|文字|add.?text)/i.test(text)) return [{ name: "addText", params: { content: text, start: 0, end: 5 } }];
  if (/(转场|过渡|transition)/i.test(text)) return [{ name: "addTransition", params: { type: "fade", duration: 1 } }];
  if (/(撤销|undo)/i.test(text)) return [{ name: "undo", params: {} }];
  if (/(重做|redo)/i.test(text)) return [{ name: "redo", params: {} }];

  return [];
}

function toAnthropicTools(llmTools: ReturnType<typeof getToolsForLLM>) {
  return llmTools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

// Default small tool set when RAG finds no matches — avoids sending all 27+ tools
const FALLBACK_TOOL_NAMES = [
  "searchWeb", "generateScript", "synthesizeSpeech", "generateAvatar", "composeVideo",
  "getTimelineInfo", "addText", "applyFilter", "exportVideo",
];

function pickTools(
  allTools: ReturnType<typeof getToolsForLLM>,
  relevantNames: Set<string>
): ReturnType<typeof getToolsForLLM> {
  if (relevantNames.size > 0) return allTools.filter((t) => relevantNames.has(t.function.name));
  return allTools.filter((t) => FALLBACK_TOOL_NAMES.includes(t.function.name));
}

async function askOpenAICompat(
  userInput: string,
  provider: "openai" | "deepseek",
  config: ProviderConfig,
  context: Awaited<ReturnType<typeof retrieveRelevantContext>>
): Promise<AskLlmResult> {
  const relevantTools = context.tools;
  const enrichedPrompt = enrichPromptWithTools(userInput, relevantTools, context.failureHints);
  const allTools = getToolsForLLM();
  const relevantNames = new Set(relevantTools.map((t) => t.name));
  const scopedTools = pickTools(allTools, relevantNames);

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: ZHIYING_AGENT_SYSTEM_PROMPT },
        { role: "user", content: enrichedPrompt },
      ],
      tools: scopedTools,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const mockCalls = parseMockToolCalls(userInput);
    const label = provider === "deepseek" ? "DeepSeek" : "OpenAI";
    return {
      toolCalls: mockCalls,
      message: mockCalls.length > 0
        ? `${label} 请求失败(${response.status})，已回退 mock 执行。`
        : `${label} 请求失败(${response.status})，且 mock 未匹配到命令。`,
      providerUsed: "fallback-mock",
      retrievedTools: relevantTools.map((t) => t.name),
      retrievedFailureHints: context.failureHints.map((h) => h.toolName),
    };
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
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

async function askClaude(
  userInput: string,
  config: ProviderConfig,
  context: Awaited<ReturnType<typeof retrieveRelevantContext>>
): Promise<AskLlmResult> {
  const relevantTools = context.tools;
  const enrichedPrompt = enrichPromptWithTools(userInput, relevantTools, context.failureHints);
  const allTools = getToolsForLLM();
  const relevantNames = new Set(relevantTools.map((t) => t.name));
  const scopedTools = pickTools(allTools, relevantNames);

  const response = await fetch(config.apiUrl || CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      system: ZHIYING_AGENT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: enrichedPrompt }],
      tools: toAnthropicTools(scopedTools),
      tool_choice: { type: "auto" },
    }),
  });

  if (!response.ok) {
    const mockCalls = parseMockToolCalls(userInput);
    return {
      toolCalls: mockCalls,
      message: mockCalls.length > 0
        ? `Claude 请求失败(${response.status})，已回退 mock 执行。`
        : `Claude 请求失败(${response.status})，且 mock 未匹配到命令。`,
      providerUsed: "fallback-mock",
      retrievedTools: relevantTools.map((t) => t.name),
      retrievedFailureHints: context.failureHints.map((h) => h.toolName),
    };
  }

  const data = (await response.json()) as {
    content?: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    >;
  };

  const toolCalls: AgentToolCall[] = (data.content ?? [])
    .filter((block): block is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      block.type === "tool_use"
    )
    .map((block) => ({ name: block.name, params: block.input ?? {} }));

  const textBlock = (data.content ?? []).find((b) => b.type === "text") as
    | { type: "text"; text: string }
    | undefined;

  return {
    toolCalls,
    message:
      textBlock?.text?.trim() ||
      (toolCalls.length
        ? `已生成工具调用（RAG命中 ${relevantTools.length} 个工具）。`
        : "我没有找到可以执行的工具动作。"),
    providerUsed: "claude",
    retrievedTools: relevantTools.map((t) => t.name),
    retrievedFailureHints: context.failureHints.map((h) => h.toolName),
  };
}

async function askProvider(
  userInput: string,
  provider: "openai" | "deepseek" | "claude" | "zhipu"
): Promise<AskLlmResult> {
  const config = getProviderConfig(provider);
  const context = await retrieveRelevantContext(userInput, 5, 3);

  if (!config) {
    const mockCalls = parseMockToolCalls(userInput);
    return {
      toolCalls: mockCalls,
      message: mockCalls.length > 0 ? "已进入 mock 模式并生成工具调用。" : "未检测到可执行工具（mock 模式）。",
      providerUsed: "fallback-mock",
      retrievedTools: context.tools.map((t) => t.name),
      retrievedFailureHints: context.failureHints.map((h) => h.toolName),
    };
  }

  if (provider === "claude") return askClaude(userInput, config, context);
  // zhipu uses OpenAI-compatible API, reuse the same path
  return askOpenAICompat(userInput, provider as "openai" | "deepseek" | "zhipu", config, context);
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

  if (provider !== "openai" && provider !== "deepseek" && provider !== "claude") {
    return `${localSummary}\n${observations
      .map((o) => `${o.ok ? "✅" : "❌"} ${o.name}: ${o.message}`)
      .join("\n")}`;
  }

  const config = getProviderConfig(provider);
  if (!config) return localSummary;

  const summarizeMessages = [
    {
      role: "system" as const,
      content: "你是视频剪辑助手。根据用户请求与工具执行结果，给出简短自然语言总结（2-4句），强调是否达成目标及下一步建议。",
    },
    { role: "user" as const, content: JSON.stringify({ userInput, observations }) },
  ];

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
          system: summarizeMessages[0].content,
          messages: [summarizeMessages[1]],
        }),
      });
      if (!response.ok) return localSummary;
      const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
      return data.content?.find((b) => b.type === "text")?.text?.trim() || localSummary;
    }

    response = await fetch(config.apiUrl, {
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

  if (provider === "openai" || provider === "deepseek" || provider === "claude" || provider === "zhipu") {
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
