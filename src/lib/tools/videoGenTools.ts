/**
 * Video Generation Tools — Text-to-video via AI APIs.
 * All external requests go through Vite proxy (/proxy/*) to bypass browser CORS.
 */

import type { Tool } from "./toolRegistry";

// ── Config ────────────────────────────────────────────────────────────

interface VideoCreds {
  key: string;
  provider: "runway" | "fal" | "replicate" | "dashscope";
  region?: "beijing" | "singapore";
}

function getCreds(): VideoCreds | null {
  try {
    const raw = localStorage.getItem("zhiying.aiConfig.v1");
    if (!raw) return null;
    const cfg = JSON.parse(raw) as Record<string, string>;
    const pref = cfg.videoGenProvider || "fal";
    const region = (cfg.videoGenRegion as "beijing" | "singapore") || "beijing";

    if (pref === "runway" && cfg.runwayApiKey?.trim())
      return { key: cfg.runwayApiKey.trim(), provider: "runway" };
    if (pref === "fal" && cfg.falApiKey?.trim())
      return { key: cfg.falApiKey.trim(), provider: "fal" };
    if (pref === "cogvideo" && cfg.replicateApiKey?.trim())
      return { key: cfg.replicateApiKey.trim(), provider: "replicate" };
    if (pref === "tongyi" && cfg.dashscopeApiKey?.trim())
      return { key: cfg.dashscopeApiKey.trim(), provider: "dashscope", region };

    // Fallback: use whichever key exists
    if (cfg.falApiKey?.trim()) return { key: cfg.falApiKey.trim(), provider: "fal" };
    if (cfg.dashscopeApiKey?.trim())
      return { key: cfg.dashscopeApiKey.trim(), provider: "dashscope", region };
    if (cfg.replicateApiKey?.trim())
      return { key: cfg.replicateApiKey.trim(), provider: "replicate" };
    if (cfg.runwayApiKey?.trim()) return { key: cfg.runwayApiKey.trim(), provider: "runway" };
    return null;
  } catch {
    return null;
  }
}

// ── fal.ai (wan-t2v — no special access required) ────────────────────

