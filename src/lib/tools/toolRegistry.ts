import { useEditorStore } from "../../stores/editor-store";
import { exportAndDownload } from "../videoExporter";
import { FILTER_PRESETS, type FilterName } from "../filters";

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

const tools: Tool[] = [
  {
    name: "splitAtPlayhead",
    description:
      "Split currently selected clip at current playhead time. Useful when user says just 'split now'.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async execute(_params, { store }) {
      const ok = store.splitAtPlayhead();
      return ok
        ? { ok: true, message: `已在播放头 ${store.currentTime.toFixed(2)}s 处分割。` }
        : { ok: false, errorCode: "SPLIT_FAILED", message: "分割失败，请把播放头放到片段内部。" };
    },
  },
  {
    name: "splitClip",
    description:
      "Split a timeline clip into two at a specific second. Useful for cutting in the middle before delete/move.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "Optional clip id. Uses selected clip if omitted." },
        time: { type: "number", description: "Split time in seconds. Defaults to current playhead time." },
      },
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可分割的片段。" };
      const time = ensureNumber(params.time) ?? store.currentTime;
      const ok = store.splitClipAt(time, clipId);
      if (!ok) {
        return {
          ok: false,
          errorCode: "SPLIT_FAILED",
          message: "分割失败，请确认时间点位于片段内部。",
        };
      }
      return { ok: true, message: `已在 ${time.toFixed(2)}s 处分割片段。` };
    },
  },
  {
    name: "trimTo",
    description:
      "Trim current selected clip/timeline to a target end second. This is a higher-level trim helper for common commands.",
    parameters: {
      type: "object",
      properties: {
        seconds: { type: "number", description: "Target end time in seconds." },
      },
      required: ["seconds"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const seconds = ensureNumber(params.seconds) ?? ensureNumber(params.time);
      if (seconds === null) return badParams("trimTo 需要 seconds(number) 参数。");
      const ok = store.trimTo(seconds);
      return ok
        ? { ok: true, message: `已裁剪到 ${seconds.toFixed(2)}s。` }
        : { ok: false, errorCode: "TRIM_TO_FAILED", message: "trimTo 失败，请检查时间范围。" };
    },
  },
  {
    name: "trimLast",
    description:
      "Remove last N seconds from currently selected clip. Useful for commands like '删除最后2秒'.",
    parameters: {
      type: "object",
      properties: {
        seconds: { type: "number", description: "Seconds to remove from clip end." },
      },
      required: ["seconds"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const seconds = ensureNumber(params.seconds) ?? ensureNumber(params.time);
      if (seconds === null) return badParams("trimLast 需要 seconds(number) 参数。");
      const ok = store.trimLast(seconds);
      return ok
        ? { ok: true, message: `已删除最后 ${seconds.toFixed(2)}s。` }
        : { ok: false, errorCode: "TRIM_LAST_FAILED", message: "trimLast 失败，片段可能过短。" };
    },
  },
  {
    name: "trimClip",
    description:
      "Trim a clip edge to a target timeline time. Edge=start trims left edge, edge=end trims right edge.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "Optional clip id. Uses selected clip if omitted." },
        edge: { type: "string", enum: ["start", "end"], description: "Which clip edge to trim. Defaults to end." },
        time: { type: "number", description: "Target timeline time in seconds." },
        seconds: { type: "number", description: "Alias of time in seconds." },
      },
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可裁剪的片段。" };
      const edgeRaw = params.edge === "start" || params.edge === "end" ? params.edge : "end";
      const time = ensureNumber(params.time) ?? ensureNumber(params.seconds);
      if (time === null) {
        return badParams("trimClip 需要 time(number) 或 seconds(number) 参数。");
      }
      const ok = store.trimClipEdge(clipId, edgeRaw, time);
      return ok
        ? { ok: true, message: `已裁剪片段${edgeRaw === "start" ? "起点" : "终点"}到 ${time.toFixed(2)}s。` }
        : { ok: false, errorCode: "TRIM_FAILED", message: "裁剪失败，请检查参数范围。" };
    },
  },
  {
    name: "deleteClip",
    description:
      "Delete a clip from timeline. Can target by clipId, clipIndex(1-based) or current selected clip.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "Optional clip id." },
        clipIndex: { type: "number", description: "Optional 1-based index in timeline order." },
        ripple: { type: "boolean", description: "If true, delete and close gap on same track." },
      },
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可删除的片段。" };
      const ripple = Boolean(params.ripple);
      const ok = ripple ? store.removeClipAndRipple(clipId) : store.removeClip(clipId);
      return ok
        ? { ok: true, message: ripple ? "已删除片段并闭合间隙。" : "已删除片段。" }
        : { ok: false, errorCode: "DELETE_FAILED", message: "删除失败，片段可能不存在。" };
    },
  },
  {
    name: "removeRange",
    description:
      "Delete everything in a timeline time range, optionally with ripple to close the gap. Best for commands like '删除25秒到30秒'.",
    parameters: {
      type: "object",
      properties: {
        start: { type: "number", description: "Range start time in seconds." },
        end: { type: "number", description: "Range end time in seconds." },
        ripple: {
          type: "boolean",
          description: "Whether to close the gap after deletion. Defaults to true.",
        },
      },
      required: ["start", "end"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const start = ensureNumber(params.start);
      const end = ensureNumber(params.end);
      if (start === null || end === null) {
        return badParams("removeRange 需要 start(number) 和 end(number) 参数。");
      }
      const ripple = params.ripple === undefined ? true : Boolean(params.ripple);
      const ok = store.removeRange(start, end, ripple);
      if (!ok) {
        return {
          ok: false,
          errorCode: "REMOVE_RANGE_FAILED",
          message: "删除区间失败，请检查时间范围或片段内容。",
        };
      }
      const rangeStart = Math.min(start, end);
      const rangeEnd = Math.max(start, end);
      return {
        ok: true,
        message: `已删除 ${rangeStart.toFixed(2)}s 到 ${rangeEnd.toFixed(2)}s 的内容${ripple ? "并闭合间隙" : ""}。`,
      };
    },
  },
  {
    name: "getTimelineInfo",
    description:
      "Get all timeline clip info (id/start/end/track). Useful when user asks timeline structure or wants time-based targeting.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async execute(_params, { store }) {
      const clips = store.clips.map((c) => ({
        id: c.id,
        start: c.start,
        end: c.end,
        track: c.trackIndex,
      }));
      return {
        ok: true,
        message: `已获取时间轴信息，共 ${clips.length} 个片段。`,
        data: { clips },
      };
    },
  },
  {
    name: "getClipDetails",
    description:
      "Get detailed info for one clip including speed/filter/keyframes/text metadata.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "Optional clip id." },
        clipIndex: { type: "number", description: "Optional 1-based clip index." },
      },
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可查询的片段。" };
      const clip = store.clips.find((c) => c.id === clipId);
      if (!clip) return { ok: false, errorCode: "NOT_FOUND", message: "片段不存在。" };
      return {
        ok: true,
        message: `已获取片段 ${clip.id} 详情。`,
        data: {
          clip: {
            id: clip.id,
            type: clip.type,
            start: clip.start,
            end: clip.end,
            trackIndex: clip.trackIndex,
            sourceStart: clip.sourceStart,
            sourceEnd: clip.sourceEnd,
            speed: clip.speed ?? 1,
            filter: clip.filter ?? null,
            keyframes: clip.keyframes ?? {},
            text: clip.type === "text" ? { content: clip.content, style: {
              fontSize: clip.fontSize,
              fontFamily: clip.fontFamily,
              color: clip.color,
            } } : null,
          },
        },
      };
    },
  },
  {
    name: "listTransitions",
    description: "List all transitions on current timeline.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async execute(_params, { store }) {
      const transitions = store.transitions.map((t) => ({
        id: t.id,
        fromClipId: t.fromClipId,
        toClipId: t.toClipId,
        type: t.type,
        duration: t.duration,
      }));
      return {
        ok: true,
        message: `当前共有 ${transitions.length} 个转场。`,
        data: { transitions },
      };
    },
  },
  {
    name: "moveClip",
    description:
      "Move a clip to a new timeline start position and optional track index. Keeps original clip length.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "Optional clip id." },
        start: { type: "number", description: "New timeline start in seconds." },
        trackIndex: { type: "number", description: "Optional target track index." },
      },
      required: ["start"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可移动的片段。" };
      const start = ensureNumber(params.start);
      if (start === null) {
        return badParams("moveClip 需要 start(number) 参数。");
      }
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
        : { ok: false, errorCode: "MOVE_FAILED", message: "移动失败，请检查时间范围。" };
    },
  },
  {
    name: "applyFilter",
    description:
      "Apply visual filter to a video clip with adjustable intensity. Use for commands like '给第一段加复古滤镜'.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "Optional clip id. Uses selected clip if omitted." },
        clipIndex: { type: "number", description: "Optional 1-based index in timeline order." },
        filterName: { type: "string", enum: FILTER_NAMES, description: "Filter preset name." },
        intensity: { type: "number", minimum: 0, maximum: 1, default: 1 },
      },
      required: ["filterName"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可应用滤镜的片段。" };
      const clip = store.clips.find((c) => c.id === clipId);
      if (!clip || clip.type !== "video") {
        return { ok: false, errorCode: "NOT_VIDEO_CLIP", message: "滤镜仅支持视频片段。" };
      }
      const filterName = ensureFilterName(params.filterName);
      if (!filterName) return badParams("applyFilter 需要有效 filterName。");
      const intensity = ensureNumber(params.intensity) ?? 1;
      const safeIntensity = Math.max(0, Math.min(1, intensity));
      const ok = store.applyFilter(clipId, filterName, safeIntensity);
      return ok
        ? { ok: true, message: `已应用 ${filterName} 滤镜（强度 ${safeIntensity.toFixed(2)}）。` }
        : { ok: false, errorCode: "APPLY_FILTER_FAILED", message: "滤镜应用失败。" };
    },
  },
  {
    name: "addTransition",
    description:
      "Add transition between two clips. Useful for requests like '在第一段和第二段之间加淡入淡出转场'.",
    parameters: {
      type: "object",
      properties: {
        fromClipId: { type: "string", description: "From clip id." },
        toClipId: { type: "string", description: "To clip id." },
        fromClipIndex: { type: "number", description: "Alternative 1-based from clip index." },
        toClipIndex: { type: "number", description: "Alternative 1-based to clip index." },
        type: { type: "string", enum: TRANSITION_TYPES, description: "Transition type." },
        duration: { type: "number", default: 1, minimum: 0.1, maximum: 2 },
      },
      required: ["type"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const sorted = [...store.clips].sort((a, b) => a.start - b.start);
      const fromClipId =
        ensureString(params.fromClipId) ??
        (ensureNumber(params.fromClipIndex) !== null
          ? sorted[Math.max(0, Math.floor(ensureNumber(params.fromClipIndex)! - 1))]?.id
          : store.selectedClipId ?? sorted[0]?.id);
      const toClipId =
        ensureString(params.toClipId) ??
        (ensureNumber(params.toClipIndex) !== null
          ? sorted[Math.max(0, Math.floor(ensureNumber(params.toClipIndex)! - 1))]?.id
          : undefined);
      if (!fromClipId) {
        return { ok: false, errorCode: "NO_CLIP", message: "未找到起始片段。" };
      }
      const fromClip = store.clips.find((c) => c.id === fromClipId);
      const autoTo =
        store.clips
          .filter((c) => fromClip && c.trackIndex === fromClip.trackIndex && c.start >= fromClip.end - 0.0001 && c.id !== fromClip.id)
          .sort((a, b) => a.start - b.start)[0]?.id ?? null;
      const resolvedTo = toClipId ?? autoTo;
      if (!resolvedTo) {
        return {
          ok: false,
          errorCode: "NO_TARGET_CLIP",
          message: "未找到可衔接的目标片段，请指定 toClipId/toClipIndex。",
        };
      }
      const typeRaw = ensureString(params.type);
      const type = TRANSITION_TYPES.find((t) => t === typeRaw);
      if (!type) return badParams("addTransition 需要有效 type。");
      const duration = Math.max(0.1, Math.min(2, ensureNumber(params.duration) ?? 1));
      const id = store.addTransition({
        fromClipId,
        toClipId: resolvedTo,
        type,
        duration,
      });
      return id
        ? { ok: true, message: `已添加 ${type} 转场（${duration.toFixed(1)}s）。` }
        : { ok: false, errorCode: "ADD_TRANSITION_FAILED", message: "转场添加失败。" };
    },
  },
  {
    name: "addText",
    description:
      "Add subtitle/text clip in timeline. Useful for commands like '在5秒到10秒加字幕 Hello'.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Subtitle content text." },
        start: { type: "number", description: "Start time in seconds." },
        end: { type: "number", description: "End time in seconds." },
        fontSize: { type: "number", description: "Font size.", default: 36 },
        color: { type: "string", description: "Text color, e.g. #ffffff.", default: "#ffffff" },
      },
      required: ["content", "start", "end"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const content = ensureString(params.content);
      const start = ensureNumber(params.start);
      const end = ensureNumber(params.end);
      if (!content || start === null || end === null) {
        return badParams("addText 需要 content(string), start(number), end(number)。");
      }
      const fontSize = ensureNumber(params.fontSize) ?? 36;
      const color = ensureString(params.color) ?? "#ffffff";
      const id = store.addTextClip(content, start, end, fontSize, color);
      return id
        ? { ok: true, message: `已添加字幕“${content}” (${start.toFixed(2)}s-${end.toFixed(2)}s)。` }
        : { ok: false, errorCode: "ADD_TEXT_FAILED", message: "字幕添加失败，请检查参数。" };
    },
  },
  {
    name: "detectBeats",
    description:
      "Analyze audio track and generate beat markers on timeline. Useful for music rhythm editing.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "Optional audio clip id." },
      },
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = ensureString(params.clipId) ?? undefined;
      const beats = await store.detectBeatMarkers(clipId);
      return beats.length
        ? { ok: true, message: `已检测到 ${beats.length} 个节拍点。`, data: { beats } }
        : { ok: false, errorCode: "NO_BEATS", message: "未检测到节拍点，请确认音频片段存在。" };
    },
  },
  {
    name: "snapToBeat",
    description:
      "Snap selected or target clip start to nearest beat marker. Useful for commands like '让这段卡点'.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "Optional target clip id." },
      },
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const clipId = ensureString(params.clipId) ?? undefined;
      const ok = store.snapClipToNearestBeat(clipId);
      return ok
        ? { ok: true, message: "已对齐到最近节拍点。" }
        : { ok: false, errorCode: "SNAP_BEAT_FAILED", message: "对齐失败，请先分析节拍并选中片段。" };
    },
  },
  {
    name: "changeSpeed",
    description:
      "Change video clip playback speed (0.1x~10x). Useful for commands like '第三段快放2倍'.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "Optional target clip id." },
        clipIndex: { type: "number", description: "Optional 1-based timeline clip index." },
        speed: { type: "number", minimum: 0.1, maximum: 10 },
      },
      required: ["speed"],
      additionalProperties: false,
    },
    async execute(params, { store }) {
      const speed = ensureNumber(params.speed);
      if (speed === null) return badParams("changeSpeed 需要 speed(number) 参数。");
      const clipId = resolveClipId(store, params);
      if (!clipId) return { ok: false, errorCode: "NO_CLIP", message: "没有可变速的片段。" };
      const ok = store.setClipSpeed(clipId, speed);
      return ok
        ? { ok: true, message: `已将片段速度设为 ${Math.max(0.1, Math.min(10, speed)).toFixed(2)}x。` }
        : { ok: false, errorCode: "CHANGE_SPEED_FAILED", message: "变速失败，请选择视频片段。" };
    },
  },
  {
    name: "addKeyframe",
    description:
      "Add animation keyframe to a clip property (x,y,scale,rotation,opacity).",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "Optional target clip id." },
        clipIndex: { type: "number", description: "Optional 1-based clip index." },
        property: { type: "string", enum: ["x", "y", "scale", "rotation", "opacity"] },
        time: { type: "number", description: "Local clip time offset in seconds." },
        value: { type: "number", description: "Keyframe value." },
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
      if (
        !property ||
        !["x", "y", "scale", "rotation", "opacity"].includes(property) ||
        time === null ||
        value === null
      ) {
        return badParams("addKeyframe 需要 property/time/value 参数。");
      }
      const easing = ensureString(params.easing) ?? "linear";
      const ok = store.addKeyframe(
        clipId,
        property as "x" | "y" | "scale" | "rotation" | "opacity",
        time,
        value,
        (["linear", "easeInOut", "bounce"].includes(easing) ? easing : "linear") as
          | "linear"
          | "easeInOut"
          | "bounce"
      );
      return ok
        ? { ok: true, message: `已添加关键帧 ${property} @${time.toFixed(2)}s = ${value.toFixed(2)}。` }
        : { ok: false, errorCode: "ADD_KEYFRAME_FAILED", message: "关键帧添加失败。" };
    },
  },
  {
    name: "exportVideo",
    description:
      "Export current timeline clips into a video file and trigger download. Uses WebCodecs with FFmpeg fallback.",
    parameters: {
      type: "object",
      properties: {
        filename: { type: "string", description: "Optional output filename, e.g. my-cut.mp4." },
      },
      additionalProperties: false,
    },
    async execute(params, { store }) {
      if (!store.videoFile || !store.clips.length) {
        return { ok: false, errorCode: "NO_VIDEO", message: "请先导入视频并创建片段后再导出。" };
      }
      const hasAudioClip = store.clips.some((c) => c.type === "audio");
      const filename = ensureString(params.filename);
      const clips = store.clips.map((clip) => ({
        id: clip.id,
        type: clip.type,
        src: clip.src,
        start: clip.start,
        end: clip.end,
        sourceStart: clip.sourceStart,
        sourceEnd: clip.sourceEnd,
        speed: clip.speed,
        filter: clip.filter,
        content: clip.content,
        fontSize: clip.fontSize,
        fontFamily: clip.fontFamily,
        color: clip.color,
        stroke: clip.stroke,
        shadow: clip.shadow,
        position: clip.position,
        animation: clip.animation,
        keyframes: clip.keyframes,
        file: store.videoFile as File,
      }));
      try {
        const result = await exportAndDownload(clips, {
          filename:
            filename ??
            `zhiying-${store.videoFile.name.replace(/\.\w+$/, "")}-agent-export.mp4`,
          transitions: store.transitions.map((t) => ({
            id: t.id,
            fromClipId: t.fromClipId,
            toClipId: t.toClipId,
            type: t.type,
            duration: t.duration,
          })),
        });
        return {
          ok: true,
          message:
            `导出成功（${result.method}），已触发下载。` +
            (hasAudioClip && result.method === "ffmpeg"
              ? " 注意：当前降级到 FFmpeg 时，独立音频轨导出可能不完整。"
              : store.transitions.length > 0
                ? " 转场说明：当前已支持 crossDissolve/fade/slide/wipe 导出。"
              : ""),
          data: { method: result.method },
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "未知导出错误";
        return { ok: false, errorCode: "EXPORT_FAILED", message: `导出失败：${msg}` };
      }
    },
  },
  {
    name: "undo",
    description: "Undo last editing operation.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async execute(_params, { store }) {
      if (!store.canUndo) return { ok: false, errorCode: "NO_UNDO", message: "当前没有可撤销操作。" };
      store.undo();
      return { ok: true, message: "已撤销上一步操作。" };
    },
  },
  {
    name: "redo",
    description: "Redo previously undone editing operation.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async execute(_params, { store }) {
      if (!store.canRedo) return { ok: false, errorCode: "NO_REDO", message: "当前没有可重做操作。" };
      store.redo();
      return { ok: true, message: "已重做上一步操作。" };
    },
  },
];

const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

export function getToolRegistry(): Tool[] {
  return tools;
}

export function getToolsForLLM(): LlmToolDefinition[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export async function executeTool(
  toolName: string,
  params: Record<string, unknown> = {}
): Promise<ToolResult> {
  const tool = toolMap.get(toolName);
  if (!tool) {
    return {
      ok: false,
      errorCode: "TOOL_NOT_FOUND",
      message: `未知工具：${toolName}`,
    };
  }
  try {
    const store = useEditorStore.getState();
    return await tool.execute(params, { store });
  } catch (error) {
    const message = error instanceof Error ? error.message : "工具执行异常";
    return { ok: false, errorCode: "TOOL_EXECUTION_ERROR", message };
  }
}
