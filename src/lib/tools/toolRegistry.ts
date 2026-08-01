import { useEditorStore } from "../../stores/editor-store";
import { exportAndDownload } from "../videoExporter";
import { FILTER_PRESETS, type FilterName } from "../filters";
import { searchWebTool } from "./searchTools";
import { synthesizeSpeechTool } from "./speechTools";
import { generateAvatarTool } from "./avatarTools";
import { generateScriptTool, previewScriptTool } from "./scriptTools";
import { generateStoryboardTool, generateVideoClipTool } from "./videoGenTools";

export type JsonSchema = Record<string, unknown>;

export interface ToolContext {
  store: ReturnType<typeof useEditorStore.getState>;
}

export interface ToolResult {
  ok: boolean;
  message: string;
  data?: unknown;
  errorCode?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: JsonSchema;
  execute: (params: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface LlmToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

const ensureNumber = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const ensureString = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const FILTER_NAMES = FILTER_PRESETS.map((f) => f.name);
const TRANSITION_TYPES = ["crossDissolve", "slide", "wipe", "fade"] as const;

function ensureFilterName(v: unknown): FilterName | null {
  if (typeof v !== "string") return null;
  if ((FILTER_NAMES as string[]).includes(v)) return v as FilterName;
  return null;
}

const badParams = (message: string): ToolResult => ({
  ok: false,
  errorCode: "BAD_PARAMS",
  message,
});

function resolveClipId(
  store: ReturnType<typeof useEditorStore.getState>,
  params: Record<string, unknown>
): string | null {
  const directId = ensureString(params.clipId);
  if (directId) return directId;

  const clipIndex = ensureNumber(params.clipIndex);
  if (clipIndex !== null) {
    const sorted = [...store.clips].sort((a, b) => a.start - b.start);
    const idx = Math.max(0, Math.floor(clipIndex) - 1);
    return sorted[idx]?.id ?? null;
  }

  return store.selectedClipId ?? store.clips[0]?.id ?? null;
}

// ── Editing Tools ──────────────────────────────────────────────────────

const editingTools: Tool[] = [
  {
    name: "splitAtPlayhead",
    description: "在播放头位置分割当前选中的片段。",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_params, { store }) {
      const ok = store.splitAtPlayhead();
      return ok
        ? { ok: true, message: `已在播放头 ${store.currentTime.toFixed(2)}s 处分割。` }
        : { ok: false, errorCode: "SPLIT_FAILED", message: "分割失败，请把播放头放到片段内部。" };
    },
  },
  {
    name: "splitClip",
    description: "在指定时间点分割时间轴片段。",
    parameters: {
      type: "object",
      properties: { clipId: { type: "string" }, time: { type: "number", description: "分割时间（秒）" } },
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可分割的片段。" };
      const time = ensureNumber(params.time) ?? store.currentTime;
      const ok = store.splitClipAt(time, clipId);
      return ok
        ? { ok: true, message: `已在 ${time.toFixed(2)}s 处分割片段。` }
        : { ok: false, errorCode: "SPLIT_FAILED", message: "分割失败。" };
    },
  },
  {
    name: "trimTo",
    description: "裁剪当前片段到目标结束时间。",
    parameters: {
      type: "object",
      properties: { seconds: { type: "number" } },
      required: ["seconds"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const seconds = ensureNumber(params.seconds) ?? ensureNumber(params.time);
      if (seconds === null) return badParams("trimTo 需要 seconds(number) 参数。");
      const ok = store.trimTo(seconds);
      return ok
        ? { ok: true, message: `已裁剪到 ${seconds.toFixed(2)}s。` }
        : { ok: false, errorCode: "TRIM_TO_FAILED", message: "trimTo 失败。" };
    },
  },
  {
    name: "trimLast",
    description: "删除当前片段最后 N 秒。",
    parameters: {
      type: "object",
      properties: { seconds: { type: "number" } },
      required: ["seconds"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const seconds = ensureNumber(params.seconds) ?? ensureNumber(params.time);
      if (seconds === null) return badParams("trimLast 需要 seconds(number) 参数。");
      const ok = store.trimLast(seconds);
      return ok
        ? { ok: true, message: `已删除最后 ${seconds.toFixed(2)}s。` }
        : { ok: false, errorCode: "TRIM_LAST_FAILED", message: "trimLast 失败。" };
    },
  },
  {
    name: "trimClip",
    description: "裁剪片段边缘到目标时间。",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string" },
        edge: { type: "string", enum: ["start", "end"] },
        time: { type: "number" },
      },
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可裁剪的片段。" };
      const edgeRaw = params.edge === "start" ? "start" : "end";
      const time = ensureNumber(params.time) ?? ensureNumber(params.seconds);
      if (time === null) return badParams("trimClip 需要 time(number) 参数。");
      const ok = store.trimClipEdge(clipId, edgeRaw, time);
      return ok
        ? { ok: true, message: `已裁剪片段${edgeRaw === "start" ? "起点" : "终点"}到 ${time.toFixed(2)}s。` }
        : { ok: false, errorCode: "TRIM_FAILED", message: "裁剪失败。" };
    },
  },
  {
    name: "deleteClip",
    description: "从时间轴删除指定片段。",
    parameters: {
      type: "object",
      properties: { clipId: { type: "string" }, clipIndex: { type: "number" }, ripple: { type: "boolean" } },
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可删除的片段。" };
      const ripple = Boolean(params.ripple);
      const ok = ripple ? store.removeClipAndRipple(clipId) : store.removeClip(clipId);
      return ok
        ? { ok: true, message: ripple ? "已删除片段并闭合间隙。" : "已删除片段。" }
        : { ok: false, errorCode: "DELETE_FAILED", message: "删除失败。" };
    },
  },
  {
    name: "removeRange",
    description: "删除时间轴上指定时间范围内的内容。",
    parameters: {
      type: "object",
      properties: { start: { type: "number" }, end: { type: "number" }, ripple: { type: "boolean", default: true } },
      required: ["start", "end"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const start = ensureNumber(params.start);
      const end = ensureNumber(params.end);
      if (start === null || end === null) return badParams("removeRange 需要 start 和 end 参数。");
      const ripple = params.ripple === undefined ? true : Boolean(params.ripple);
      const s = Math.min(start, end);
      const e = Math.max(start, end);
      const ok = store.removeRange(s, e, ripple);
      return ok
        ? { ok: true, message: `已删除 ${s.toFixed(2)}s-${e.toFixed(2)}s。` }
        : { ok: false, errorCode: "REMOVE_RANGE_FAILED", message: "删除区间失败。" };
    },
  },
  {
    name: "moveClip",
    description: "移动片段到新的时间轴位置。",
    parameters: {
      type: "object",
      properties: { clipId: { type: "string" }, start: { type: "number" }, trackIndex: { type: "number" } },
      required: ["start"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可移动的片段。" };
      const start = ensureNumber(params.start);
      if (start === null) return badParams("moveClip 需要 start(number) 参数。");
      const clip = store.clips.find((c) => c.id === clipId);
      if (!clip) return { ok: false, errorCode: "NOT_FOUND", message: "目标片段不存在。" };
      const len = clip.end - clip.start;
      const trackIndexRaw = ensureNumber(params.trackIndex);
      const ok = store.updateClip(clipId, {
        start,
        end: start + len,
        trackIndex: trackIndexRaw === null ? clip.trackIndex : Math.max(0, Math.floor(trackIndexRaw)),
      });
      return ok
        ? { ok: true, message: `已移动片段到 ${start.toFixed(2)}s。` }
        : { ok: false, errorCode: "MOVE_FAILED", message: "移动失败。" };
    },
  },
];

// ── Query Tools ────────────────────────────────────────────────────────

const queryTools: Tool[] = [
  {
    name: "getTimelineInfo",
    description: "获取时间轴上所有片段的信息。",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_params, { store }) {
      const clips = store.clips.map((c) => ({ id: c.id, start: c.start, end: c.end, track: c.trackIndex }));
      return { ok: true, message: `时间轴共 ${clips.length} 个片段。`, data: { clips } };
    },
  },
  {
    name: "getClipDetails",
    description: "获取单个片段的详细信息。",
    parameters: {
      type: "object",
      properties: { clipId: { type: "string" }, clipIndex: { type: "number" } },
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可查询的片段。" };
      const clip = store.clips.find((c) => c.id === clipId);
      if (!clip) return { ok: false, errorCode: "NOT_FOUND", message: "片段不存在。" };
      return {
        ok: true,
        message: "已获取片段详情。",
        data: { id: clip.id, type: clip.type, start: clip.start, end: clip.end, trackIndex: clip.trackIndex, speed: clip.speed ?? 1, filter: clip.filter ?? null },
      };
    },
  },
  {
    name: "listTransitions",
    description: "列出时间轴上的所有转场。",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_params, { store }) {
      const transitions = store.transitions.map((t) => ({ id: t.id, fromClipId: t.fromClipId, toClipId: t.toClipId, type: t.type, duration: t.duration }));
      return { ok: true, message: `当前共 ${transitions.length} 个转场。`, data: { transitions } };
    },
  },
];

// ── Effect Tools ───────────────────────────────────────────────────────

const effectTools: Tool[] = [
  {
    name: "applyFilter",
    description: "给视频片段添加画面滤镜。",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string" }, clipIndex: { type: "number" },
        filterName: { type: "string", enum: FILTER_NAMES },
        intensity: { type: "number", minimum: 0, maximum: 1, default: 1 },
      },
      required: ["filterName"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可应用滤镜的片段。" };
      const filterName = ensureFilterName(params.filterName);
      if (!filterName) return badParams("applyFilter 需要有效 filterName。");
      const intensity = Math.max(0, Math.min(1, ensureNumber(params.intensity) ?? 1));
      const ok = store.applyFilter(clipId, filterName, intensity);
      return ok
        ? { ok: true, message: `已应用 ${filterName} 滤镜。` }
        : { ok: false, errorCode: "APPLY_FILTER_FAILED", message: "滤镜应用失败。" };
    },
  },
  {
    name: "addTransition",
    description: "在两个片段之间添加转场效果。",
    parameters: {
      type: "object",
      properties: {
        fromClipId: { type: "string" }, toClipId: { type: "string" },
        fromClipIndex: { type: "number" }, toClipIndex: { type: "number" },
        type: { type: "string", enum: TRANSITION_TYPES },
        duration: { type: "number", default: 1, minimum: 0.1, maximum: 2 },
      },
      required: ["type"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const sorted = [...store.clips].sort((a, b) => a.start - b.start);
      const fromClipId = ensureString(params.fromClipId) ??
        (ensureNumber(params.fromClipIndex) !== null
          ? sorted[Math.max(0, Math.floor(ensureNumber(params.fromClipIndex)! - 1))]?.id
          : store.selectedClipId ?? sorted[0]?.id);
      if (!fromClipId) return { ok: false, errorCode: "NO_CLIP", message: "未找到起始片段。" };
      const fromClip = store.clips.find((c) => c.id === fromClipId);
      const autoTo = store.clips.filter((c) => fromClip && c.trackIndex === fromClip.trackIndex && c.start >= fromClip.end - 0.0001 && c.id !== fromClip.id).sort((a, b) => a.start - b.start)[0]?.id ?? null;
      const toClipId = ensureString(params.toClipId) ??
        (ensureNumber(params.toClipIndex) !== null
          ? sorted[Math.max(0, Math.floor(ensureNumber(params.toClipIndex)! - 1))]?.id
          : autoTo);
      if (!toClipId) return { ok: false, errorCode: "NO_TARGET_CLIP", message: "未找到目标片段。" };
      const typeRaw = ensureString(params.type);
      const type = TRANSITION_TYPES.find((t) => t === typeRaw);
      if (!type) return badParams("addTransition 需要有效 type。");
      const duration = Math.max(0.1, Math.min(2, ensureNumber(params.duration) ?? 1));
      const id = store.addTransition({ fromClipId, toClipId, type, duration });
      return id
        ? { ok: true, message: `已添加 ${type} 转场。` }
        : { ok: false, errorCode: "ADD_TRANSITION_FAILED", message: "转场添加失败。" };
    },
  },
  {
    name: "addText",
    description: "在时间轴上添加文字/字幕。",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string" }, start: { type: "number" }, end: { type: "number" },
        fontSize: { type: "number", default: 36 }, color: { type: "string", default: "#ffffff" },
      },
      required: ["content", "start", "end"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const content = ensureString(params.content);
      const start = ensureNumber(params.start);
      const end = ensureNumber(params.end);
      if (!content || start === null || end === null) return badParams("addText 需要 content, start, end。");
      const fontSize = ensureNumber(params.fontSize) ?? 36;
      const color = ensureString(params.color) ?? "#ffffff";
      const id = store.addTextClip(content, start, end, fontSize, color);
      return id
        ? { ok: true, message: `已添加字幕"${content}"。` }
        : { ok: false, errorCode: "ADD_TEXT_FAILED", message: "字幕添加失败。" };
    },
  },
  {
    name: "changeSpeed",
    description: "调整视频片段的播放速度。",
    parameters: {
      type: "object",
      properties: { clipId: { type: "string" }, clipIndex: { type: "number" }, speed: { type: "number", minimum: 0.1, maximum: 10 } },
      required: ["speed"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const speed = ensureNumber(params.speed);
      if (speed === null) return badParams("changeSpeed 需要 speed 参数。");
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可变速的片段。" };
      const ok = store.setClipSpeed(clipId, Math.max(0.1, Math.min(10, speed)));
      return ok
        ? { ok: true, message: `已将速度设为 ${speed.toFixed(2)}x。` }
        : { ok: false, errorCode: "CHANGE_SPEED_FAILED", message: "变速失败。" };
    },
  },
  {
    name: "addKeyframe",
    description: "给片段添加动画关键帧。",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string" },
        property: { type: "string", enum: ["x", "y", "scale", "rotation", "opacity"] },
        time: { type: "number" }, value: { type: "number" },
        easing: { type: "string", enum: ["linear", "easeInOut", "bounce"], default: "linear" },
      },
      required: ["property", "time", "value"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可添加关键帧的片段。" };
      const property = ensureString(params.property);
      const time = ensureNumber(params.time);
      const value = ensureNumber(params.value);
      if (!property || time === null || value === null) return badParams("addKeyframe 需要 property/time/value。");
      const easing = (["linear", "easeInOut", "bounce"].includes(ensureString(params.easing) ?? "") ? ensureString(params.easing)! : "linear") as "linear" | "easeInOut" | "bounce";
      const ok = store.addKeyframe(clipId, property as "x" | "y" | "scale" | "rotation" | "opacity", time, value, easing);
      return ok
        ? { ok: true, message: `已添加关键帧 ${property} @${time.toFixed(2)}s。` }
        : { ok: false, errorCode: "ADD_KEYFRAME_FAILED", message: "关键帧添加失败。" };
    },
  },
];