async function genFal(prompt: string, key: string, duration: number): Promise<string> {
  const model = "fal-ai/wan-t2v";

  // Submit to async queue
  const r = await fetch(`/proxy/fal-queue/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
    body: JSON.stringify({
      prompt,
      num_seconds: Math.min(Math.max(1, duration), 10),
      resolution: "480p",
      aspect_ratio: "9:16",
    }),
  });
  const j = (await r.json()) as { request_id?: string; detail?: string; error?: string };
  if (!r.ok) throw new Error(j.detail || j.error || `fal HTTP ${r.status}`);
  const rid = j.request_id;
  if (!rid) throw new Error("fal: no request_id returned");

  // Poll status
  const start = Date.now();
  while (Date.now() - start < 300_000) {
    await new Promise((res) => setTimeout(res, 5000));
    const sr = await fetch(`/proxy/fal-queue/${model}/requests/${rid}/status`, {
      headers: { Authorization: `Key ${key}` },
    });
    const sd = (await sr.json()) as { status?: string; detail?: string };
    if (sd.status === "COMPLETED") break;
    if (sd.status === "FAILED") throw new Error(sd.detail || "fal generation failed");
  }

  // Fetch result
  const rr = await fetch(`/proxy/fal-queue/${model}/requests/${rid}`, {
    headers: { Authorization: `Key ${key}` },
  });
  const rd = (await rr.json()) as { video?: { url?: string }; detail?: string };
  if (!rr.ok || !rd.video?.url) throw new Error(rd.detail || "fal: no video URL in result");
  return rd.video.url;
}

// ── DashScope / Tongyi Wanxiang ───────────────────────────────────────

async function genDashscope(prompt: string, key: string, region: "beijing" | "singapore" = "beijing"): Promise<string> {
  const base = region === "singapore" ? "/proxy/dashscope-intl" : "/proxy/dashscope";

  const r = await fetch(`${base}/api/v1/services/aigc/video-generation/video-synthesis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: "wan2.7-t2v",
      input: { prompt },
      parameters: { resolution: "720P", aspect_ratio: "9:16", duration: 5 },
    }),
  });
  const j = (await r.json()) as {
    output?: { task_id?: string; task_status?: string; video_url?: string; message?: string };
    code?: string;
    message?: string;
  };
  if (!r.ok || j.code) throw new Error(j.message || j.code || `DashScope HTTP ${r.status}`);
  const tid = j.output?.task_id;
  if (!tid) throw new Error("DashScope: no task_id returned");

  const start = Date.now();
  while (Date.now() - start < 360_000) {
    await new Promise((res) => setTimeout(res, 6000));
    const pr = await fetch(`${base}/api/v1/tasks/${tid}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const pd = (await pr.json()) as {
      output?: { task_status?: string; video_url?: string; message?: string };
    };
    const st = pd.output?.task_status;
    if (st === "SUCCEEDED") {
      const url = pd.output?.video_url;
      if (!url) throw new Error("DashScope: task succeeded but no video_url");
      return url;
    }
    if (st === "FAILED") throw new Error(pd.output?.message || "DashScope task failed");
  }
  throw new Error("DashScope: timeout (6min)");
}

// ── Replicate (CogVideoX-2b) ──────────────────────────────────────────

async function genReplicate(prompt: string, key: string, duration: number): Promise<string> {
  const r = await fetch("/proxy/replicate/v1/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${key}` },
    body: JSON.stringify({
      model: "THUDM/CogVideoX-2b",
      input: {
        prompt,
        num_frames: Math.min(duration * 8, 49),
        fps: 8,
      },
    }),
  });
  const j = (await r.json()) as { id?: string; detail?: string };
  if (!r.ok || !j.id) throw new Error(j.detail || `Replicate HTTP ${r.status}`);

  const start = Date.now();
  while (Date.now() - start < 300_000) {
    await new Promise((res) => setTimeout(res, 6000));
    const pr = await fetch(`/proxy/replicate/v1/predictions/${j.id}`, {
      headers: { Authorization: `Token ${key}` },
    });
    const pd = (await pr.json()) as { status?: string; output?: string; error?: string };
    if (pd.status === "succeeded") return pd.output || "";
    if (pd.status === "failed") throw new Error(pd.error || "Replicate task failed");
  }
  throw new Error("Replicate: timeout (5min)");
}

// ── Runway Gen-4 ──────────────────────────────────────────────────────

