/**
 * Avatar Generation Tool — HeyGen API integration for AI digital human video.
 * Takes a photo + audio and generates a talking-head video.
 */

import type { Tool } from "./toolRegistry";

const HEYGEN_API_URL = "https://api.heygen.com/v2";

interface HeyGenVideoStatus {
  video_url?: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: { message: string };
}

async function pollHeyGenVideo(videoId: string, apiKey: string, maxWaitMs = 120_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${HEYGEN_API_URL}/video_status.get?video_id=${videoId}`, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    });
    const data = (await res.json()) as { data?: HeyGenVideoStatus };
    if (data.data?.status === "completed" && data.data.video_url) return data.data.video_url;
    if (data.data?.status === "failed") {
      throw new Error(data.data.error?.message ?? "HeyGen 视频生成失败");
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("HeyGen 视频生成超时，请稍后重试。");
}

async function generateHeyGenAvatar(
  photoUrl: string,
  audioUrl: string,
  apiKey: string
): Promise<string> {
  // Create a talking photo video
  const body: Record<string, unknown> = {
    video_inputs: [
      {
        character: {
          type: "talking_photo",
          talking_photo: {
            image_url: photoUrl,
          },
        },
        voice: {
          type: "audio",
          audio_url: audioUrl,
        },
      },
    ],
    dimension: { width: 1080, height: 1920 },  // Vertical video for TikTok/Reels
  };

  const res = await fetch(`${HEYGEN_API_URL}/video/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { data?: { video_id?: string }; error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `HeyGen API 请求失败: ${res.status}`);
  }

  const videoId = data.data?.video_id;
  if (!videoId) throw new Error("HeyGen 未返回 video_id");

  return pollHeyGenVideo(videoId, apiKey);
}

function getHeyGenApiKey(): string | null {
  try {
    const raw = localStorage.getItem("zhiying.aiConfig.v1");
    if (!raw) return null;
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    const heygenKey = cfg.heygenApiKey as string | undefined;
    return heygenKey?.trim() || null;
  } catch {
    return null;
  }
}

export const generateAvatarTool: Tool = {
  name: "generateAvatar",
  description:
    "使用 AI 数字人技术，将用户照片和语音合成为口播视频。" +
    "需要先在设置中配置 HeyGen API Key。" +
    "输入照片 URL 和音频 URL，返回数字人视频。" +
    "Use when user wants to create a talking-head video from their photo and voice-over.",
  parameters: {
    type: "object",
    properties: {
      photoUrl: {
        type: "string",
        description: "用户照片的 URL 或 data URL（正面清晰照片）。",
      },
      audioUrl: {
        type: "string",
        description: "语音音频的 URL（通常来自 synthesizeSpeech 工具的输出）。",
      },
    },
    required: ["photoUrl", "audioUrl"],
    additionalProperties: false,
  },
  async execute(params) {
    const photoUrl = typeof params.photoUrl === "string" ? params.photoUrl.trim() : "";
    const audioUrl = typeof params.audioUrl === "string" ? params.audioUrl.trim() : "";
    if (!photoUrl || !audioUrl) {
      return { ok: false, errorCode: "BAD_PARAMS", message: "generateAvatar 需要 photoUrl 和 audioUrl 参数。" };
    }

    const apiKey = getHeyGenApiKey();
    if (!apiKey) {
      return {
        ok: false,
        errorCode: "NO_HEYGEN_KEY",
        message:
          "未配置 HeyGen API Key。请在设置 → AI 配置中添加 HeyGen API Key。" +
          "获取方式：前往 https://app.heygen.com 注册并获取 API Key。",
      };
    }

    try {
      const videoUrl = await generateHeyGenAvatar(photoUrl, audioUrl, apiKey);
      return {
        ok: true,
        message: "数字人口播视频已生成。",
        data: { videoUrl, provider: "heygen" },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "数字人生成失败";
      return { ok: false, errorCode: "AVATAR_FAILED", message: msg };
    }
  },
};
