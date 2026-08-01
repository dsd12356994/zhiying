/**
 * Web Search Tool — wraps the browser's fetch to search for insurance/finance knowledge.
 * Used by the agent as a tool call to research topics before script generation.
 */

import type { Tool } from "./toolRegistry";

// Simple search via DuckDuckGo HTML (no API key needed)
async function duckduckgoSearch(query: string): Promise<Array<{ title: string; snippet: string; url: string }>> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const html = await res.text();
    const results: Array<{ title: string; snippet: string; url: string }> = [];

    // Parse result blocks
    const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]+)">([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]+)<\/a>/g;
    let match;
    let count = 0;
    while ((match = resultRegex.exec(html)) !== null && count < 5) {
      const url = match[1] ? match[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, "") : "";
      const decodedUrl = decodeURIComponent(url || match[1] || "");
      results.push({
        title: match[2]?.replace(/<[^>]+>/g, "").trim() || "",
        snippet: match[3]?.replace(/<[^>]+>/g, "").trim() || "",
        url: decodedUrl,
      });
      count++;
    }
    return results;
  } catch {
    return [];
  }
}

export const searchWebTool: Tool = {
  name: "searchWeb",
  description:
    "搜索互联网获取保险、金融、移民等专业知识。返回权威信息源、数据和研究结果。" +
    "在生成脚本之前调用此工具，确保内容准确可靠。" +
    "Use when user asks about insurance policies, financial planning, immigration rules, etc.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索关键词，例如'重疾险和百万医疗险的区别 2024'",
      },
      maxResults: {
        type: "number",
        description: "最多返回几条结果（默认5条）",
        default: 5,
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  async execute(params) {
    const query = typeof params.query === "string" ? params.query.trim() : "";
    if (!query) return { ok: false, errorCode: "BAD_PARAMS", message: "searchWeb 需要 query 参数。" };

    const results = await duckduckgoSearch(query);
    if (!results.length) {
      return { ok: false, errorCode: "NO_RESULTS", message: `未找到关于"${query}"的搜索结果。` };
    }

    const summary = results
      .map((r, i) => `${i + 1}. **${r.title}** — ${r.snippet}\n   来源: ${r.url}`)
      .join("\n\n");

    return {
      ok: true,
      message: `已搜索到 ${results.length} 条关于"${query}"的结果。`,
      data: { query, results, summary },
    };
  },
};