async function genRunway(prompt: string, key: string, duration: number): Promise<string> {
  const r = await fetch("/proxy/runway/v1/text_to_video", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      promptText: prompt,
      duration: Math.min(duration, 10),
      ratio: "720:1280",
      model: "gen4_turbo",
    }),
  });
  const j = (await r.json()) as { id?: string; error?: string; message?: string };
  if (!r.ok || !j.id) throw new Error(j.error || j.message || `Runway HTTP ${r.status}`);

  const start = Date.now();
  while (Date.now() - start < 600_000) {
    await new Promise((res) => setTimeout(res, 8000));
    const pr = await fetch(`/proxy/runway/v1/tasks/${j.id}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Runway-Version": "2024-11-06",
      },
    });
    const pd = (await pr.json()) as { status?: string; output?: string[]; failure?: string };
    if (pd.status === "SUCCEEDED") return pd.output?.[0] || "";
    if (pd.status === "FAILED") throw new Error(pd.failure || "Runway task failed");
  }
  throw new Error("Runway: timeout (10min)");
}

// ── Tools ─────────────────────────────────────────────────────────────

export const generateStoryboardTool: Tool = {
  name: "generateStoryboard",
  description: "根据口播脚本生成分镜脚本，将文字内容拆分为多个视频镜头描述。",
  parameters: {
    type: "object",
    properties: {
      script: { type: "string", description: "完整的口播脚本文本" },
      topic: { type: "string", description: "视频主题" },
      sceneCount: { type: "number", description: "期望的镜头数", default: 4 },
    },
    required: ["script", "topic"],
    additionalProperties: false,
  },
  async execute(params) {
    const script = typeof params.script === "string" ? params.script.trim() : "";
    const topic = typeof params.topic === "string" ? params.topic.trim() : "";
    if (!script) return { ok: false, errorCode: "BAD_PARAMS", message: "需要 script 参数。" };

    // NarratoAI approach: Chinese speech ≈ 2.5 chars/sec → duration from text length
    // Cap each clip at 7s (API limits) and floor at 5s for visual quality
    const CHARS_PER_SEC = 2.5;
    const MAX_CLIP_SEC = 7;
    const MIN_CLIP_SEC = 5;

    const sentences = script
      .split(/[。！？\n]/)   // split on sentence boundaries only (not commas)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    const count = Math.min(3, Math.max(2, sentences.length)); // max 3 scenes for cost
    const per = Math.ceil(sentences.length / count);

    // Style anchor: same visual language across all scenes → Showvi consistency trick
    const STYLE_ANCHOR = "cinematic vertical 9:16, warm studio lighting, professional insurance advisor, clean modern office, shallow depth of field, no text no subtitles no watermark";

    // Scene-specific B-roll visuals (pure visual, no text descriptions)
    const sceneVisuals = [
      `Confident professional advisor sits at desk facing camera, ${STYLE_ANCHOR}`,
      `Close-up hands arranging insurance policy documents on wooden desk, ${STYLE_ANCHOR}`,
      `Advisor gestures naturally while explaining, eye contact with camera, ${STYLE_ANCHOR}`,
      `Split-screen charts and smiling advisor, infographic style, ${STYLE_ANCHOR}`,
      `Advisor and client shaking hands across desk, trust moment, ${STYLE_ANCHOR}`,
    ];

    const scenes: Array<{ index: number; text: string; prompt: string; duration: number }> = [];
    for (let i = 0; i < count; i++) {
      const sents = sentences.slice(i * per, (i + 1) * per);
      const text = sents.join("。");
      // Duration = how long it takes to say the text at natural speech rate
      const speechDuration = Math.ceil(text.length / CHARS_PER_SEC);
      const clipDuration = Math.min(MAX_CLIP_SEC, Math.max(MIN_CLIP_SEC, speechDuration));
      scenes.push({
        index: i + 1,
        text,
        prompt: sceneVisuals[i % sceneVisuals.length]!,
        duration: clipDuration,
      });
    }
    return { ok: true, message: `已生成 ${scenes.length} 个镜头（共 ${scenes.reduce((s, sc) => s + sc.duration, 0)} 秒）。`, data: { scenes, topic } };
  },
};

export const generateVideoClipTool: Tool = {
  name: "generateVideoClip",
  description: "文生视频：将文字描述生成 AI 视频片段。支持 fal.ai / DashScope / Replicate / Runway。",
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "视频画面描述（英文效果更好）" },
      duration: { type: "number", description: "时长（秒），建议 5", default: 5 },
    },
    required: ["prompt"],
    additionalProperties: false,
  },
  async execute(params) {
    const prompt = typeof params.prompt === "string" ? params.prompt.trim() : "";
    if (!prompt) return { ok: false, errorCode: "BAD_PARAMS", message: "需要 prompt。" };
    const dur = typeof params.duration === "number" ? Math.min(10, Math.max(2, params.duration)) : 5;

    const creds = getCreds();
    if (!creds) {
      return {
        ok: false,
        errorCode: "NO_KEY",
        message:
          "未配置视频生成 API Key。\n" +
          "请在 设置 → AI配置 → 视频生成API 中选择提供商并填入 Key：\n" +
          "• fal.ai（推荐）：fal.ai 注册后在控制台获取 Key，免费有额度\n" +
          "• 通义万相：dashscope.aliyuncs.com 申请\n" +
          "• Runway：app.runwayml.com 订阅后获取",
      };
    }

    try {
      let url: string;
      if (creds.provider === "fal") {
        url = await genFal(prompt, creds.key, dur);
      } else if (creds.provider === "dashscope") {
        url = await genDashscope(prompt, creds.key, creds.region);
      } else if (creds.provider === "replicate") {
        url = await genReplicate(prompt, creds.key, dur);
      } else {
        url = await genRunway(prompt, creds.key, dur);
      }
      return {
        ok: true,
        message: `视频片段已生成（${creds.provider}）。`,
        data: { videoUrl: url, prompt, duration: dur, provider: creds.provider },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成失败";
      return { ok: false, errorCode: "VIDEO_FAIL", message: `[${creds.provider}] ${msg}` };
    }
  },
};
