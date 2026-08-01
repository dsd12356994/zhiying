import { create } from "zustand";
import type { ClipFilter, FilterName } from "../lib/filters";
import { buildFilterCss } from "../lib/filters";

export type ClipType = "video" | "audio" | "text";
export type TimeDisplayMode = "clock" | "seconds";
export type KeyframeProperty = "x" | "y" | "scale" | "rotation" | "opacity";

export interface Keyframe {
  id: string;
  time: number; // relative to clip.start
  value: number;
  easing: "linear" | "easeInOut" | "bounce";
}

export interface TimelineClip {
  id: string;
  type: ClipType;
  src: string;
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  trackIndex: number;
  name?: string;
  volume?: number; // 0–1, default 1.0
  muted?: boolean;
  filter?: ClipFilter;
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  stroke?: { width: number; color: string };
  shadow?: { blur: number; offsetX: number; offsetY: number; color: string };
  position?: { x: number; y: number };
  animation?: { type: "fadeIn" | "bounce" | "typewriter"; duration: number };
  speed?: number;
  keyframes?: Partial<Record<KeyframeProperty, Keyframe[]>>;
}

export interface TimelineTransition {
  id: string;
  fromClipId: string;
  toClipId: string;
  type: "crossDissolve" | "slide" | "wipe" | "fade";
  duration: number;
}

interface TimelineSnapshot {
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  markers: number[];
  beatMarkers: number[];
  trimStart: number;
  trimEnd: number;
  currentTime: number;
  duration: number;
  sourceDuration: number;
  selectedClipId: string | null;
}

export interface EditorState {
  // 面板可见性
  showMediaPanel: boolean;
  showInspector: boolean;
  showFlowTab: boolean;
  showChatBox: boolean;
  showExportDialog: boolean;
  showTemplatesDialog: boolean;

  // 视频与时间轴
  videoFile: File | null;
  videoSrc: string | null;
  currentTime: number;
  duration: number;
  sourceDuration: number;
  zoom: number;
  isPlaying: boolean;
  playbackRate: number;
  timeDisplayMode: TimeDisplayMode;
  editMode: "ripple" | "overwrite";

  // 裁剪与片段
  trimStart: number;
  trimEnd: number;
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  selectedClipId: string | null;
  pendingSubtitles: string[];
  markers: number[];
  beatMarkers: number[];

