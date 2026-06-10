import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Link2, Minus, Plus, Scissors, Trash2 } from "lucide-react";
import { useEditorStore, type TimelineClip } from "../../stores/editor-store";
import { useProjectStore } from "../../stores/project-store";
import { useSettingsStore } from "../../stores/settings-store";
import { VideoDecoder } from "../../lib/videoDecoder";

const BASE_PPS = 80;
const SNAP_THRESHOLD_PX = 10;
const TRACK_LABEL_W = 84;
const TRACK_H = 52;
const TAIL_EXTEND_SEC = 30;
const EDGE_SCROLL_THRESHOLD_PX = 50;
const EDGE_SCROLL_MAX_SPEED = 24;
const EDGE_SCROLL_MIN_SPEED = 6;

type DragState =
  | {
      mode: "playhead";
    }
  | {
      mode: "move" | "trim-start" | "trim-end";
      clipId: string;
      startClientX: number;
      startScrollLeft: number;
      currentScrollLeft: number;
      currentClientX: number;
      currentClientY: number;
      start: number;
      end: number;
      trackIndex: number;
    }
  | null;

interface ContextMenuState {
  x: number;
  y: number;
  clipId: string;
  trackIndex: number;
}

function formatRulerLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}:${String(s).padStart(2, "0")}`;
}

function formatTimeClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function extractPeaks(
  audioBuffer: AudioBuffer,
  startSec: number,
  endSec: number,
  bins = 64
): number[] {
  const channel = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const start = Math.max(0, Math.floor(startSec * sampleRate));
  const end = Math.min(channel.length, Math.floor(endSec * sampleRate));
  if (end <= start) return Array.from({ length: bins }, () => 0);
  const samplesPerBin = Math.max(1, Math.floor((end - start) / bins));
  const peaks: number[] = [];
  for (let i = 0; i < bins; i++) {
    const from = start + i * samplesPerBin;
    const to = Math.min(end, from + samplesPerBin);
    let peak = 0;
    for (let j = from; j < to; j++) {
      const v = Math.abs(channel[j] ?? 0);
      if (v > peak) peak = v;
    }
    peaks.push(Math.min(1, peak));
  }
  return peaks;
}

export function Timeline() {
  const {
    clips,
    transitions,
    markers,
    beatMarkers,
    selectedClipId,
    currentTime,
    duration,
    sourceDuration,
    timeDisplayMode,
    zoom,
    setZoom,
    setCurrentTime,
    setSelectedClipId,
    updateClip,
    trimClipEdge,
    removeClip,
    removeClipAndRipple,
    splitClipAt,
    duplicateClip,
    copyClipToNextTrack,
    rippleMoveClip,
    normalizeTrack,
    addMarker,
    removeNearestMarker,
    clearMarkers,
    detectBeatMarkers,
    clearBeatMarkers,
    snapClipToNearestBeat,
    removeTransition,
    editMode,
    setEditMode,
    pause,
    videoFile,
  } = useEditorStore();
  const project = useProjectStore((s) => s.project);
  const language = useSettingsStore((s) => s.language);
  const text =
    language === "en"
      ? {
          rippleMode: "Ripple Mode",
          overwriteMode: "Overwrite Mode",
          addMarker: "+ Marker",
          removeMarker: "- Marker",
          clearMarkers: "Clear Markers",
          markerCount: "Markers",
          detectBeats: "Detect Beats",
          snapBeat: "Snap To Beat",
          clearBeats: "Clear Beats",
          beatCount: "Beats",
          addMarkerTip: "Add marker at playhead",
          removeMarkerTip: "Remove nearest marker",
          clearMarkerTip: "Clear all markers",
          detectBeatsTip: "Analyze beat points",
          snapBeatTip: "Snap selected clip to nearest beat",
          clearBeatTip: "Clear all beats",
          sourceEndTip: "Source ends at",
          markerTip: "Marker",
          markerDelete: "right click to remove",
          beatTip: "Beat",
          videoTrack: "Video",
          audioTrack: "Audio",
          track: "Track",
          transitionTip: "Transition",
          transitionDelete: "right click to remove",
          snapLabel: "Snap",
          autoAvoid: "Auto collision avoid",
          noGap: "No available gap on target track",
          dropPoint: "Drop target",
          menuSplit: "Split",
          menuDuplicate: "Duplicate",
          menuCopyNextTrack: "Copy To Next Track",
          menuCloseGap: "Close Gap (Ripple)",
          menuDelete: "Delete",
          menuDeleteRipple: "Delete & Ripple",
          snapPlayhead: "playhead",
          snapClipStart: "clip start",
          snapClipEnd: "clip end",
          snapClipMiddle: "clip center",
          snapMarker: "marker",
          snapSecond: "whole second",
        }
      : {
          rippleMode: "波纹模式",
          overwriteMode: "覆盖模式",
          addMarker: "+ 标记",
          removeMarker: "- 标记",
          clearMarkers: "清空标记",
          markerCount: "标记",
          detectBeats: "分析节拍",
          snapBeat: "对齐节拍",
          clearBeats: "清空节拍",
          beatCount: "节拍",
          addMarkerTip: "添加标记点 (在播放头)",
          removeMarkerTip: "删除最近标记点",
          clearMarkerTip: "清空标记点",
          detectBeatsTip: "分析节拍",
          snapBeatTip: "将选中片段对齐最近节拍",
          clearBeatTip: "清空节拍点",
          sourceEndTip: "原视频结束",
          markerTip: "标记点",
          markerDelete: "右键删除",
          beatTip: "节拍点",
          videoTrack: "视频轨",
          audioTrack: "音频轨",
          track: "轨道",
          transitionTip: "转场",
          transitionDelete: "右键删除",
          snapLabel: "吸附",
          autoAvoid: "自动错位避让",
          noGap: "目标轨道无可用空隙",
          dropPoint: "目标轨道落点",
          menuSplit: "分割",
          menuDuplicate: "复制",
          menuCopyNextTrack: "复制到下一轨",
          menuCloseGap: "删除空隙(波纹整理)",
          menuDelete: "删除",
          menuDeleteRipple: "删除并闭合间隙",
          snapPlayhead: "播放头",
          snapClipStart: "片段起点",
          snapClipEnd: "片段终点",
          snapClipMiddle: "片段中点",
          snapMarker: "标记点",
          snapSecond: "整数秒",
        };

  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<Map<string, string>>(new Map());
  const waveformCacheRef = useRef<Map<string, number[]>>(new Map());
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const dragRef = useRef<DragState>(null);
  const pointerClientXRef = useRef<number | null>(null);
  const autoScrollRafRef = useRef(0);
  const [drag, setDrag] = useState<DragState>(null);
  const [snapLineX, setSnapLineX] = useState<number | null>(null);
  const [snapHint, setSnapHint] = useState<string>("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [viewRange, setViewRange] = useState({ start: 0, end: 12 });
  const [, forceThumbRender] = useState(0);

  const pps = BASE_PPS * zoom;
  const timelineLimit = Math.max(duration + TAIL_EXTEND_SEC, sourceDuration);
  const timelineW = Math.max(timelineLimit * pps, 600);
  const timelineTimeLabel =
    timeDisplayMode === "seconds"
      ? `${currentTime.toFixed(3)}s`
      : formatTimeClock(currentTime);

  const tracks = useMemo(() => {
    const byTrack = new Map<number, TimelineClip[]>();
    for (const clip of clips) {
      const list = byTrack.get(clip.trackIndex) ?? [];
      list.push(clip);
      byTrack.set(clip.trackIndex, list);
    }
    const maxTrackIndex = Math.max(
      1,
      ...Array.from(byTrack.keys(), (v) => v),
      1
    );
    const result: { index: number; clips: TimelineClip[] }[] = [];
    for (let i = 0; i <= maxTrackIndex; i++) {
      result.push({
        index: i,
        clips: (byTrack.get(i) ?? []).sort((a, b) => a.start - b.start),
      });
    }
    return result;
  }, [clips]);

  const marks = useMemo(() => {
    const list: { sec: number; major: boolean }[] = [];
    const maxSec = Math.ceil(timelineLimit);
    for (let s = 0; s <= maxSec; s++) {
      list.push({ sec: s, major: s % 5 === 0 });
    }
    return list;
  }, [timelineLimit]);

  useEffect(() => {
    if (!videoFile) {
      thumbnailsRef.current.clear();
      waveformCacheRef.current.clear();
      audioBufferRef.current = null;
      forceThumbRender((n) => n + 1);
      return;
    }

    let cancelled = false;
    const loadThumbs = async () => {
      const decoder = await VideoDecoder.create(videoFile);
      try {
        for (const clip of clips) {
          if (clip.type !== "video") continue;
          if (thumbnailsRef.current.has(clip.id)) continue;
          const bitmap = await decoder.getFrameAtTime(clip.sourceStart);
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0);
            const url = canvas.toDataURL("image/jpeg", 0.7);
            thumbnailsRef.current.set(clip.id, url);
            if (!cancelled) forceThumbRender((n) => n + 1);
          }
          bitmap.close();
          if (cancelled) break;
        }
      } finally {
        decoder.dispose();
      }
    };

    void loadThumbs();
    return () => {
      cancelled = true;
    };
  }, [clips, videoFile]);

  useEffect(() => {
    if (!videoFile) return;
    let cancelled = false;
    const loadAudio = async () => {
      try {
        const arrayBuffer = await videoFile.arrayBuffer();
        const audioCtx = new AudioContext();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
        if (!cancelled) {
          audioBufferRef.current = decoded;
          waveformCacheRef.current.clear();
          forceThumbRender((n) => n + 1);
        }
        void audioCtx.close();
      } catch {
        audioBufferRef.current = null;
      }
    };
    void loadAudio();
    return () => {
      cancelled = true;
    };
  }, [videoFile]);

  const getWaveformBins = useCallback(
    (clip: TimelineClip) => {
      const px = Math.max(8, (clip.end - clip.start) * pps);
      return Math.max(24, Math.min(240, Math.round(px / 3)));
    },
    [pps]
  );

  const getWaveformKey = useCallback((clip: TimelineClip, bins: number) => {
    return `${clip.id}:${bins}:${clip.sourceStart.toFixed(3)}:${clip.sourceEnd.toFixed(3)}`;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const updateView = () => {
      const start = Math.max(0, (el.scrollLeft - TRACK_LABEL_W) / pps);
      const end = Math.max(start, (el.scrollLeft + el.clientWidth - TRACK_LABEL_W) / pps);
      setViewRange({ start, end });
    };
    updateView();
    el.addEventListener("scroll", updateView, { passive: true });
    window.addEventListener("resize", updateView);
    return () => {
      el.removeEventListener("scroll", updateView);
      window.removeEventListener("resize", updateView);
    };
  }, [pps, tracks.length]);

  useEffect(() => {
    const audioBuffer = audioBufferRef.current;
    if (!audioBuffer) return;
    const preloadPaddingSec = 3;
    let updated = false;
    for (const clip of clips) {
      if (clip.type === "text") continue;
      if (
        clip.end < viewRange.start - preloadPaddingSec ||
        clip.start > viewRange.end + preloadPaddingSec
      ) {
        continue;
      }
      const bins = getWaveformBins(clip);
      const key = getWaveformKey(clip, bins);
      if (waveformCacheRef.current.has(key)) continue;
      const peaks = extractPeaks(audioBuffer, clip.sourceStart, clip.sourceEnd, bins);
      waveformCacheRef.current.set(key, peaks);
      updated = true;
    }
    if (updated) forceThumbRender((n) => n + 1);
  }, [clips, getWaveformBins, getWaveformKey, viewRange.end, viewRange.start]);

  const getTimeFromClientX = useCallback(
    (clientX: number, el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const scroll = scrollRef.current?.scrollLeft ?? 0;
      const x = clientX - rect.left + scroll - TRACK_LABEL_W;
      return Math.max(0, Math.min(timelineLimit, x / pps));
    },
    [timelineLimit, pps]
  );

  const getTrackIndexFromClientY = useCallback((clientY: number) => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const localY = clientY - rect.top + el.scrollTop - 26;
    const idx = Math.floor(localY / TRACK_H);
    const maxTrack = Math.max(0, tracks.length - 1);
    return Math.max(0, Math.min(maxTrack, idx));
  }, [tracks.length]);

  const getSnap = useCallback(
    (rawTime: number, movingClipId?: string, updateHint = true) => {
      const candidatePx = rawTime * pps;
      let bestTime = rawTime;
      let bestDist = SNAP_THRESHOLD_PX + 1;
      let reason = "";

      const check = (time: number, tag: string) => {
        const dist = Math.abs(time * pps - candidatePx);
        if (dist <= SNAP_THRESHOLD_PX && dist < bestDist) {
          bestDist = dist;
          bestTime = time;
          reason = tag;
        }
      };

      check(currentTime, text.snapPlayhead);
      for (const c of clips) {
        if (c.id === movingClipId) continue;
        check(c.start, text.snapClipStart);
        check(c.end, text.snapClipEnd);
        check(c.start + (c.end - c.start) / 2, text.snapClipMiddle);
      }
      for (const marker of markers) {
        check(marker, text.snapMarker);
      }
      const sec = Math.round(rawTime);
      check(sec, text.snapSecond);

      if (bestDist <= SNAP_THRESHOLD_PX) {
        if (updateHint) {
          setSnapLineX(TRACK_LABEL_W + bestTime * pps);
          setSnapHint(reason);
        }
        return bestTime;
      }
      if (updateHint) {
        setSnapLineX(null);
        setSnapHint("");
      }
      return rawTime;
    },
    [clips, currentTime, markers, pps, text]
  );

  const resolveTrackDropStart = useCallback(
    (movingClipId: string, desiredStart: number, len: number, targetTrackIndex: number) => {
      const maxStart = Math.max(0, timelineLimit - len);
      const desired = Math.max(0, Math.min(desiredStart, maxStart));
      const onTrack = clips
        .filter((c) => c.trackIndex === targetTrackIndex && c.id !== movingClipId)
        .sort((a, b) => a.start - b.start);
      let cursor = 0;
      for (const c of onTrack) {
        const gapStart = cursor;
        const gapEnd = c.start;
        const candidate = Math.max(desired, gapStart);
        if (candidate + len <= gapEnd) {
          return { start: candidate, valid: true, shifted: Math.abs(candidate - desired) > 0.0005 };
        }
        cursor = Math.max(cursor, c.end);
      }
      const tailCandidate = Math.max(desired, cursor);
      if (tailCandidate + len <= timelineLimit) {
        return {
          start: tailCandidate,
          valid: true,
          shifted: Math.abs(tailCandidate - desired) > 0.0005,
        };
      }
      return { start: desired, valid: false, shifted: false };
    },
    [clips, timelineLimit]
  );

  const dragPreview = useMemo(() => {
    if (!drag || drag.mode !== "move") return null;
    const len = drag.end - drag.start;
    const delta =
      (drag.currentClientX -
        drag.startClientX +
        (drag.currentScrollLeft - drag.startScrollLeft)) /
      pps;
    const rawStart = Math.max(0, Math.min(timelineLimit - len, drag.start + delta));
    const snappedStart = getSnap(rawStart, drag.clipId, false);
    const targetTrackIndex = getTrackIndexFromClientY(drag.currentClientY);
    const shouldResolveCollision =
      editMode === "overwrite" || targetTrackIndex !== drag.trackIndex;
    const resolved = shouldResolveCollision
      ? resolveTrackDropStart(drag.clipId, snappedStart, len, targetTrackIndex)
      : { start: snappedStart, valid: true, shifted: false };
    return {
      snappedStart,
      dropStart: resolved.start,
      targetTrackIndex,
      len,
      autoOffset: resolved.shifted,
      dropValid: resolved.valid,
    };
  }, [
    drag,
    editMode,
    getSnap,
    getTrackIndexFromClientY,
    pps,
    resolveTrackDropStart,
    timelineLimit,
  ]);

  const draggingClip = useMemo(() => {
    if (!drag || drag.mode !== "move") return null;
    return clips.find((c) => c.id === drag.clipId) ?? null;
  }, [clips, drag]);

  const targetTrackOccupied = useMemo(() => {
    if (!drag || drag.mode !== "move" || !dragPreview) return [];
    return clips
      .filter(
        (c) =>
          c.trackIndex === dragPreview.targetTrackIndex &&
          c.id !== drag.clipId
      )
      .map((c) => ({ start: c.start, end: c.end }));
  }, [clips, drag, dragPreview]);

  const transitionMarkers = useMemo(() => {
    return transitions.flatMap((transition) => {
      const from = clips.find((clip) => clip.id === transition.fromClipId);
      const to = clips.find((clip) => clip.id === transition.toClipId);
      if (!from || !to || from.trackIndex !== to.trackIndex) return [];
      return [
        {
          id: transition.id,
          type: transition.type,
          duration: transition.duration,
          trackIndex: from.trackIndex,
          time: to.start,
        },
      ];
    });
  }, [clips, transitions]);

  const onRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = getTimeFromClientX(e.clientX, e.currentTarget);
    if (e.altKey || e.metaKey) {
      const removed = removeNearestMarker(t, 0.15);
      if (!removed) addMarker(t);
      return;
    }
    pause();
    setDrag({ mode: "playhead" });
    setCurrentTime(t);
  };

  const onRulerDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = getTimeFromClientX(e.clientX, e.currentTarget);
    addMarker(t);
  };

  const onClipMouseDown = (
    e: React.MouseEvent,
    clip: TimelineClip,
    mode: "move" | "trim-start" | "trim-end"
  ) => {
    e.stopPropagation();
    pause();
    setSelectedClipId(clip.id);
    const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
    setDrag({
      mode,
      clipId: clip.id,
      startClientX: e.clientX,
      startScrollLeft: scrollLeft,
      currentScrollLeft: scrollLeft,
      start: clip.start,
      end: clip.end,
      trackIndex: clip.trackIndex,
      currentClientX: e.clientX,
      currentClientY: e.clientY,
    });
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag) return;
    pointerClientXRef.current = e.clientX;
    dragRef.current = drag;
    if (drag.mode === "playhead") {
      const t = getTimeFromClientX(e.clientX, e.currentTarget);
      setCurrentTime(getSnap(t));
      return;
    }

    const clip = clips.find((c) => c.id === drag.clipId);
    if (!clip) return;
    const scrollLeft = scrollRef.current?.scrollLeft ?? drag.currentScrollLeft;
    const delta =
      (e.clientX - drag.startClientX + (scrollLeft - drag.startScrollLeft)) / pps;

    if (drag.mode === "move") {
      const len = drag.end - drag.start;
      const rawStart = Math.max(0, Math.min(timelineLimit - len, drag.start + delta));
      void getSnap(rawStart, clip.id);
      setDrag({
        ...drag,
        currentClientX: e.clientX,
        currentClientY: e.clientY,
        currentScrollLeft: scrollLeft,
      });
      return;
    }

    if (drag.mode === "trim-start") {
      const raw = Math.max(0, Math.min(drag.end - 0.1, drag.start + delta));
      const snapped = getSnap(raw, clip.id);
      void trimClipEdge(clip.id, "start", snapped);
      return;
    }

    if (drag.mode === "trim-end") {
      const raw = Math.min(timelineLimit, Math.max(drag.start + 0.1, drag.end + delta));
      const snapped = getSnap(raw, clip.id);
      void trimClipEdge(clip.id, "end", snapped);
    }
  };

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    if (!drag || drag.mode !== "move") {
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = 0;
      }
      pointerClientXRef.current = null;
      return;
    }

    const tick = () => {
      const active = dragRef.current;
      const pointerX = pointerClientXRef.current;
      const scroller = scrollRef.current;
      if (!active || active.mode !== "move" || !scroller || pointerX == null) {
        autoScrollRafRef.current = requestAnimationFrame(tick);
        return;
      }

      const rect = scroller.getBoundingClientRect();
      let speed = 0;
      if (pointerX > rect.right - EDGE_SCROLL_THRESHOLD_PX) {
        const ratio = Math.min(
          1,
          (pointerX - (rect.right - EDGE_SCROLL_THRESHOLD_PX)) /
            EDGE_SCROLL_THRESHOLD_PX
        );
        speed =
          EDGE_SCROLL_MIN_SPEED + ratio * (EDGE_SCROLL_MAX_SPEED - EDGE_SCROLL_MIN_SPEED);
      } else if (pointerX < rect.left + EDGE_SCROLL_THRESHOLD_PX) {
        const ratio = Math.min(
          1,
          (rect.left + EDGE_SCROLL_THRESHOLD_PX - pointerX) /
            EDGE_SCROLL_THRESHOLD_PX
        );
        speed =
          -(EDGE_SCROLL_MIN_SPEED +
            ratio * (EDGE_SCROLL_MAX_SPEED - EDGE_SCROLL_MIN_SPEED));
      }

      if (speed !== 0) {
        const prev = scroller.scrollLeft;
        const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
        const next = Math.max(0, Math.min(maxScroll, prev + speed));
        if (Math.abs(next - prev) > 0.01) {
          scroller.scrollLeft = next;
          setDrag((curr) =>
            curr && curr.mode === "move"
              ? {
                  ...curr,
                  currentScrollLeft: next,
                  currentClientX: pointerX,
                }
              : curr
          );
        }
      }

      autoScrollRafRef.current = requestAnimationFrame(tick);
    };

    autoScrollRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = 0;
      }
    };
  }, [drag]);

  const endDrag = () => {
    if (drag && drag.mode === "move") {
      const clip = clips.find((c) => c.id === drag.clipId);
      if (clip && dragPreview) {
        if (!dragPreview.dropValid) {
          setDrag(null);
          setSnapLineX(null);
          setSnapHint("");
          return;
        }
        if (editMode === "ripple" && dragPreview.targetTrackIndex === clip.trackIndex) {
          rippleMoveClip(clip.id, dragPreview.dropStart);
        } else {
          void updateClip(clip.id, {
            start: dragPreview.dropStart,
            end: dragPreview.dropStart + dragPreview.len,
            trackIndex: dragPreview.targetTrackIndex,
          });
        }
      }
    } else if (drag && drag.mode !== "playhead" && editMode === "ripple") {
      normalizeTrack(drag.trackIndex);
    }
    setDrag(null);
    pointerClientXRef.current = null;
    if (autoScrollRafRef.current) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = 0;
    }
    setSnapLineX(null);
    setSnapHint("");
  };

  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
    if (!contextMenu) return;
    const onGlobalClick = () => closeContextMenu();
    window.addEventListener("click", onGlobalClick);
    return () => window.removeEventListener("click", onGlobalClick);
  }, [contextMenu]);

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(zoom + delta);
  };

  const onTimelineDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const mediaId =
        e.dataTransfer.getData("application/x-zhiying-media-id") ||
        e.dataTransfer.getData("text/plain");
      const mediaUrl = e.dataTransfer.getData("text/uri-list");
      const item = project.mediaItems.find((m) => m.id === mediaId) ??
        (mediaUrl ? project.mediaItems.find((m) => m.url === mediaUrl) : undefined);
      if (!item) return;

      const store = useEditorStore.getState();
      if (!store.videoFile && item.type === "video") {
        store.setVideoFile(item.file, item.url);
        store.setDuration(Math.max(0.1, item.duration || 1));
      }
      const baseTrack = Math.max(0, getTrackIndexFromClientY(e.clientY));
      const trackIndex = item.type === "audio" ? Math.max(1, baseTrack) : baseTrack;
      const start = getTimeFromClientX(e.clientX, e.currentTarget);
      const clipLength = Math.max(0.1, item.duration || 1);
      const end = start + clipLength;
      const safeStart = end <= start ? Math.max(0, end - 0.1) : start;

      const createdId = store.addClip({
        type: item.type as "video" | "audio" | "text",
        src: item.url,
        start: safeStart,
        end,
        sourceStart: 0,
        sourceEnd: Math.max(0.1, item.duration || end - safeStart),
        trackIndex,
        name: item.name,
      });
      setSelectedClipId(createdId);
    },
    [getTimeFromClientX, getTrackIndexFromClientY, project.mediaItems, setSelectedClipId]
  );

  return (
    <div className="flex h-full flex-col select-none" style={{ backgroundColor: "var(--bg-secondary)" }}>
      <div
        className="flex items-center justify-between border-b px-2 py-1"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {timelineTimeLabel}
          </span>
          <button
            type="button"
            onClick={() =>
              setEditMode(editMode === "overwrite" ? "ripple" : "overwrite")
            }
            className="rounded px-2 py-0.5 text-[10px]"
            style={{
              border: "1px solid var(--border)",
              color: editMode === "ripple" ? "var(--accent)" : "var(--text-secondary)",
              backgroundColor:
                editMode === "ripple"
                  ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                  : "transparent",
            }}
          >
            {editMode === "ripple" ? text.rippleMode : text.overwriteMode}
          </button>
          <button
            type="button"
            className="tool-btn rounded px-2 py-0.5 text-[10px]"
            onClick={() => addMarker()}
            title={text.addMarkerTip}
          >
            {text.addMarker}
          </button>
          <button
            type="button"
            className="tool-btn rounded px-2 py-0.5 text-[10px]"
            onClick={() => removeNearestMarker(currentTime, 0.2)}
            title={text.removeMarkerTip}
          >
            {text.removeMarker}
          </button>
          <button
            type="button"
            className="tool-btn rounded px-2 py-0.5 text-[10px]"
            onClick={clearMarkers}
            title={text.clearMarkerTip}
          >
            {text.clearMarkers}
          </button>
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {text.markerCount} {markers.length}
          </span>
          <button
            type="button"
            className="tool-btn rounded px-2 py-0.5 text-[10px]"
            onClick={() => void detectBeatMarkers()}
            title={text.detectBeatsTip}
          >
            {text.detectBeats}
          </button>
          <button
            type="button"
            className="tool-btn rounded px-2 py-0.5 text-[10px]"
            onClick={() => snapClipToNearestBeat()}
            title={text.snapBeatTip}
          >
            {text.snapBeat}
          </button>
          <button
            type="button"
            className="tool-btn rounded px-2 py-0.5 text-[10px]"
            onClick={clearBeatMarkers}
            title={text.clearBeatTip}
          >
            {text.clearBeats}
          </button>
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {text.beatCount} {beatMarkers.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="tool-btn flex h-5 w-5 items-center justify-center" onClick={() => setZoom(zoom - 0.2)}>
            <Minus size={10} />
          </button>
          <span className="w-10 text-center text-[10px]" style={{ color: "var(--text-secondary)" }}>
            {zoom.toFixed(1)}x
          </span>
          <button className="tool-btn flex h-5 w-5 items-center justify-center" onClick={() => setZoom(zoom + 0.2)}>
            <Plus size={10} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={onTimelineDrop}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onWheel={onWheel}
      >
        <div style={{ width: TRACK_LABEL_W + timelineW, minHeight: tracks.length * TRACK_H + 26 }}>
          <div
            className="sticky top-0 z-20 h-6 cursor-crosshair border-b"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
            onMouseDown={onRulerMouseDown}
            onDoubleClick={onRulerDoubleClick}
          >
            <div className="absolute left-0 top-0 h-full" style={{ width: TRACK_LABEL_W }} />
            <div className="absolute left-0 top-0 h-full" style={{ marginLeft: TRACK_LABEL_W, width: timelineW }}>
              {marks.map(({ sec, major }) => (
                <div key={sec} className="absolute top-0" style={{ left: sec * pps }}>
                  {major && (
                    <span className="absolute left-1 top-0.5 text-[9px]" style={{ color: "var(--text-secondary)" }}>
                      {formatRulerLabel(sec)}
                    </span>
                  )}
                  <div
                    className="absolute bottom-0 left-0 w-px"
                    style={{
                      height: major ? 10 : 5,
                      backgroundColor: major ? "var(--border-strong)" : "var(--border)",
                    }}
                  />
                </div>
              ))}
              {sourceDuration > 0 && sourceDuration < timelineLimit && (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-10 w-px"
                  style={{
                    left: sourceDuration * pps,
                    backgroundColor: "color-mix(in srgb, var(--accent) 55%, transparent)",
                  }}
                  title={`${text.sourceEndTip} ${sourceDuration.toFixed(2)}s`}
                />
              )}
              {markers.map((marker) => (
                <button
                  key={`marker-${marker.toFixed(3)}`}
                  type="button"
                  className="absolute top-0 h-full w-2 -translate-x-1 cursor-pointer"
                  style={{ left: marker * pps }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setCurrentTime(marker);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeNearestMarker(marker, 0.01);
                  }}
                  title={`${text.markerTip} ${marker.toFixed(2)}s (${text.markerDelete})`}
                >
                  <span
                    className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: "var(--accent)" }}
                  />
                  <span
                    className="absolute left-1/2 top-1.5 h-[calc(100%-6px)] w-px -translate-x-1/2"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--accent) 60%, transparent)",
                    }}
                  />
                </button>
              ))}
              {beatMarkers.map((beat) => (
                <div
                  key={`beat-${beat.toFixed(3)}`}
                  className="pointer-events-none absolute top-0 h-full w-px"
                  style={{
                    left: beat * pps,
                    backgroundColor:
                      "color-mix(in srgb, var(--accent) 40%, rgba(255,0,0,0.85))",
                  }}
                  title={`${text.beatTip} ${beat.toFixed(2)}s`}
                />
              ))}
            </div>

            <div
              className="pointer-events-none absolute top-0 z-30"
              style={{ left: TRACK_LABEL_W + currentTime * pps }}
            >
              <div className="h-2 w-2 rotate-45" style={{ backgroundColor: "var(--accent)" }} />
            </div>
          </div>

          {tracks.map((track) => (
            <div
              key={track.index}
              className="relative border-b"
              style={{
                borderColor: "var(--border)",
                height: TRACK_H,
                backgroundColor:
                  drag &&
                  drag.mode === "move" &&
                  dragPreview &&
                  dragPreview.targetTrackIndex === track.index
                    ? dragPreview.dropValid
                      ? "color-mix(in srgb, var(--accent) 9%, var(--bg-secondary))"
                      : "color-mix(in srgb, var(--text-primary) 10%, var(--bg-secondary))"
                    : "var(--bg-secondary)",
              }}
              onDoubleClick={(e) => {
                const t = getTimeFromClientX(e.clientX, e.currentTarget as HTMLDivElement);
                setCurrentTime(t);
              }}
            >
              <div
                className="absolute left-0 top-0 flex h-full items-center justify-center border-r text-[10px]"
                style={{
                  width: TRACK_LABEL_W,
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  backgroundColor: "var(--bg-primary)",
                }}
              >
                {track.index === 0
                  ? text.videoTrack
                  : track.index === 1
                    ? text.audioTrack
                    : `${text.track} ${track.index + 1}`}
              </div>

              <div className="relative h-full" style={{ marginLeft: TRACK_LABEL_W }}>
                {transitionMarkers
                  .filter((t) => t.trackIndex === track.index)
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="absolute top-0 z-10 -translate-x-1/2 rounded border px-1 py-0.5 text-[9px] hover:bg-hover"
                      style={{
                        left: t.time * pps,
                        borderColor: "var(--border)",
                        backgroundColor: "color-mix(in srgb, var(--bg-primary) 90%, transparent)",
                        color: "var(--text-secondary)",
                      }}
                      title={`${text.transitionTip} ${t.type} · ${t.duration.toFixed(1)}s (${text.transitionDelete})`}
                      onMouseDown={(e) => e.stopPropagation()}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeTransition(t.id);
                      }}
                    >
                      <Link2 size={10} />
                    </button>
                  ))}
                {drag &&
                  drag.mode === "move" &&
                  dragPreview &&
                  dragPreview.targetTrackIndex === track.index &&
                  targetTrackOccupied.map((seg, i) => (
                    <div
                      key={`occupied-${track.index}-${i}`}
                      className="pointer-events-none absolute top-1.5 h-[calc(100%-12px)]"
                      style={{
                        left: seg.start * pps,
                        width: Math.max(2, (seg.end - seg.start) * pps),
                        backgroundColor:
                          "color-mix(in srgb, var(--text-primary) 16%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--text-primary) 28%, transparent)",
                        borderRadius: "4px",
                      }}
                    />
                  ))}
                {track.clips.map((clip) => {
                  const left = clip.start * pps;
                  const width = Math.max((clip.end - clip.start) * pps, 8);
                  const selected = clip.id === selectedClipId;
                  return (
                    <div
                      key={clip.id}
                      className={`timeline-clip absolute top-1.5 h-[calc(100%-12px)] ${selected ? "timeline-clip--selected" : ""}`}
                      style={{
                        left:
                          drag &&
                          drag.mode === "move" &&
                          drag.clipId === clip.id &&
                          dragPreview
                            ? dragPreview.dropStart * pps
                            : left,
                        width,
                        backgroundColor: clip.type === "audio" ? "var(--bg-layer-2)" : "var(--bg-primary)",
                        backgroundImage:
                          clip.type === "video" && thumbnailsRef.current.get(clip.id)
                            ? `linear-gradient(to top, color-mix(in srgb, var(--bg-primary) 75%, transparent), color-mix(in srgb, var(--bg-primary) 75%, transparent)), url(${thumbnailsRef.current.get(clip.id)})`
                            : undefined,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        opacity:
                          drag &&
                          drag.mode === "move" &&
                          drag.clipId === clip.id &&
                          dragPreview &&
                          dragPreview.targetTrackIndex !== clip.trackIndex
                            ? 0.35
                            : 1,
                      }}
                      onMouseDown={(e) => onClipMouseDown(e, clip, "move")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClipId(clip.id);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedClipId(clip.id);
                        setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id, trackIndex: clip.trackIndex });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setCurrentTime(clip.start);
                      }}
                      title={`${clip.name ?? clip.type} ${clip.start.toFixed(2)}s - ${clip.end.toFixed(2)}s`}
                    >
                      <div
                        className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize"
                        onMouseDown={(e) => onClipMouseDown(e, clip, "trim-start")}
                      />
                      <div
                        className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize"
                        onMouseDown={(e) => onClipMouseDown(e, clip, "trim-end")}
                      />
                      {(() => {
                        const bins = getWaveformBins(clip);
                        const key = getWaveformKey(clip, bins);
                        const wave = waveformCacheRef.current.get(key);
                        if (!wave) return null;
                        return (
                        <div className="pointer-events-none absolute inset-x-1 bottom-1 top-5 flex items-center gap-[1px]">
                          {wave.map((v, i) => (
                            <div
                              key={i}
                              className="flex-1"
                              style={{
                                height: `${Math.max(8, Math.round(v * 100))}%`,
                                backgroundColor: "color-mix(in srgb, var(--text-secondary) 55%, transparent)",
                                borderRadius: "1px",
                              }}
                            />
                          ))}
                        </div>
                        );
                      })()}
                      <div className="pointer-events-none px-2 pt-1 text-[9px]" style={{ color: "var(--text-secondary)" }}>
                        {clip.name ?? clip.type} · {(clip.end - clip.start).toFixed(1)}s
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div
            className="pointer-events-none absolute top-0 z-30 w-px"
            style={{
              left: TRACK_LABEL_W + currentTime * pps,
              height: tracks.length * TRACK_H + 26,
              backgroundColor: "var(--accent)",
            }}
          />

          {snapLineX !== null && (
            <>
              <div
                className="pointer-events-none absolute top-0 z-20 w-px"
                style={{
                  left: snapLineX,
                  height: tracks.length * TRACK_H + 26,
                  backgroundColor: "color-mix(in srgb, var(--accent) 70%, white)",
                }}
              />
              {snapHint && (
                <div
                  className="pointer-events-none absolute z-20 rounded px-1 py-0.5 text-[9px]"
                  style={{
                    left: snapLineX + 4,
                    top: 28,
                    color: "var(--accent)",
                    backgroundColor: "color-mix(in srgb, var(--bg-primary) 92%, transparent)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {text.snapLabel}: {snapHint}
                </div>
              )}
              {dragPreview?.autoOffset && (
                <div
                  className="pointer-events-none absolute z-20 rounded px-1 py-0.5 text-[9px]"
                  style={{
                    left: TRACK_LABEL_W + dragPreview.dropStart * pps + 4,
                    top: 44,
                    color: "var(--text-primary)",
                    backgroundColor: "color-mix(in srgb, var(--bg-primary) 92%, transparent)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {text.autoAvoid}
                </div>
              )}
            </>
          )}

          {dragPreview && !dragPreview.dropValid && (
            <div
              className="pointer-events-none absolute z-20 rounded px-1 py-0.5 text-[9px]"
              style={{
                left: TRACK_LABEL_W + dragPreview.snappedStart * pps + 4,
                top: 44,
                color: "var(--text-primary)",
                backgroundColor: "color-mix(in srgb, var(--bg-primary) 92%, transparent)",
                border: "1px solid var(--border)",
              }}
            >
              {text.noGap}
            </div>
          )}

          {drag &&
            drag.mode === "move" &&
            dragPreview &&
            draggingClip &&
            dragPreview.targetTrackIndex !== draggingClip.trackIndex && (
              <div
                className="pointer-events-none absolute z-20 rounded"
                style={{
                  left: TRACK_LABEL_W + dragPreview.dropStart * pps,
                  top: 26 + dragPreview.targetTrackIndex * TRACK_H + 1.5,
                  width: Math.max(8, dragPreview.len * pps),
                  height: TRACK_H - 12,
                  border: dragPreview.dropValid
                    ? "1px dashed var(--accent)"
                    : "1px dashed var(--text-primary)",
                  backgroundColor: dragPreview.dropValid
                    ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                    : "color-mix(in srgb, var(--text-primary) 12%, transparent)",
                }}
                title={dragPreview.dropValid ? text.dropPoint : text.noGap}
              />
            )}
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 min-w-32 overflow-hidden rounded-md"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <MenuItem
            icon={<Scissors size={12} />}
            label={text.menuSplit}
            onClick={() => {
              splitClipAt(currentTime, contextMenu.clipId);
              closeContextMenu();
            }}
          />
          <MenuItem
            icon={<Copy size={12} />}
            label={text.menuDuplicate}
            onClick={() => {
              duplicateClip(contextMenu.clipId);
              closeContextMenu();
            }}
          />
          <MenuItem
            icon={<Copy size={12} />}
            label={text.menuCopyNextTrack}
            onClick={() => {
              copyClipToNextTrack(contextMenu.clipId);
              closeContextMenu();
            }}
          />
          <MenuItem
            icon={<Plus size={12} />}
            label={text.menuCloseGap}
            onClick={() => {
              normalizeTrack(contextMenu.trackIndex);
              closeContextMenu();
            }}
          />
          <MenuItem
            icon={<Trash2 size={12} />}
            label={text.menuDelete}
            danger
            onClick={() => {
              removeClip(contextMenu.clipId);
              closeContextMenu();
            }}
          />
          <MenuItem
            icon={<Trash2 size={12} />}
            label={text.menuDeleteRipple}
            danger
            onClick={() => {
              removeClipAndRipple(contextMenu.clipId);
              closeContextMenu();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-hover"
      style={{
        color: danger
          ? "color-mix(in srgb, var(--accent) 82%, var(--text-primary))"
          : "var(--text-primary)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