// ── Audio Tools ────────────────────────────────────────────────────────

const audioTools: Tool[] = [
  {
    name: "setVolume",
    description: "调整片段的播放音量（0=静音, 1=原声）。",
    parameters: {
      type: "object",
      properties: { clipId: { type: "string" }, volume: { type: "number" }, trackIndex: { type: "number" } },
      required: ["volume"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const volume = typeof params.volume === "number" ? params.volume : null;
      if (volume === null || volume < 0 || volume > 2) return badParams("setVolume 需要 0-2 范围的 volume。");
      const clipId = ensureString(params.clipId);
      const trackIndex = typeof params.trackIndex === "number" ? params.trackIndex : null;
      const targets = clipId
        ? store.clips.filter((c) => c.id === clipId)
        : trackIndex !== null ? store.clips.filter((c) => c.trackIndex === trackIndex)
        : store.clips.filter((c) => c.type === "audio" && c.trackIndex === 1);
      if (!targets.length) return { ok: false, errorCode: "NO_TARGET", message: "未找到目标片段。" };
      let count = 0;
      for (const clip of targets) if (store.setClipVolume(clip.id, volume)) count++;
      return { ok: true, message: `已将 ${count} 个片段的音量设为 ${Math.round(volume * 100)}%。` };
    },
  },
  {
    name: "muteClip",
    description: "静音/取消静音片段或轨道。",
    parameters: {
      type: "object",
      properties: { clipId: { type: "string" }, muted: { type: "boolean" }, trackIndex: { type: "number" } },
      required: ["muted"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const muted = typeof params.muted === "boolean" ? params.muted : null;
      if (muted === null) return badParams("muteClip 需要 muted 布尔值。");
      const clipId = ensureString(params.clipId);
      const trackIndex = typeof params.trackIndex === "number" ? params.trackIndex : null;
      const targets = clipId
        ? store.clips.filter((c) => c.id === clipId)
        : trackIndex !== null ? store.clips.filter((c) => c.trackIndex === trackIndex)
        : store.clips.filter((c) => c.type === "audio");
      if (!targets.length) return { ok: false, errorCode: "NO_TARGET", message: "未找到目标片段。" };
      let count = 0;
      for (const clip of targets) if (store.setClipMuted(clip.id, muted)) count++;
      return { ok: true, message: `已对 ${count} 个片段${muted ? "静音" : "取消静音"}。` };
    },
  },
];

// ── Knowledge Video Tools (Insurance/Finance) ──────────────────────────

const knowledgeTools: Tool[] = [
  {
    name: "setBranding",
    description: "设置视频品牌元素（水印文字、片头片尾）。Use when user mentions branding, logo, watermark, or contact info.",
    parameters: {
      type: "object",
      properties: {
        watermarkText: { type: "string", description: "水印文字，如'XX保险顾问'" },
        introText: { type: "string", description: "片头文字，如'XX保险知识分享'" },
        outroText: { type: "string", description: "片尾文字，如'扫码咨询'" },
        primaryColor: { type: "string", description: "品牌主色，如'#1a73e8'" },
      },
      additionalProperties: false,
    },
    async execute(params) {
      const branding: Record<string, string> = {};
      const parts: string[] = [];
      if (typeof params.watermarkText === "string" && params.watermarkText.trim()) {
        branding.watermarkText = params.watermarkText.trim(); parts.push(`水印: "${branding.watermarkText}"`);
      }
      if (typeof params.introText === "string" && params.introText.trim()) {
        branding.introText = params.introText.trim(); parts.push(`片头: "${branding.introText}"`);
      }
      if (typeof params.outroText === "string" && params.outroText.trim()) {
        branding.outroText = params.outroText.trim(); parts.push(`片尾: "${branding.outroText}"`);
      }
      if (typeof params.primaryColor === "string" && params.primaryColor.trim()) {
        branding.primaryColor = params.primaryColor.trim(); parts.push(`主色: ${branding.primaryColor}`);
      }
      if (!parts.length) return { ok: false, errorCode: "BAD_PARAMS", message: "setBranding 需要至少一个品牌参数。" };
      return { ok: true, message: `品牌设置已保存：${parts.join("、")}。`, data: { branding } };
    },
  },
  {
    name: "composeVideo",
    description:
      "合成最终知识分享视频：将数字人视频、字幕、品牌水印和片头片尾组合为完整竖版视频。" +
      "Use after generateAvatar — combines all assets.",
    parameters: {
      type: "object",
      properties: {
        avatarVideoUrl: { type: "string", description: "数字人视频 URL（来自 generateAvatar）" },
        subtitles: { type: "array", description: "字幕列表 [{text, start, end}]", items: { type: "object" } },
        branding: { type: "object", description: "品牌设置（来自 setBranding）" },
        bgmUrl: { type: "string", description: "背景音乐 URL（可选）" },
      },
      required: ["avatarVideoUrl"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const avatarUrl = typeof params.avatarVideoUrl === "string" ? params.avatarVideoUrl.trim() : "";
      if (!avatarUrl) return { ok: false, errorCode: "BAD_PARAMS", message: "composeVideo 需要 avatarVideoUrl。" };

      // Don't add video clip — initializeClips already placed it on the timeline.
      // Just compute actual timeline end from existing clips.
      const steps: string[] = [];
      const existingVideoEnd = store.clips.filter(c => c.type === "video").sort((a, b) => b.end - a.end)[0]?.end ?? 8;

      const rawSubtitles = params.subtitles;
      if (Array.isArray(rawSubtitles)) {
        let c = 0;
        for (const sub of rawSubtitles) {
          if (typeof sub === "object" && sub && typeof (sub as Record<string, unknown>).text === "string") {
            const s = sub as Record<string, unknown>;
            const st = typeof s.start === "number" ? Math.min(s.start, existingVideoEnd - 1) : 0;
            const en = typeof s.end === "number" ? Math.min(s.end, existingVideoEnd) : Math.min(st + 3, existingVideoEnd);
            if (en > st) { store.addTextClip(String(s.text), st, en, 36, "#ffffff"); c++; }
          }
        }
        if (c) steps.push(`已添加 ${c} 条字幕`);
      }

      const branding = params.branding as Record<string, string> | undefined;
      if (branding?.introText) {
        const introEnd = Math.min(3, existingVideoEnd);
        store.addTextClip(branding.introText, 0, introEnd, 42, branding.primaryColor ?? "#ffffff");
        steps.push("已添加片头");
      }
      if (branding?.watermarkText) {
        store.addTextClip(branding.watermarkText, 1, existingVideoEnd, 22, "rgba(255,255,255,0.45)");
        steps.push("已添加水印");
      }
      if (branding?.outroText) {
        const outroStart = Math.max(0, existingVideoEnd - 3);
        store.addTextClip(branding.outroText, outroStart, existingVideoEnd, 34, branding.primaryColor ?? "#ffffff");
        steps.push("已添加片尾");
      }
      if (typeof params.bgmUrl === "string" && params.bgmUrl.trim()) {
        store.addClip({ type: "audio", src: params.bgmUrl.trim(), name: "BGM", start: 0, end: existingVideoEnd, sourceStart: 0, sourceEnd: existingVideoEnd, trackIndex: 1, volume: 0.3 });
        steps.push("已添加BGM");
      }
      return { ok: true, message: `视频已合成：${steps.join("，")}。`, data: { steps, videoDuration: existingVideoEnd } };
    },
  },
  searchWebTool,
  generateScriptTool,
  previewScriptTool,
  generateStoryboardTool,
  generateVideoClipTool,
  synthesizeSpeechTool,
  generateAvatarTool,
];

// ── Export / Undo / Redo ───────────────────────────────────────────────

const exportUndoTools: Tool[] = [
  {
    name: "exportVideo",
    description: "导出视频并触发下载。",
    parameters: {
      type: "object",
      properties: { filename: { type: "string" } },
      additionalProperties: false,
    },
    async execute(params, { store }) {
      if (!store.videoFile || !store.clips.length) return { ok: false, errorCode: "NO_VIDEO", message: "请先导入视频并创建片段。" };
      const filename = ensureString(params.filename);
      const clips = store.clips.map((c) => ({
        id: c.id, type: c.type, src: c.src, start: c.start, end: c.end,
        sourceStart: c.sourceStart, sourceEnd: c.sourceEnd, speed: c.speed,
        filter: c.filter, content: c.content, fontSize: c.fontSize,
        fontFamily: c.fontFamily, color: c.color, keyframes: c.keyframes, file: store.videoFile!,
      }));
      try {
        const result = await exportAndDownload(clips, {
          filename: filename ?? `zhiying-export.mp4`,
          transitions: store.transitions.map((t) => ({ id: t.id, fromClipId: t.fromClipId, toClipId: t.toClipId, type: t.type, duration: t.duration })),
        });
        return { ok: true, message: `导出成功（${result.method}），已触发下载。`, data: { method: result.method } };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "未知导出错误";
        return { ok: false, errorCode: "EXPORT_FAILED", message: `导出失败：${msg}` };
      }
    },
  },
  { name: "undo", description: "撤销上一步操作。", parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_params, { store }) {
      if (!store.canUndo) return { ok: false, errorCode: "NO_UNDO", message: "没有可撤销的操作。" };
      store.undo(); return { ok: true, message: "已撤销。" };
    },
  },
  { name: "redo", description: "重做上一步操作。", parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_params, { store }) {
      if (!store.canRedo) return { ok: false, errorCode: "NO_REDO", message: "没有可重做的操作。" };
      store.redo(); return { ok: true, message: "已重做。" };
    },
  },
];

// ── Registry ───────────────────────────────────────────────────────────

const tools: Tool[] = [...editingTools, ...queryTools, ...effectTools, ...audioTools, ...knowledgeTools, ...exportUndoTools];
const toolMap = new Map(tools.map((t) => [t.name, t]));

export function getToolRegistry(): Tool[] { return tools; }
export function getToolsForLLM(): LlmToolDefinition[] {
  return tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
}
export async function executeTool(name: string, params: Record<string, unknown> = {}): Promise<ToolResult> {
  const tool = toolMap.get(name);
  if (!tool) return { ok: false, errorCode: "TOOL_NOT_FOUND", message: `未知工具：${name}` };
  try { return await tool.execute(params, { store: useEditorStore.getState() }); }
  catch (error) { return { ok: false, errorCode: "TOOL_EXECUTION_ERROR", message: error instanceof Error ? error.message : "工具执行异常" }; }
}
