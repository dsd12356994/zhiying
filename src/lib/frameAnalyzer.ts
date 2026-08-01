/**
 * Frame sampler for vision AI analysis.
 *
 * Extracts JPEG thumbnails at specific timestamps from a video source
 * using the existing VideoDecoder (WebCodecs + <video> fallback).
 * Thumbnails are returned as base64 data-URLs to be sent to vision LLMs.
 */

import { VideoDecoder, type VideoSource } from "./videoDecoder";

export interface FrameSample {
  ts: number;
  dataUrl: string;   // "data:image/jpeg;base64,..."
  width: number;
  height: number;
}

export interface FrameClassification {
  ts: number;
  type: "kill" | "headshot" | "ability" | "running" | "menu" | "respawn" | "other";
  confidence: number;
  note?: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Extract JPEG thumbnail frames at the given timestamps.
 * @param source  Video File, Blob, or blob URL
 * @param timestamps  Seconds to sample (sorted or unsorted, duplicates are ignored)
 * @param thumbWidth  Thumbnail pixel width (height is auto-scaled). Default 480.
 */
export async function sampleFramesAt(
  source: VideoSource,
  timestamps: number[],
  thumbWidth = 480
): Promise<FrameSample[]> {
  if (!timestamps.length) return [];

  const decoder = await VideoDecoder.create(source);
  const duration = decoder.getDuration();

  // Deduplicate and clamp
  const unique = [...new Set(timestamps.map((t) => Math.max(0, Math.min(t, duration))))]
    .sort((a, b) => a - b);

  const samples: FrameSample[] = [];

  for (const ts of unique) {
    try {
      const bitmap = await decoder.getFrameAtTime(ts);
      const aspect = bitmap.height / bitmap.width;
      const w = thumbWidth;
      const h = Math.max(1, Math.round(w * aspect));

      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) { bitmap.close(); continue; }
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();

      const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.75 });
      const dataUrl = await blobToDataUrl(blob);
      samples.push({ ts, dataUrl, width: w, height: h });
    } catch {
      // Skip frames that fail to decode
    }
  }

  decoder.dispose();
  return samples;
}

// ── Vision LLM classifiers ────────────────────────────────────────────────────

const CLASSIFY_PROMPT =
  "This is a frame from a Valorant (FPS) game. " +
  "Classify what is happening in one word: kill, headshot, ability, running, menu, respawn, or other. " +
  "Reply with valid JSON only: {\"type\":\"...\",\"confidence\":0.0-1.0,\"note\":\"...\"}";

interface ProviderCfg { apiKey: string; model: string; apiUrl: string }

function readProviderCfg(): ProviderCfg | null {
  try {
    const raw = localStorage.getItem("zhiying.aiConfig.v1");
    if (!raw) return null;
    const cfg = JSON.parse(raw) as Record<string, unknown>;

    // Use visionProvider if set; otherwise resolve from main provider
    const visionProvider = (cfg.visionProvider as string) || (cfg.provider as string) || "";
    if (!visionProvider || visionProvider === "mock" || visionProvider === "deepseek") return null;

    const p = cfg[visionProvider] as Record<string, string> | undefined;
    if (!p?.apiKey) return null;

    const defaults: Record<string, { model: string; apiUrl: string }> = {
      openai:   { model: "gpt-4o",           apiUrl: "https://api.openai.com/v1/chat/completions" },
      claude:   { model: "claude-sonnet-4-6", apiUrl: "https://api.anthropic.com/v1/messages" },
      zhipu:    { model: "glm-4v-flash",      apiUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions" },
    };

    const d = defaults[visionProvider];
    if (!d) return null;

    return { apiKey: p.apiKey, model: p.model || d.model, apiUrl: p.apiUrl || d.apiUrl };
  } catch {
    return null;
  }
}

function getVisionProviderName(): "openai" | "claude" | "zhipu" | null {
  try {
    const raw = localStorage.getItem("zhiying.aiConfig.v1");
    const cfg = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    const visionProvider = (cfg.visionProvider as string) || (cfg.provider as string) || "";
    if (visionProvider === "openai") return "openai";
    if (visionProvider === "claude") return "claude";
    if (visionProvider === "zhipu") return "zhipu";
    return null;
  } catch { return null; }
}

async function classifyOneOpenAI(sample: FrameSample, cfg: ProviderCfg): Promise<FrameClassification> {
  const body = {
    model: cfg.model,
    max_tokens: 80,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: sample.dataUrl, detail: "low" } },
        { type: "text", text: CLASSIFY_PROMPT },
      ],
    }],
  };
  const res = await fetch(cfg.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseClassification(sample.ts, data.choices?.[0]?.message?.content ?? "");
}

async function classifyOneClaude(sample: FrameSample, cfg: ProviderCfg): Promise<FrameClassification> {
  // Claude expects base64 data without the data: prefix
  const base64 = sample.dataUrl.replace(/^data:image\/jpeg;base64,/, "");
  const body = {
    model: cfg.model,
    max_tokens: 80,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
        { type: "text", text: CLASSIFY_PROMPT },
      ],
    }],
  };
  const res = await fetch(cfg.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((b) => b.type === "text")?.text ?? "";
  return parseClassification(sample.ts, text);
}

function parseClassification(ts: number, raw: string): FrameClassification {
  const VALID_TYPES = ["kill", "headshot", "ability", "running", "menu", "respawn", "other"] as const;
  try {
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw) as {
      type?: string;
      confidence?: number;
      note?: string;
    };
    const type = VALID_TYPES.find((t) => t === json.type) ?? "other";
    return { ts, type, confidence: Number(json.confidence) || 0.5, note: json.note };
  } catch {
    return { ts, type: "other", confidence: 0.1 };
  }
}

/**
 * Classify an array of frame samples using the configured vision LLM.
 * Returns null for each frame that fails or if vision is not available.
 * @param samples  Output from sampleFramesAt
 * @param batchSize  Number of parallel requests (default 4)
 */
export async function classifyFrames(
  samples: FrameSample[],
  batchSize = 4
): Promise<FrameClassification[]> {
  const cfg = readProviderCfg();
  if (!cfg) {
    throw new Error("没有可用的视觉 AI 配置。请在设置中选择 OpenAI、Claude 或智谱并填入 API Key。");
  }

  const provider = getVisionProviderName();
  if (!provider) throw new Error("当前视觉 AI Provider 不可用。请在设置中指定视觉模型（OpenAI/Claude/智谱）并填入 API Key。");

  // claude has its own image format; openai and zhipu share the same OpenAI-compatible vision API
  const classifyOne = provider === "claude"
    ? (s: FrameSample) => classifyOneClaude(s, cfg)
    : (s: FrameSample) => classifyOneOpenAI(s, cfg);

  const results: FrameClassification[] = [];

  for (let i = 0; i < samples.length; i += batchSize) {
    const batch = samples.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(classifyOne));
    for (const r of settled) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }

  return results;
}