  // 撤销/重做
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // 操作
  toggleMediaPanel: () => void;
  toggleInspector: () => void;
  toggleFlowTab: () => void;
  toggleChatBox: () => void;
  toggleExportDialog: () => void;
  toggleTemplatesDialog: () => void;
  detectSpikeMoments: (clipId?: string) => Promise<ActionMoment[]>;
  detectSilenceRegions: (clipId?: string, threshold?: number, minDuration?: number) => Promise<SilenceRegion[]>;
  setExportDialog: (open: boolean) => void;
  setVideoFile: (file: File | null, src?: string | null) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setZoom: (z: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setTimeDisplayMode: (mode: TimeDisplayMode) => void;
  toggleTimeDisplayMode: () => void;
  play: () => void;
  pause: () => void;
  togglePlaying: () => void;
  setTrimStart: (t: number) => void;
  setTrimEnd: (t: number) => void;
  setTrimPoints: (start: number, end: number) => void;
  initializeClips: (duration: number, src: string) => void;
  addClip: (clip: Omit<TimelineClip, "id"> & { id?: string; skipAudioExtract?: boolean }) => string;
  duplicateClip: (clipId: string) => string | null;
  copyClipToNextTrack: (clipId: string) => string | null;
  rippleMoveClip: (clipId: string, newStart: number) => boolean;
  removeClipAndRipple: (clipId: string) => boolean;
  removeRange: (start: number, end: number, ripple?: boolean) => boolean;
  removeClip: (clipId: string) => boolean;
  addTransition: (transition: Omit<TimelineTransition, "id">) => string | null;
  removeTransition: (id: string) => boolean;
  addTextClip: (
    content: string,
    start: number,
    end: number,
    fontSize?: number,
    color?: string
  ) => string | null;
  updateTextClip: (
    clipId: string,
    patch: Partial<
      Pick<
        TimelineClip,
        | "content"
        | "fontSize"
        | "fontFamily"
        | "color"
        | "stroke"
        | "shadow"
        | "position"
        | "animation"
      >
    >
  ) => boolean;
  setClipSpeed: (clipId: string, speed: number) => boolean;
  setClipVolume: (clipId: string, volume: number) => boolean;
  setClipMuted: (clipId: string, muted: boolean) => boolean;
  addKeyframe: (
    clipId: string,
    property: KeyframeProperty,
    time: number,
    value: number,
    easing?: Keyframe["easing"]
  ) => boolean;
  updateKeyframe: (
    clipId: string,
    property: KeyframeProperty,
    keyframeId: string,
    patch: Partial<Pick<Keyframe, "time" | "value" | "easing">>
  ) => boolean;
  removeKeyframe: (clipId: string, property: KeyframeProperty, keyframeId: string) => boolean;
  applyFilter: (clipId: string, filterName: FilterName, intensity?: number) => boolean;
  updateClip: (clipId: string, patch: Partial<TimelineClip>) => boolean;
  splitClipAt: (time: number, clipId?: string) => boolean;
  splitAtPlayhead: () => boolean;
  trimTo: (seconds: number) => boolean;
  trimLast: (seconds: number) => boolean;
  applyTrimRange: (start: number, end: number) => boolean;
  trimClipEdge: (
    clipId: string,
    edge: "start" | "end",
    newTime: number
  ) => boolean;
  reorderClips: (fromIndex: number, toIndex: number) => void;
  normalizeTrack: (trackIndex: number) => void;
  setSelectedClipId: (id: string | null) => void;
  setEditMode: (mode: "ripple" | "overwrite") => void;
  toggleEditMode: () => void;
  addPendingSubtitle: (text: string) => void;
  addMarker: (time?: number) => number;
  removeNearestMarker: (time: number, threshold?: number) => boolean;
  clearMarkers: () => void;
  setBeatMarkers: (markers: number[]) => void;
  clearBeatMarkers: () => void;
  detectBeatMarkers: (clipId?: string) => Promise<number[]>;
  snapClipToNearestBeat: (clipId?: string) => boolean;
  clearTimeline: () => void;
  getTotalDuration: () => number;
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(v, max));
const MIN_CLIP_DURATION = 0.1;
const HISTORY_LIMIT = 80;
const MARKER_EPS = 0.05;
const TIME_DISPLAY_MODE_KEY = "zhiying.preview.timeDisplayMode";

const newClipId = () =>
  `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const newTransitionId = () =>
  `transition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const newKeyframeId = () =>
  `keyframe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function getTimelineDuration(sourceDuration: number, clips: TimelineClip[]): number {
  const maxClipEnd = clips.reduce((max, clip) => Math.max(max, clip.end), 0);
  return Math.max(MIN_CLIP_DURATION, sourceDuration, maxClipEnd);
}

function mapTimeToSource(clip: TimelineClip, timelineTime: number): number {
  const timelineLen = Math.max(MIN_CLIP_DURATION, clip.end - clip.start);
  const sourceLen = Math.max(MIN_CLIP_DURATION, clip.sourceEnd - clip.sourceStart);
  const ratio = sourceLen / timelineLen;
  return clip.sourceStart + (timelineTime - clip.start) * ratio;
}

function sliceKeyframes(
  clip: TimelineClip,
  nextStart: number,
  nextEnd: number
): TimelineClip["keyframes"] {
  if (!clip.keyframes) return undefined;
  const segmentStartOffset = nextStart - clip.start;
  const segmentEndOffset = nextEnd - clip.start;
  const result: NonNullable<TimelineClip["keyframes"]> = {};
  (Object.keys(clip.keyframes) as KeyframeProperty[]).forEach((prop) => {
    const list = clip.keyframes?.[prop] ?? [];
    const sliced = list
      .filter((k) => k.time >= segmentStartOffset - 1e-4 && k.time <= segmentEndOffset + 1e-4)
      .map((k) => ({
        ...k,
        id: newKeyframeId(),
        time: Math.max(0, k.time - segmentStartOffset),
      }))
      .sort((a, b) => a.time - b.time);
    if (sliced.length) result[prop] = sliced;
  });
  return Object.keys(result).length ? result : undefined;
}

function getInitialTimeDisplayMode(): TimeDisplayMode {
  if (typeof window === "undefined") return "clock";
  try {
    const saved = window.localStorage.getItem(TIME_DISPLAY_MODE_KEY);
    return saved === "seconds" ? "seconds" : "clock";
  } catch {
    return "clock";
  }
}

function persistTimeDisplayMode(mode: TimeDisplayMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TIME_DISPLAY_MODE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

const pastStack: TimelineSnapshot[] = [];
const futureStack: TimelineSnapshot[] = [];

const cloneSnapshot = (s: EditorState): TimelineSnapshot => ({
  clips: s.clips.map((c) => ({ ...c })),
  transitions: s.transitions.map((t) => ({ ...t })),
  markers: [...s.markers],
  beatMarkers: [...s.beatMarkers],
  trimStart: s.trimStart,
  trimEnd: s.trimEnd,
  currentTime: s.currentTime,
  duration: s.duration,
  sourceDuration: s.sourceDuration,
  selectedClipId: s.selectedClipId,
});

function syncHistoryFlags(set: (partial: Partial<EditorState>) => void) {
  set({
    canUndo: pastStack.length > 0,
    canRedo: futureStack.length > 0,
  });
}

function pushHistory(
  get: () => EditorState,
  set: (partial: Partial<EditorState>) => void
) {
  pastStack.push(cloneSnapshot(get()));
  if (pastStack.length > HISTORY_LIMIT) pastStack.shift();
  futureStack.length = 0;
  syncHistoryFlags(set);
}

function applySnapshot(
  set: (partial: Partial<EditorState>) => void,
  snap: TimelineSnapshot
) {
  set({
    clips: snap.clips.map((c) => ({ ...c })),
    transitions: snap.transitions.map((t) => ({ ...t })),
    markers: [...snap.markers],
    beatMarkers: [...snap.beatMarkers],
    trimStart: snap.trimStart,
    trimEnd: snap.trimEnd,
    currentTime: snap.currentTime,
    duration: snap.duration,
    sourceDuration: snap.sourceDuration,
    selectedClipId: snap.selectedClipId,
    canUndo: pastStack.length > 0,
    canRedo: futureStack.length > 0,
  });
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  showMediaPanel: true,
  showInspector: true,
  showFlowTab: false,
  showChatBox: false,
  showExportDialog: false,
  showTemplatesDialog: false,
  videoFile: null,
  videoSrc: null,
  currentTime: 0,
  duration: 60,
  sourceDuration: 60,
  zoom: 1,
  isPlaying: false,
  playbackRate: 1,
  timeDisplayMode: getInitialTimeDisplayMode(),
  editMode: "overwrite",
  trimStart: 0,
  trimEnd: 60,
  clips: [],
  transitions: [],
  selectedClipId: null,
  pendingSubtitles: [],
  markers: [],
  beatMarkers: [],
  canUndo: false,
  canRedo: false,

  undo: () => {
    if (!pastStack.length) return;
    const current = cloneSnapshot(get());
    const prev = pastStack.pop()!;
    futureStack.push(current);
    applySnapshot(set, prev);
  },

  redo: () => {
    if (!futureStack.length) return;
    const current = cloneSnapshot(get());
    const next = futureStack.pop()!;
    pastStack.push(current);
    applySnapshot(set, next);
  },

  toggleMediaPanel: () => set((s) => ({ showMediaPanel: !s.showMediaPanel })),
  toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),
  toggleFlowTab: () => set((s) => ({ showFlowTab: !s.showFlowTab })),
  toggleChatBox: () => set((s) => ({ showChatBox: !s.showChatBox })),
  toggleExportDialog: () => set((s) => ({ showExportDialog: !s.showExportDialog })),
  setExportDialog: (open) => set({ showExportDialog: open }),
  toggleTemplatesDialog: () => set((s) => ({ showTemplatesDialog: !s.showTemplatesDialog })),

  detectSpikeMoments: async (clipId) => {
    const { clips, selectedClipId } = get();
    const targetId =
      clipId ??
      selectedClipId ??
      clips.find((c) => c.type === "video" || c.type === "audio")?.id;
    if (!targetId) return [];
    const clip = clips.find((c) => c.id === targetId);
    if (!clip) return [];
    try {
      const response = await fetch(clip.src);
      const buf = await response.arrayBuffer();
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(buf.slice(0));
      const spikes = detectSpikes(decoded);
      void ctx.close();
      return spikes
        .filter((m) => m.ts >= clip.sourceStart && m.ts <= clip.sourceEnd)
        .map((m) => ({ ...m, ts: clip.start + (m.ts - clip.sourceStart) }))
        .filter((m) => m.ts >= clip.start && m.ts <= clip.end);
    } catch {
      return [];
    }
  },

  detectSilenceRegions: async (clipId, threshold = 0.01, minDuration = 0.3) => {
    const { clips, selectedClipId } = get();
    const targetId =
      clipId ??
      selectedClipId ??
      clips.find((c) => c.type === "video" || c.type === "audio")?.id;
    if (!targetId) return [];
    const clip = clips.find((c) => c.id === targetId);
    if (!clip) return [];
    try {
      const response = await fetch(clip.src);
      const buf = await response.arrayBuffer();
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(buf.slice(0));
      const regions = detectSilence(decoded, threshold, minDuration);
      void ctx.close();
      return regions
        .filter((r) => r.start >= clip.sourceStart && r.end <= clip.sourceEnd)
        .map((r) => ({
          start: clip.start + (r.start - clip.sourceStart),
          end: clip.start + (r.end - clip.sourceStart),
          duration: r.duration,
        }));
    } catch {
      return [];
    }
  },

  setVideoFile: (file, src = null) => {
    const prevSrc = get().videoSrc;
    if (prevSrc?.startsWith("blob:")) URL.revokeObjectURL(prevSrc);

    if (!file) {
      pastStack.length = 0;
      futureStack.length = 0;
      set({
        videoFile: null,
        videoSrc: null,
        currentTime: 0,
        isPlaying: false,
        playbackRate: 1,
        clips: [],
        transitions: [],
        selectedClipId: null,
        markers: [],
        beatMarkers: [],
        trimStart: 0,
        duration: 60,
        sourceDuration: 60,
        trimEnd: 60,
        canUndo: false,
        canRedo: false,
      });
      return;
    }

    set({
      videoFile: file,
      videoSrc: src,
      currentTime: 0,
      isPlaying: false,
      playbackRate: 1,
    });
  },

  setCurrentTime: (t) => {
    const { duration } = get();
    set({ currentTime: clamp(t, 0, duration) });
  },

  setDuration: (d) =>
    set((s) => ({
      sourceDuration: Math.max(MIN_CLIP_DURATION, d),
      duration: getTimelineDuration(Math.max(MIN_CLIP_DURATION, d), s.clips),
      trimEnd: Math.min(
        Math.max(s.trimEnd, MIN_CLIP_DURATION),
        getTimelineDuration(Math.max(MIN_CLIP_DURATION, d), s.clips)
      ),
      currentTime: Math.min(
        s.currentTime,
        getTimelineDuration(Math.max(MIN_CLIP_DURATION, d), s.clips)
      ),
    })),

  setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(10, z)) }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackRate: (rate) => {
    const next = Math.max(-8, Math.min(8, rate));
    if (Math.abs(next) < 0.001) {
      set({ playbackRate: 1, isPlaying: false });
      return;
    }
    set({ playbackRate: next });
  },
  setTimeDisplayMode: (mode) => {
    persistTimeDisplayMode(mode);
    set({ timeDisplayMode: mode });
  },
  toggleTimeDisplayMode: () => {
    const next = get().timeDisplayMode === "clock" ? "seconds" : "clock";
    persistTimeDisplayMode(next);
    set({ timeDisplayMode: next });
  },
  play: () => {
    const { videoFile, playbackRate } = get();
    if (!videoFile) return;
    set({ isPlaying: true, playbackRate: Math.abs(playbackRate) < 0.001 ? 1 : playbackRate });
  },
  pause: () => set({ isPlaying: false }),

  togglePlaying: () => {
    const { isPlaying, videoFile, playbackRate } = get();
    if (!videoFile) return;
    set({
      isPlaying: !isPlaying,
      playbackRate: Math.abs(playbackRate) < 0.001 ? 1 : playbackRate,
    });
  },

  setTrimStart: (t) => {
    const { trimEnd } = get();
    const start = clamp(t, 0, trimEnd - MIN_CLIP_DURATION);
    set({ trimStart: start });
  },

  setTrimEnd: (t) => {
    const { duration, trimStart } = get();
    const end = clamp(t, trimStart + MIN_CLIP_DURATION, duration);
    set({ trimEnd: end });
  },

  setTrimPoints: (start, end) => {
    pushHistory(get, set);
    const { duration } = get();
    const s = clamp(start, 0, duration - MIN_CLIP_DURATION);
    const e = clamp(end, s + MIN_CLIP_DURATION, duration);
    set({ trimStart: s, trimEnd: e });
  },

  initializeClips: (duration, src) => {
    pastStack.length = 0;
    futureStack.length = 0;
    const videoId = newClipId();
    const safeDur = Math.max(MIN_CLIP_DURATION, duration);
    set({
      duration: safeDur,
      sourceDuration: safeDur,
      trimStart: 0,
      trimEnd: safeDur,
      videoSrc: src,
      clips: [
        {
          id: videoId,
          type: "video",
          src,
          start: 0,
          end: safeDur,
          sourceStart: 0,
          sourceEnd: safeDur,
          trackIndex: 0,
          name: "主视频",
          volume: 1,
        },
      ],
      markers: [],
      beatMarkers: [],
      transitions: [],
      selectedClipId: videoId,
      currentTime: 0,
      canUndo: false,
      canRedo: false,
    });
  },

  addClip: (clip) => {
    pushHistory(get, set);
    const id = clip.id ?? newClipId();
    const start = Math.max(0, clip.start);
    const end = Math.max(start + MIN_CLIP_DURATION, clip.end);
    const sourceStart = clip.sourceStart ?? 0;
    const sourceEnd =
      clip.sourceEnd ?? Math.max(sourceStart + MIN_CLIP_DURATION, end - start);
    const clipType = clip.type ?? "video";
    const isVideoClip = clipType === "video";
    const skipAudioExtract = (clip as { skipAudioExtract?: boolean }).skipAudioExtract ?? false;
    const next: TimelineClip = {
      id,
      type: clipType,
      src: clip.src,
      start,
      end,
      sourceStart,
      sourceEnd,
      trackIndex: clip.trackIndex ?? 0,
      name: clip.name,
      speed: clip.speed ?? 1,
      volume: isVideoClip ? 0 : (clip.volume ?? 1), // video: mute embedded, audio: use provided or full
      muted: clip.muted,
      keyframes: clip.keyframes,
    };
    // Auto-extract audio onto track 1 when a video clip is added (skip for AI-generated clips)
    const audioExtract: TimelineClip | null = isVideoClip && !skipAudioExtract
      ? {
          id: newClipId(),
          type: "audio",
          src: next.src,
          start: next.start,
          end: next.end,
          sourceStart: next.sourceStart,
          sourceEnd: next.sourceEnd,
          trackIndex: 1,
          name: `${next.name ?? "视频"} 音频`,
          volume: 1,
          speed: 1,
        }
      : null;
    set((s) => {
      const toAdd: TimelineClip[] = audioExtract ? [next, audioExtract] : [next];
      const clips = [...s.clips, ...toAdd].sort((a, b) =>
        a.trackIndex === b.trackIndex ? a.start - b.start : a.trackIndex - b.trackIndex
      );
      const duration = getTimelineDuration(s.sourceDuration, clips);
      return {
        clips,
        duration,
        trimEnd: Math.min(s.trimEnd, duration),
        selectedClipId: id,
      };
    });
    return id;
  },

  duplicateClip: (clipId) => {
    const { clips } = get();
    const source = clips.find((c) => c.id === clipId);
    if (!source) return null;
    pushHistory(get, set);
    const id = newClipId();
    const len = source.end - source.start;
    const duplicated: TimelineClip = {
      ...source,
      id,
      start: source.end,
      end: source.end + len,
      name: source.name ? `${source.name} 副本` : undefined,
    };
    set((s) => {
      const clips = [...s.clips, duplicated].sort((a, b) => a.start - b.start);
      return {
        clips,
        duration: getTimelineDuration(s.sourceDuration, clips),
        selectedClipId: id,
      };
    });
    return id;
  },

  copyClipToNextTrack: (clipId) => {
    const { clips } = get();
    const source = clips.find((c) => c.id === clipId);
    if (!source) return null;
    pushHistory(get, set);
    const id = newClipId();
    const copied: TimelineClip = {
      ...source,
      id,
      trackIndex: source.trackIndex + 1,
      name: source.name ? `${source.name} (轨道${source.trackIndex + 2})` : undefined,
    };
    set((s) => {
      const clips = [...s.clips, copied].sort((a, b) =>
        a.trackIndex === b.trackIndex ? a.start - b.start : a.trackIndex - b.trackIndex
      );
      return {
        clips,
        duration: getTimelineDuration(s.sourceDuration, clips),
        selectedClipId: id,
      };
    });
    return id;
  },

  rippleMoveClip: (clipId, newStart) => {
    const { clips } = get();
    const moving = clips.find((c) => c.id === clipId);
    if (!moving) return false;
    pushHistory(get, set);

    const len = moving.end - moving.start;
    const clampedStart = Math.max(0, newStart);
    const delta = clampedStart - moving.start;
    const oldEnd = moving.end;

    const next = clips.map((clip) => {
      if (clip.id === moving.id) {
        return {
          ...clip,
          start: clampedStart,
          end: clampedStart + len,
        };
      }

      // Ripple: only affect right-side clips on same track.
      if (
        clip.trackIndex === moving.trackIndex &&
        clip.start >= oldEnd &&
        clip.id !== moving.id
      ) {
        return {
          ...clip,
          start: Math.max(0, clip.start + delta),
          end: Math.max(clip.start + delta + MIN_CLIP_DURATION, clip.end + delta),
        };
      }

      return clip;
    });

    set((s) => {
      const sorted = next.sort((a, b) =>
        a.trackIndex === b.trackIndex ? a.start - b.start : a.trackIndex - b.trackIndex
      );
      return {
        clips: sorted,
        duration: getTimelineDuration(s.sourceDuration, sorted),
      };
    });
    return true;
  },

  removeClipAndRipple: (clipId) => {
    const { clips } = get();
    const target = clips.find((c) => c.id === clipId);
    if (!target) return false;
    pushHistory(get, set);

    const shift = target.end - target.start;
    const next = clips
      .filter((c) => c.id !== clipId)
      .map((clip) => {
        if (clip.trackIndex !== target.trackIndex) return clip;
        if (clip.start < target.end) return clip;
        return {
          ...clip,
          start: Math.max(0, clip.start - shift),
          end: Math.max(clip.start - shift + MIN_CLIP_DURATION, clip.end - shift),
        };
      })
      .sort((a, b) =>
        a.trackIndex === b.trackIndex ? a.start - b.start : a.trackIndex - b.trackIndex
      );

    set((s) => ({
      clips: next,
      transitions: s.transitions.filter((t) => t.fromClipId !== clipId && t.toClipId !== clipId),
      duration: getTimelineDuration(s.sourceDuration, next),
      trimEnd: Math.min(s.trimEnd, getTimelineDuration(s.sourceDuration, next)),
      selectedClipId:
        s.selectedClipId === clipId ? next[0]?.id ?? null : s.selectedClipId,
    }));
    return true;
  },

  removeRange: (start, end, ripple = true) => {
    const { clips } = get();
    const rangeStart = Math.min(start, end);
    const rangeEnd = Math.max(start, end);
    const removeLen = rangeEnd - rangeStart;
    if (
      !Number.isFinite(rangeStart) ||
      !Number.isFinite(rangeEnd) ||
      removeLen < MIN_CLIP_DURATION / 10
    ) {
      return false;
    }

    pushHistory(get, set);

    const processed: TimelineClip[] = [];
    for (const clip of clips) {
      // no overlap
      if (rangeEnd <= clip.start || rangeStart >= clip.end) {
        processed.push({ ...clip });
        continue;
      }

      // fully covered
      if (rangeStart <= clip.start && rangeEnd >= clip.end) {
        continue;
      }

      // overlap clip head: trim start to rangeEnd
      if (rangeStart <= clip.start && rangeEnd < clip.end && rangeEnd > clip.start) {
        const newStart = rangeEnd;
        if (clip.end - newStart >= MIN_CLIP_DURATION) {
          processed.push({
            ...clip,
            start: newStart,
            sourceStart: mapTimeToSource(clip, newStart),
          });
        }
        continue;
      }

      // overlap clip tail: trim end to rangeStart
      if (rangeStart > clip.start && rangeStart < clip.end && rangeEnd >= clip.end) {
        const newEnd = rangeStart;
        if (newEnd - clip.start >= MIN_CLIP_DURATION) {
          processed.push({
            ...clip,
            end: newEnd,
            sourceEnd: mapTimeToSource(clip, newEnd),
          });
        }
        continue;
      }

      // hole in the middle: split into left + right
      if (rangeStart > clip.start && rangeEnd < clip.end) {
        const leftEnd = rangeStart;
        const rightStart = rangeEnd;
        const leftDur = leftEnd - clip.start;
        const rightDur = clip.end - rightStart;
        if (leftDur >= MIN_CLIP_DURATION) {
          processed.push({
            ...clip,
            end: leftEnd,
            sourceEnd: mapTimeToSource(clip, leftEnd),
          });
        }
        if (rightDur >= MIN_CLIP_DURATION) {
          processed.push({
            ...clip,
            id: newClipId(),
            start: rightStart,
            sourceStart: mapTimeToSource(clip, rightStart),
            name: clip.name ? `${clip.name} (2)` : clip.name,
          });
        }
        continue;
      }

      // defensive fallback: compute overlap split
      const overlapStart = Math.max(clip.start, rangeStart);
      const overlapEnd = Math.min(clip.end, rangeEnd);
      if (overlapStart - clip.start >= MIN_CLIP_DURATION) {
        processed.push({
          ...clip,
          end: overlapStart,
          sourceEnd: mapTimeToSource(clip, overlapStart),
        });
      }
      if (clip.end - overlapEnd >= MIN_CLIP_DURATION) {
        processed.push({
          ...clip,
          id: newClipId(),
          start: overlapEnd,
          sourceStart: mapTimeToSource(clip, overlapEnd),
          name: clip.name ? `${clip.name} (2)` : clip.name,
        });
      }
    }

    const sorted = [...processed].sort((a, b) =>
      a.trackIndex === b.trackIndex ? a.start - b.start : a.trackIndex - b.trackIndex
    );
    const finalClips = ripple
      ? sorted.map((clip) => {
          if (clip.start < rangeEnd) return clip;
          return {
            ...clip,
            start: Math.max(0, clip.start - removeLen),
            end: Math.max(clip.start - removeLen + MIN_CLIP_DURATION, clip.end - removeLen),
          };
        })
      : sorted;

    set((s) => {
      const duration = getTimelineDuration(s.sourceDuration, finalClips);
      const normalizeTime = (time: number) => {
        if (!ripple) return clamp(time, 0, duration);
        if (time <= rangeStart) return clamp(time, 0, duration);
        if (time >= rangeEnd) return clamp(time - removeLen, 0, duration);
        return clamp(rangeStart, 0, duration);
      };
      const nextTime = normalizeTime(s.currentTime);
      const nextTrimStart = normalizeTime(s.trimStart);
      const rawTrimEnd = normalizeTime(s.trimEnd);
      const nextTrimEnd = Math.max(nextTrimStart + MIN_CLIP_DURATION, rawTrimEnd);
      return {
        clips: finalClips,
        transitions: s.transitions.filter((t) => {
          const ids = new Set(finalClips.map((c) => c.id));
          return ids.has(t.fromClipId) && ids.has(t.toClipId);
        }),
        duration,
        trimStart: clamp(nextTrimStart, 0, Math.max(0, duration - MIN_CLIP_DURATION)),
        trimEnd: clamp(nextTrimEnd, MIN_CLIP_DURATION, duration),
        currentTime: clamp(nextTime, 0, duration),
        selectedClipId:
          s.selectedClipId && finalClips.some((c) => c.id === s.selectedClipId)
            ? s.selectedClipId
            : finalClips[0]?.id ?? null,
      };
    });
    return true;
  },

  removeClip: (clipId) => {
    const { clips } = get();
    if (!clips.some((c) => c.id === clipId)) return false;
    pushHistory(get, set);
    set((s) => {
      const next = s.clips.filter((c) => c.id !== clipId);
      return {
        clips: next,
        transitions: s.transitions.filter((t) => t.fromClipId !== clipId && t.toClipId !== clipId),
        duration: getTimelineDuration(s.sourceDuration, next),
        trimEnd: Math.min(s.trimEnd, getTimelineDuration(s.sourceDuration, next)),
        selectedClipId:
          s.selectedClipId === clipId ? next[0]?.id ?? null : s.selectedClipId,
      };
    });
    return true;
  },

  addTransition: (transition) => {
    const { clips, transitions } = get();
    const from = clips.find((c) => c.id === transition.fromClipId);
    const to = clips.find((c) => c.id === transition.toClipId);
    if (!from || !to) return null;
    pushHistory(get, set);
    const nextTransition: TimelineTransition = {
      id: newTransitionId(),
      fromClipId: from.id,
      toClipId: to.id,
      type: transition.type,
      duration: Math.max(0.1, Math.min(2, transition.duration)),
    };
    set({
      transitions: [
        ...transitions.filter(
          (t) => !(t.fromClipId === from.id && t.toClipId === to.id)
        ),
        nextTransition,
      ],
    });
    return nextTransition.id;
  },

  removeTransition: (id) => {
    const { transitions } = get();
    if (!transitions.some((t) => t.id === id)) return false;
    pushHistory(get, set);
    set({ transitions: transitions.filter((t) => t.id !== id) });
    return true;
  },

  addTextClip: (content, start, end, fontSize = 36, color = "#ffffff") => {
    const text = content.trim();
    if (!text) return null;
    const safeStart = Math.max(0, start);
    const safeEnd = Math.max(safeStart + MIN_CLIP_DURATION, end);
    pushHistory(get, set);
    const id = newClipId();
    const clip: TimelineClip = {
      id,
      type: "text",
      src: "",
      start: safeStart,
      end: safeEnd,
      sourceStart: safeStart,
      sourceEnd: safeEnd,
      trackIndex: 2,
      name: "字幕",
      content: text,
      fontSize,
      fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
      color,
      position: { x: 0.5, y: 0.82 },
      animation: { type: "fadeIn", duration: 0.35 },
    };
    set((s) => {
      const clips = [...s.clips, clip].sort((a, b) =>
        a.trackIndex === b.trackIndex ? a.start - b.start : a.trackIndex - b.trackIndex
      );
      return {
        clips,
        duration: getTimelineDuration(s.sourceDuration, clips),
        selectedClipId: id,
      };
    });
    return id;
  },

  updateTextClip: (clipId, patch) => {
    const { clips } = get();
    const target = clips.find((c) => c.id === clipId);
    if (!target || target.type !== "text") return false;
    pushHistory(get, set);
    set({
      clips: clips.map((clip) =>
        clip.id === clipId
          ? {
              ...clip,
              ...patch,
              position: patch.position
                ? {
                    x: clamp(patch.position.x, 0, 1),
                    y: clamp(patch.position.y, 0, 1),
                  }
                : clip.position,
            }
          : clip
      ),
    });
    return true;
  },

  setClipSpeed: (clipId, speed) => {
    const { clips } = get();
    const target = clips.find((c) => c.id === clipId);
    if (!target || target.type !== "video") return false;
    const safeSpeed = clamp(speed, 0.1, 10);
    const sourceLen = Math.max(MIN_CLIP_DURATION, target.sourceEnd - target.sourceStart);
    const newDuration = sourceLen / safeSpeed;
    pushHistory(get, set);
    set((s) => {
      const nextClips = s.clips.map((clip) =>
        clip.id === clipId
          ? {
              ...clip,
              speed: safeSpeed,
              end: clip.start + Math.max(MIN_CLIP_DURATION, newDuration),
            }
          : clip
      );
      return {
        clips: nextClips,
        duration: getTimelineDuration(s.sourceDuration, nextClips),
      };
    });
    return true;
  },

  setClipVolume: (clipId, volume) => {
    const { clips } = get();
    if (!clips.find((c) => c.id === clipId)) return false;
    const safe = Math.max(0, Math.min(2, volume));
    pushHistory(get, set);
    set((s) => ({ clips: s.clips.map((c) => (c.id === clipId ? { ...c, volume: safe } : c)) }));
    return true;
  },

  setClipMuted: (clipId, muted) => {
    const { clips } = get();
    if (!clips.find((c) => c.id === clipId)) return false;
    pushHistory(get, set);
    set((s) => ({ clips: s.clips.map((c) => (c.id === clipId ? { ...c, muted } : c)) }));
    return true;
  },

  addKeyframe: (clipId, property, time, value, easing = "linear") => {
    const { clips } = get();
    const target = clips.find((c) => c.id === clipId);
    if (!target) return false;
    const clipLen = Math.max(MIN_CLIP_DURATION, target.end - target.start);
    const localTime = clamp(time, 0, clipLen);
    pushHistory(get, set);
    set({
      clips: clips.map((clip) => {
        if (clip.id !== clipId) return clip;
        const existing = clip.keyframes?.[property] ?? [];
        const nextForProperty = [
          ...existing,
          {
            id: newKeyframeId(),
            time: localTime,
            value,
            easing,
          },
        ].sort((a, b) => a.time - b.time);
        return {
          ...clip,
          keyframes: {
            ...(clip.keyframes ?? {}),
            [property]: nextForProperty,
          },
        };
      }),
    });
    return true;
  },

  updateKeyframe: (clipId, property, keyframeId, patch) => {
    const { clips } = get();
    const target = clips.find((c) => c.id === clipId);
    const existing = target?.keyframes?.[property] ?? [];
    if (!target || !existing.some((k) => k.id === keyframeId)) return false;
    const clipLen = Math.max(MIN_CLIP_DURATION, target.end - target.start);
    pushHistory(get, set);
    set({
      clips: clips.map((clip) => {
        if (clip.id !== clipId) return clip;
        const current = clip.keyframes?.[property] ?? [];
        const next = current
          .map((k) =>
            k.id === keyframeId
              ? {
                  ...k,
                  time:
                    patch.time === undefined
                      ? k.time
                      : clamp(patch.time, 0, clipLen),
                  value: patch.value ?? k.value,
                  easing: patch.easing ?? k.easing,
                }
              : k
          )
          .sort((a, b) => a.time - b.time);
        return {
          ...clip,
          keyframes: {
            ...(clip.keyframes ?? {}),
            [property]: next,
          },
        };
      }),
    });
    return true;
  },

  removeKeyframe: (clipId, property, keyframeId) => {
    const { clips } = get();
    const target = clips.find((c) => c.id === clipId);
    if (!target?.keyframes?.[property]?.some((k) => k.id === keyframeId)) return false;
    pushHistory(get, set);
    set({
      clips: clips.map((clip) => {
        if (clip.id !== clipId) return clip;
        const current = clip.keyframes?.[property] ?? [];
        const next = current.filter((k) => k.id !== keyframeId);
        return {
          ...clip,
          keyframes: {
            ...(clip.keyframes ?? {}),
            [property]: next,
          },
        };
      }),
    });
    return true;
  },

  applyFilter: (clipId, filterName, intensity = 1) => {
    const { clips } = get();
    if (!clips.some((c) => c.id === clipId)) return false;
    pushHistory(get, set);
    const safeIntensity = Math.max(0, Math.min(1, intensity));
    const cssValue = buildFilterCss(filterName, safeIntensity);
    set({
      clips: clips.map((clip) =>
        clip.id === clipId
          ? {
              ...clip,
              filter: {
                name: filterName,
                intensity: safeIntensity,
                cssValue,
              },
            }
          : clip
      ),
    });
    return true;
  },

  updateClip: (clipId, patch) => {
    const { clips } = get();
    if (!clips.some((c) => c.id === clipId)) return false;
    pushHistory(get, set);
    set((s) => {
      const nextClips = clips.map((clip) => {
        if (clip.id !== clipId) return clip;
        const start = patch.start ?? clip.start;
        const end = patch.end ?? clip.end;
        return {
          ...clip,
          ...patch,
          start: Math.max(0, start),
          end: Math.max(start + MIN_CLIP_DURATION, end),
        };
      });
      return {
        clips: nextClips,
        duration: getTimelineDuration(s.sourceDuration, nextClips),
      };
    });
    return true;
  },

  splitClipAt: (time, clipId) => {
    const { clips, selectedClipId } = get();
    const activeId = clipId ?? selectedClipId ?? clips[0]?.id;
    if (!activeId) return false;
    const idx = clips.findIndex((c) => c.id === activeId);
    if (idx === -1) return false;
    const clip = clips[idx];
    if (time <= clip.start + 0.05 || time >= clip.end - 0.05) return false;
    pushHistory(get, set);

    const ratio =
      (time - clip.start) / Math.max(clip.end - clip.start, MIN_CLIP_DURATION);
    const splitSource =
      clip.sourceStart + (clip.sourceEnd - clip.sourceStart) * ratio;
    const left: TimelineClip = {
      ...clip,
      end: time,
      sourceEnd: splitSource,
      keyframes: sliceKeyframes(clip, clip.start, time),
    };
    const right: TimelineClip = {
      ...clip,
      id: newClipId(),
      start: time,
      sourceStart: splitSource,
      name: clip.name ? `${clip.name} (2)` : undefined,
      keyframes: sliceKeyframes(clip, time, clip.end),
    };
    const next = [...clips];
    next.splice(idx, 1, left, right);
    set((s) => ({
      clips: next,
      transitions: s.transitions.filter((t) => {
        const ids = new Set(next.map((c) => c.id));
        return ids.has(t.fromClipId) && ids.has(t.toClipId);
      }),
      duration: getTimelineDuration(s.sourceDuration, next),
      selectedClipId: right.id,
    }));
    return true;
  },

  splitAtPlayhead: () => {
    return get().splitClipAt(get().currentTime);
  },

  trimTo: (seconds) => {
    const { duration, trimStart, clips, selectedClipId } = get();
    if (!clips.length) return false;
    pushHistory(get, set);

    const target = clamp(seconds, trimStart + MIN_CLIP_DURATION, duration);
    const activeId = selectedClipId ?? clips[0].id;
    const nextClips = clips.map((clip) => {
      if (clip.id !== activeId) return clip;
      const end = clamp(target, clip.start + MIN_CLIP_DURATION, duration);
      return {
        ...clip,
        end,
        sourceEnd: Math.max(
          clip.sourceStart + MIN_CLIP_DURATION,
          clip.sourceEnd - (clip.end - end)
        ),
      };
    });

    set({ trimEnd: target, clips: nextClips, selectedClipId: activeId });
    return true;
  },

  trimLast: (seconds) => {
    const { duration, clips, selectedClipId, trimEnd } = get();
    if (!clips.length || seconds <= 0) return false;
    pushHistory(get, set);

    const selected = clips.find((c) => c.id === selectedClipId) ?? clips[0];
    const currentEnd = selected.end;
    const target = clamp(
      currentEnd - seconds,
      selected.start + MIN_CLIP_DURATION,
      duration
    );
    if (target >= currentEnd - 0.05) return false;

    const nextClips = clips.map((clip) =>
      clip.id === selected.id
        ? {
            ...clip,
            end: target,
            sourceEnd: Math.max(
              clip.sourceStart + MIN_CLIP_DURATION,
              clip.sourceEnd - (currentEnd - target)
            ),
          }
        : clip
    );

    set({
      trimEnd: Math.min(trimEnd, target),
      clips: nextClips,
    });
    return true;
  },

  applyTrimRange: (start, end) => {
    const { duration, clips, selectedClipId } = get();
    if (!clips.length) return false;
    pushHistory(get, set);

    const trimStartVal = clamp(start, 0, duration - MIN_CLIP_DURATION);
    const trimEndVal = clamp(end, trimStartVal + MIN_CLIP_DURATION, duration);
    const activeId = selectedClipId ?? clips[0].id;
    const nextClips = clips.map((clip) => {
      if (clip.id !== activeId) return clip;
      const nextStart = clamp(trimStartVal, 0, clip.end - MIN_CLIP_DURATION);
      const nextEnd = clamp(trimEndVal, nextStart + MIN_CLIP_DURATION, duration);
      const sourceLen = Math.max(
        clip.sourceEnd - clip.sourceStart,
        MIN_CLIP_DURATION
      );
      const timelineLen = Math.max(clip.end - clip.start, MIN_CLIP_DURATION);
      const ratio = sourceLen / timelineLen;
      return {
        ...clip,
        start: nextStart,
        end: nextEnd,
        sourceStart: clip.sourceStart + (nextStart - clip.start) * ratio,
        sourceEnd: clip.sourceEnd - (clip.end - nextEnd) * ratio,
      };
    });

    set({
      trimStart: trimStartVal,
      trimEnd: trimEndVal,
      clips: nextClips,
      selectedClipId: activeId,
      currentTime: clamp(get().currentTime, trimStartVal, trimEndVal),
    });
    return true;
  },

  trimClipEdge: (clipId, edge, newTime) => {
    const { clips, duration } = get();
    const idx = clips.findIndex((c) => c.id === clipId);
    if (idx === -1) return false;
    const clip = clips[idx];
    pushHistory(get, set);

    const next = [...clips];
    if (edge === "start") {
      const start = clamp(newTime, 0, clip.end - MIN_CLIP_DURATION);
      const ratio =
        (start - clip.start) / Math.max(clip.end - clip.start, MIN_CLIP_DURATION);
      next[idx] = {
        ...clip,
        start,
        sourceStart: clip.sourceStart + (clip.sourceEnd - clip.sourceStart) * ratio,
      };
    } else {
      const end = Math.max(clip.start + MIN_CLIP_DURATION, newTime);
      const ratio =
        (clip.end - end) / Math.max(clip.end - clip.start, MIN_CLIP_DURATION);
      next[idx] = {
        ...clip,
        end,
        sourceEnd: clip.sourceEnd - (clip.sourceEnd - clip.sourceStart) * ratio,
      };
    }
    set((s) => ({
      clips: next,
      duration: getTimelineDuration(s.sourceDuration, next),
    }));
    return true;
  },

  addPendingSubtitle: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    set((s) => ({ pendingSubtitles: [...s.pendingSubtitles, trimmed] }));
  },

  addMarker: (time) => {
    const { duration, currentTime, markers } = get();
    const t = clamp(time ?? currentTime, 0, duration);
    const existing = markers.find((m) => Math.abs(m - t) <= MARKER_EPS);
    if (existing !== undefined) return existing;
    pushHistory(get, set);
    const next = [...markers, t].sort((a, b) => a - b);
    set({ markers: next });
    return t;
  },

  removeNearestMarker: (time, threshold = 0.2) => {
    const { markers } = get();
    if (!markers.length) return false;
    let bestIndex = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < markers.length; i++) {
      const dist = Math.abs(markers[i] - time);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
    if (bestIndex < 0 || bestDist > threshold) return false;
    pushHistory(get, set);
    const next = markers.filter((_, i) => i !== bestIndex);
    set({ markers: next });
    return true;
  },

  clearMarkers: () => {
    const { markers } = get();
    if (!markers.length) return;
    pushHistory(get, set);
    set({ markers: [] });
  },

  setBeatMarkers: (markers) => {
    const duration = get().duration;
    const normalized = Array.from(
      new Set(
        markers
          .filter((m) => Number.isFinite(m))
          .map((m) => clamp(m, 0, duration))
          .map((m) => Number(m.toFixed(3)))
      )
    ).sort((a, b) => a - b);
    set({ beatMarkers: normalized });
  },

  clearBeatMarkers: () => {
    const { beatMarkers } = get();
    if (!beatMarkers.length) return;
    set({ beatMarkers: [] });
  },

  detectBeatMarkers: async (clipId) => {
    const { clips, selectedClipId, setBeatMarkers } = get();
    const targetId = clipId ?? selectedClipId ?? clips.find((c) => c.type === "audio")?.id;
    if (!targetId) return [];
    const clip = clips.find((c) => c.id === targetId);
    if (!clip) return [];
    try {
      const response = await fetch(clip.src);
      const buf = await response.arrayBuffer();
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData(buf.slice(0));
      const beats = await detectBeats(decoded);
      const mapped = beats
        .filter((t) => t >= clip.sourceStart && t <= clip.sourceEnd)
        .map((t) => clip.start + (t - clip.sourceStart))
        .filter((t) => t >= clip.start && t <= clip.end);
      setBeatMarkers(mapped);
      void ctx.close();
      return mapped;
    } catch {
      return [];
    }
  },

  snapClipToNearestBeat: (clipId) => {
    const { beatMarkers, clips, selectedClipId, updateClip } = get();
    if (!beatMarkers.length) return false;
    const targetId = clipId ?? selectedClipId ?? clips[0]?.id;
    if (!targetId) return false;
    const clip = clips.find((c) => c.id === targetId);
    if (!clip) return false;
    let best = beatMarkers[0];
    let bestDist = Math.abs(best - clip.start);
    for (const beat of beatMarkers) {
      const d = Math.abs(beat - clip.start);
      if (d < bestDist) {
        best = beat;
        bestDist = d;
      }
    }
    const len = clip.end - clip.start;
    return updateClip(clip.id, { start: best, end: best + len });
  },

  reorderClips: (fromIndex, toIndex) => {
    const { clips } = get();
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= clips.length ||
      toIndex >= clips.length
    ) {
      return;
    }
    pushHistory(get, set);
    const next = [...clips];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    set({ clips: next, selectedClipId: moved.id });
  },

  normalizeTrack: (trackIndex) => {
    const { clips } = get();
    const onTrack = clips
      .filter((c) => c.trackIndex === trackIndex)
      .sort((a, b) => a.start - b.start);
    if (onTrack.length <= 1) return;
    pushHistory(get, set);
    let cursor = onTrack[0].start;
    const aligned = onTrack.map((clip) => {
      const len = clip.end - clip.start;
      const next = { ...clip, start: cursor, end: cursor + len };
      cursor += len;
      return next;
    });
    set((s) => {
      const clips = s.clips.map((c) => aligned.find((x) => x.id === c.id) ?? c);
      return {
        clips,
        duration: getTimelineDuration(s.sourceDuration, clips),
      };
    });
  },

  setSelectedClipId: (id) => set({ selectedClipId: id }),
  setEditMode: (mode) => set({ editMode: mode }),
  toggleEditMode: () =>
    set((s) => ({ editMode: s.editMode === "overwrite" ? "ripple" : "overwrite" })),

  clearTimeline: () => {
    pushHistory(get, set);
    set({
      clips: [],
      transitions: [],
      duration: get().sourceDuration,
      selectedClipId: null,
      markers: [],
      beatMarkers: [],
      trimStart: 0,
      trimEnd: get().sourceDuration,
    });
  },

  getTotalDuration: () => {
    const { clips } = get();
    if (!clips.length) return 0;
    return clips.reduce((max, clip) => Math.max(max, clip.end), 0);
  },
}));
