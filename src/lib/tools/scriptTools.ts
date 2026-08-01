/**
 * Script Generation Tools — AI-powered script writing for knowledge videos.
 */

import type { Tool } from "./toolRegistry";
import { askLLM } from "../agent/llmAgent";

export const generateScriptTool: Tool = {
  name: "generateScript",
  description:
    "根据话题和研究资料，生成专业的保险/金融/移民知识口播脚本。输出包含标题、正文、字幕段落和时长估算。" +
    "Use before synthesizeSpeech — generates the script that will be spoken by the digital avatar.",
  parameters: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "视频主题，例如'重疾险和百万医疗险的区别'",
      },
      research: {
        type: "string",
        description: "来自 searchWeb 的研究资料（可选但推荐，确保内容准确）",
      },
      tone: {
        type: "string",
        enum: ["professional", "friendly", "authoritative", "simple"],
        description: "语气风格：professional=专业严谨, friendly=亲切易懂, authoritative=权威可信, simple=简单直白",
        default: "friendly",
      },
      duration: {
        type: "number",
        description: "目标视频时长（秒），默认60秒",
        default: 60,
      },
      audienceNotes: {
        type: "string",
        description: "目标受众备注（可选），例如'面向30-45岁家庭主妇'",
      },
    },
    required: ["topic"],
    additionalProperties: false,
  },
  async execute(params) {
    const topic = typeof params.topic === "string" ? params.topic.trim() : "";
    if (!topic) return { ok: false, errorCode: "BAD_PARAMS", message: "generateScript 需要 topic 参数。" };

    const research = typeof params.research === "string" ? params.research.trim() : "";
    const tone = ["professional", "friendly", "authoritative", "simple"].includes(
      String(params.tone)
    ) ? params.tone as string : "friendly";
    const duration = typeof params.duration === "number" && params.duration > 0 ? params.duration : 60;
    const audienceNotes = typeof params.audienceNotes === "string" ? params.audienceNotes.trim() : "";

    const toneMap: Record<string, string> = {
      professional: "专业严谨，用词准确，逻辑清晰",
      friendly: "亲切易懂，像朋友聊天一样自然",
      authoritative: "权威可信，引用数据和法规，有说服力",
      simple: "简单直白，用大白话解释复杂概念",
    };

    const prompt = `你是一位资深的保险/金融内容创作者。请根据以下信息生成一段${duration}秒的口播视频脚本。

【话题】${topic}
${research ? `【研究资料】${research}` : ""}
${audienceNotes ? `【目标受众】${audienceNotes}` : ""}
【语气要求】${toneMap[tone] ?? toneMap.friendly}

请按以下格式输出：

## 标题
（吸引人的视频标题，15字以内）

## 正文脚本
（完整的口播台词，自然口语化，适合朗读）

## 字幕分段
（将脚本分为 3-5 条字幕，每条标注起止时间点，格式如：0-5s: 字幕文字）

## 话题标签
（3-5个适合发布到抖音/视频号的标签）`;

    try {
      const result = await askLLM(prompt, {});
      const scriptContent = result.message || "";

      // Parse the response into structured fields
      const titleMatch = scriptContent.match(/##\s*标题\s*\n(.+)/);
      const bodyMatch = scriptContent.match(/##\s*正文脚本\s*\n([\s\S]*?)(?=\n##\s*字幕分段|$)/);
      const subtitlesMatch = scriptContent.match(/##\s*字幕分段\s*\n([\s\S]*?)(?=\n##\s*话题标签|$)/);
      const tagsMatch = scriptContent.match(/##\s*话题标签\s*\n([\s\S]*?)$/);

      const title = titleMatch?.[1]?.trim() || topic;
      const body = bodyMatch?.[1]?.trim() || scriptContent;
      const tags = tagsMatch?.[1]
        ?.split(/[#\n]/)
        .map((t: string) => t.trim())
        .filter(Boolean) ?? [];

      const estimatedDuration = body.length / 4.5; // Chinese chars per second

      return {
        ok: true,
        message:
          `脚本已生成："${title}"（约 ${Math.ceil(estimatedDuration)} 秒，${body.length} 字）。` +
          `可将 data.script 传给 synthesizeSpeech 生成语音。`,
        data: {
          title,
          script: body,
          subtitlesRaw: subtitlesMatch?.[1]?.trim() || "",
          tags,
          estimatedDuration: Math.ceil(estimatedDuration),
          charCount: body.length,
          tone,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "脚本生成失败";
      return { ok: false, errorCode: "SCRIPT_FAILED", message: msg };
    }
  },
};

export const previewScriptTool: Tool = {
  name: "previewScript",
  description:
    "预览脚本文字稿，不生成视频。快速查看脚本内容后再决定是否继续制作。" +
    "Use when user wants to review the script before committing to video generation.",
  parameters: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "视频话题",
      },
      script: {
        type: "string",
        description: "要预览的脚本全文",
      },
    },
    additionalProperties: false,
  },
  async execute(params) {
    const topic = typeof params.topic === "string" ? params.topic.trim() : "未命名话题";
    const script = typeof params.script === "string" ? params.script.trim() : "";
    if (!script) return { ok: false, errorCode: "BAD_PARAMS", message: "previewScript 需要 script 参数。" };
    return {
      ok: true,
      message: `📝 脚本预览（${topic}）：\n\n${script}\n\n---\n约 ${Math.ceil(script.length / 4.5)} 秒 | ${script.length} 字`,
      data: { topic, script },
    };
  },
};
