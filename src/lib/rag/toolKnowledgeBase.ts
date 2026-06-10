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

function inferName(path: string, content: string): string {
  const heading = content.match(/^#\s+([A-Za-z0-9_/-]+)/m)?.[1]?.trim();
  if (heading) return heading;
  const file = path.split("/").pop() || "";
  return file.replace(/\.md$/, "");
}

function defaultKeywords(name: string): string[] {
  const lowered = name.toLowerCase();
  switch (lowered) {
    case "splitclip":
    case "splitatplayhead":
      return ["分割", "切分", "split", "切开"];
    case "trimclip":
    case "trimto":
    case "trimlast":
      return ["裁剪", "trim", "删除最后", "保留前", "起点", "终点"];
    case "deleteclip":
      return ["删除", "delete", "去掉", "闭合间隙", "ripple"];
    case "moveclip":
      return ["移动", "挪动", "move", "位置", "轨道"];
    case "exportvideo":
      return ["导出", "export", "下载"];
    case "undo":
      return ["撤销", "undo", "回退"];
    case "redo":
      return ["重做", "redo", "恢复"];
    default:
      return [name.toLowerCase()];
  }
}

function defaultIntentTags(name: string): string[] {
  const lowered = name.toLowerCase();
  switch (lowered) {
    case "splitclip":
    case "splitatplayhead":
      return ["split"];
    case "trimclip":
    case "trimto":
    case "trimlast":
      return ["trim"];
    case "deleteclip":
      return ["delete"];
    case "moveclip":
      return ["move"];
    case "exportvideo":
      return ["export"];
    case "undo":
      return ["undo"];
    case "redo":
      return ["redo"];
    default:
      return [];
  }
}

function detectIntentTags(query: string): string[] {
  const q = query.toLowerCase();
  const tags = new Set<string>();
  if (/(分割|切分|切开|split)/i.test(q)) tags.add("split");
  if (/(裁剪|trim|删除最后|保留前|起点|终点)/i.test(q)) tags.add("trim");
  if (/(删除|delete|去掉|移除)/i.test(q)) tags.add("delete");
  if (/(移动|挪到|move|轨道)/i.test(q)) tags.add("move");
  if (/(导出|export|下载)/i.test(q)) tags.add("export");
  if (/(撤销|undo|回退)/i.test(q)) tags.add("undo");
  if (/(重做|redo|恢复)/i.test(q)) tags.add("redo");
  return Array.from(tags);
}

const KNOWLEDGE_BASE: ToolKnowledge[] = Object.entries(MARKDOWN_DOCS).map(
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

export function enrichPromptWithTools(
  userInput: string,
  relevantTools: ToolKnowledge[],
  failureHints: FailureHint[] = []
): string {
  if (!relevantTools.length) {
    return `用户请求：${userInput}\n未命中工具知识，按通用策略选择工具。`;
  }
  const sections = relevantTools.map(
    (tool, idx) => `#${idx + 1} ${tool.name}\n${tool.content.trim()}`
  );
  const failureSection =
    failureHints.length > 0
      ? `\n\n以下是历史失败修复经验（优先避免重复犯错）：\n${failureHints
          .map(
            (hint, idx) =>
              `- 案例${idx + 1} 工具=${hint.toolName}\n  用户输入=${hint.userInput}\n  反思=${hint.reflection}`
          )
          .join("\n")}`
      : "";
  return `用户请求：${userInput}\n\n以下是检索到的工具知识，请优先依据它们进行参数填充：\n\n${sections.join(
    "\n\n"
  )}${failureSection}`;
}

export function getKnowledgeBaseNames(): string[] {
  return KNOWLEDGE_BASE.map((k) => k.name);
}
