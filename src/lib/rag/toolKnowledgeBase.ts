import { getFailureCases } from "../agent/reflection";

export interface ToolKnowledge {
  name: string;
  content: string;
  keywords: string[];
  intentTags: string[];
}

export interface FailureHint {
  toolName: string;
  userInput: string;
  reflection: string;
  score: number;
}

export interface RetrievalContext {
  tools: ToolKnowledge[];
  failureHints: FailureHint[];
}

type MarkdownModuleMap = Record<string, string>;

const MARKDOWN_DOCS = import.meta.glob("../tools/knowledge/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as MarkdownModuleMap;

// Agent skill files — teach multi-step editing patterns
const SKILL_DOCS = import.meta.glob("../agent/skills/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as MarkdownModuleMap;

function inferName(path: string, content: string): string {
  const heading = content.match(/^#\s+([A-Za-z0-9_/-]+)/m)?.[1]?.trim();
  if (heading) return heading;
  const file = path.split("/").pop() || "";
  return file.replace(/\.md$/, "");
}

function defaultKeywords(name: string): string[] {
  const lowered = name.toLowerCase();
  switch (lowered) {
    case "searchweb": return ["搜索", "查找", "search", "检索", "资料", "research", "保险", "金融", "移民", "政策"];
    case "generatescript": return ["脚本", "文案", "台词", "script", "生成", "稿子", "话题", "topic"];
    case "synthesizespeech": return ["语音", "配音", "朗读", "tts", "speech", "声音", "念", "播报"];
    case "generateavatar": return ["数字人", "头像", "口播", "avatar", "heygen", "人像", "照片", "开口"];
    case "composevideo": return ["合成", "组合", "compose", "拼接", "最终视频", "成品"];
    case "setbranding": return ["品牌", "水印", "片头", "片尾", "branding", "logo", "标志"];
    case "splitclip": case "splitatplayhead": return ["分割", "切分", "split"];
    case "trimclip": case "trimto": case "trimlast": return ["裁剪", "trim", "删除最后", "保留前"];
    case "deleteclip": return ["删除", "delete", "去掉"];
    case "moveclip": return ["移动", "挪动", "move", "位置"];
    case "exportvideo": return ["导出", "export", "下载"];
    case "undo": return ["撤销", "undo"];
    case "redo": return ["重做", "redo"];
    default: return [name.toLowerCase()];
  }
}

function defaultIntentTags(name: string): string[] {
  const lowered = name.toLowerCase();
  switch (lowered) {
    case "searchweb": return ["research", "search"];
    case "generatescript": return ["script", "generate"];
    case "synthesizespeech": return ["speech", "tts"];
    case "generateavatar": return ["avatar", "digitalhuman"];
    case "composevideo": return ["compose", "assemble"];
    case "setbranding": return ["brand", "branding"];
    case "splitclip": case "splitatplayhead": return ["split"];
    case "trimclip": case "trimto": case "trimlast": return ["trim"];
    case "deleteclip": return ["delete"];
    case "moveclip": return ["move"];
    case "exportvideo": return ["export"];
    case "undo": return ["undo"];
    case "redo": return ["redo"];
    default: return [];
  }
}

function detectIntentTags(query: string): string[] {
  const q = query.toLowerCase();
  const tags = new Set<string>();
  // Insurance knowledge video intents
  if (/(视频|vide|科普|分享|知识|制作|生成|创建|做|拍|弄|来一个)/i.test(q)) tags.add("video");
  if (/(搜索|查|搜|资料|research|search|最新|规定|政策)/i.test(q)) tags.add("research");
  if (/(脚本|文案|台词|写|稿子|script)/i.test(q)) tags.add("script");
  if (/(语音|配音|朗读|念|声音|播|tts|speech)/i.test(q)) tags.add("speech");
  if (/(数字人|头像|口播|heygen|人像|照片|avatar)/i.test(q)) tags.add("avatar");
  if (/(品牌|水印|片头|片尾|brand|logo)/i.test(q)) tags.add("brand");
  if (/(保险|重疾|医疗|寿险|理财|养老|移民|金融)/i.test(q)) tags.add("insurance");
  // Basic editing intents (kept)
  if (/(分割|切分|切开|split)/i.test(q)) tags.add("split");
  if (/(裁剪|trim|删除最后)/i.test(q)) tags.add("trim");
  if (/(删除|delete|去掉|移除)/i.test(q)) tags.add("delete");
  if (/(导出|export|下载)/i.test(q)) tags.add("export");
  if (/(滤镜|调色|风格|颜色|color|grade)/i.test(q)) tags.add("colorgrade");
  if (/(字幕|文字|标题|subtitle|caption)/i.test(q)) tags.add("subtitle");
  return Array.from(tags);
}

function skillKeywords(name: string): string[] {
  const map: Record<string, string[]> = {
    "avatar-workflow": ["视频", "数字人", "知识分享", "科普", "保险", "金融", "移民", "avatar", "digital human", "口播", "脚本", "语音", "配音", "生成视频"],
    "insurance-script-guide": ["脚本", "文案", "台词", "script", "保险", "重疾", "医疗", "养老", "理赔", "科普", "分享", "怎么写", "内容"],
  };
  return map[name] ?? [name.toLowerCase()];
}

function skillIntentTags(name: string): string[] {
  const map: Record<string, string[]> = {
    "avatar-workflow": ["video", "avatar", "script", "speech", "research", "brand", "insurance"],
    "insurance-script-guide": ["script", "insurance"],
  };
  return map[name] ?? [];
}

const TOOL_KNOWLEDGE: ToolKnowledge[] = Object.entries(MARKDOWN_DOCS).map(
  ([path, content]) => {
    const name = inferName(path, content);
    return {
      name,
      content,
      keywords: defaultKeywords(name),
      intentTags: defaultIntentTags(name),
    };
  }
);

const SKILL_KNOWLEDGE: ToolKnowledge[] = Object.entries(SKILL_DOCS).map(
  ([path, content]) => {
    const name = inferName(path, content);
    return {
      name: `skill:${name}`,
      content,
      keywords: skillKeywords(name),
      intentTags: skillIntentTags(name),
    };
  }
);

const KNOWLEDGE_BASE: ToolKnowledge[] = [...TOOL_KNOWLEDGE, ...SKILL_KNOWLEDGE];

function scoreKnowledge(query: string, item: ToolKnowledge): number {
  const q = query.toLowerCase();
  const content = item.content.toLowerCase();
  const intents = detectIntentTags(query);
  let score = 0;

  if (q.includes(item.name.toLowerCase())) score += 6;
  for (const kw of item.keywords) {
    if (q.includes(kw.toLowerCase())) score += 3;
  }

  const tokens = q.split(/[\s,，。.!?？、]+/).filter(Boolean);
  for (const token of tokens) {
    if (token.length < 2) continue;
    if (content.includes(token)) score += 1;
  }

  if (intents.length > 0) {
    const overlap = intents.filter((tag) => item.intentTags.includes(tag)).length;
    score += overlap * 4;
    if (overlap === 0) score -= 1;
  }

  return score;
}

export async function retrieveRelevantTools(
  query: string,
  topK = 5
): Promise<ToolKnowledge[]> {
  if (!query.trim()) return [];
  const failureHints = await retrieveRelevantFailureHints(query, 3);
  const boostByTool = new Map<string, number>();
  for (const hint of failureHints) {
    boostByTool.set(
      hint.toolName,
      (boostByTool.get(hint.toolName) ?? 0) + 5
    );
  }
  const ranked = KNOWLEDGE_BASE.map((item) => ({
    item,
    score: scoreKnowledge(query, item) + (boostByTool.get(item.name) ?? 0),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topK))
    .map((x) => x.item);
  return ranked;
}

export async function retrieveRelevantFailureHints(
  query: string,
  topK = 3
): Promise<FailureHint[]> {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const tokens = q.split(/[\s,，。.!?？、]+/).filter((t) => t.length >= 2);
  const hints: FailureHint[] = [];
  const cases = getFailureCases();

  for (const c of cases) {
    const haystack = `${c.userInput}\n${c.reflection}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1;
    }
    for (const obs of c.observations) {
      if (!obs.ok && q.includes(obs.name.toLowerCase())) score += 3;
    }
    if (score <= 0) continue;

    const primaryFailed = c.observations.find((o) => !o.ok);
    if (!primaryFailed) continue;
    hints.push({
      toolName: primaryFailed.name,
      userInput: c.userInput,
      reflection: c.reflection,
      score,
    });
  }

  return hints.sort((a, b) => b.score - a.score).slice(0, Math.max(1, topK));
}

export async function retrieveRelevantContext(
  query: string,
  topKTools = 5,
  topKFailureHints = 3
): Promise<RetrievalContext> {
  const [tools, failureHints] = await Promise.all([
    retrieveRelevantTools(query, topKTools),
    retrieveRelevantFailureHints(query, topKFailureHints),
  ]);
  return { tools, failureHints };
}

// Keep knowledge snippets short to reduce prompt token count
const KNOWLEDGE_SNIPPET_CHARS = 280;

export function enrichPromptWithTools(
  userInput: string,
  relevantTools: ToolKnowledge[],
  failureHints: FailureHint[] = []
): string {
  if (!relevantTools.length) {
    return `用户请求：${userInput}`;
  }
  // Truncate each doc to first KNOWLEDGE_SNIPPET_CHARS chars — enough for purpose/params, not the full guide
  const sections = relevantTools.map(
    (tool, idx) =>
      `#${idx + 1} ${tool.name}: ${tool.content.slice(0, KNOWLEDGE_SNIPPET_CHARS).trim()}`
  );
  const failureSection =
    failureHints.length > 0
      ? `\n历史失败：${failureHints.map((h) => `${h.toolName}→${h.reflection}`).join("；")}`
      : "";
  return `用户请求：${userInput}\n工具提示：${sections.join(" | ")}${failureSection}`;
}

export function getKnowledgeBaseNames(): string[] {
  return KNOWLEDGE_BASE.map((k) => k.name);
}
