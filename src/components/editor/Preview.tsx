import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useEditorStore, type Keyframe, type KeyframeProperty, type TimelineClip } from "../../stores/editor-store";
import { formatTime } from "../../stores/types";
import { buildFilterCss } from "../../lib/filters";
import { useSettingsStore } from "../../stores/settings-store";

const CLIP_EPS = 1e-4;

function getCurrentClipAndOffset(
  clips: Array<{
    id: string;
    start: number;
    end: number;
    sourceStart: number;
    sourceEnd: number;
  }>,
  currentTime: number
): { clip: (typeof clips)[number]; offset: number } | null {
  const inRange =
    clips.find((clip) => clip.start <= currentTime && currentTime < clip.end - CLIP_EPS) ?? null;
  const atBoundary =
    clips.find((clip) => Math.abs(clip.start - currentTime) <= CLIP_EPS) ??
    clips.find(
      (clip) =>
        Math.abs(clip.end - currentTime) <= CLIP_EPS &&
        clips.some((next) => next.id !== clip.id && Math.abs(next.start - currentTime) <= CLIP_EPS)
    ) ??
    null;
  const clip = inRange ?? atBoundary;
  if (!clip) {
    if (import.meta.env.DEV) {
      console.debug("[Preview] no clip matched", { currentTime });
    }
    return null;
  }
  const timelineLen = Math.max(CLIP_EPS, clip.end - clip.start);
  const sourceLen = Math.max(CLIP_EPS, clip.sourceEnd - clip.sourceStart);
  const ratio = sourceLen / timelineLen;
  const offset = clip.sourceStart + Math.max(0, currentTime - clip.start) * ratio;
  if (import.meta.env.DEV) {
    console.debug("[Preview] clip matched", {
      currentTime,
      clipId: clip.id,
      clipStart: clip.start,
      clipEnd: clip.end,
      offset,
    });
  }
  return { clip, offset: Math.max(clip.sourceStart, Math.min(clip.sourceEnd, offset)) };
}

function seekToOffset(video: HTMLVideoElement, offset: number, clipId?: string) {
  const apply = () => {
    if (Math.abs(video.currentTime - offset) > 0.03) {
      video.currentTime = offset;
      if (import.meta.env.DEV) {
        console.debug("[Preview] seekToOffset", { clipId, offset });
      }
    }
  };
  if (video.readyState < 1) {
    video.addEventListener("loadedmetadata", apply, { once: true });
  } else {
    apply();
  }
}

function easeValue(t: number, easing: Keyframe["easing"]) {
  if (easing === "easeInOut") return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  if (easing === "bounce") return Math.abs(Math.sin(t * Math.PI * 2) * (1 - t));
  return t;
}

function sampleKeyframe(
  clip: TimelineClip,
  property: KeyframeProperty,
  currentTimelineTime: number,
  fallback: number
): number {
  const list = clip.keyframes?.[property];
  if (!list?.length) return fallback;
  const local = Math.max(0, currentTimelineTime - clip.start);
  const sorted = [...list].sort((a, b) => a.time - b.time);
  if (local <= sorted[0].time) return sorted[0].value;
  if (local >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (local >= a.time && local <= b.time) {
      const p = (local - a.time) / Math.max(1e-4, b.time - a.time);
      const eased = easeValue(p, b.easing);
      return a.value + (b.value - a.value) * eased;
    }
  }
  return fallback;
}

export function Preview() {
  const {
    clips,
    transitions,
    currentTime,
    duration,
    getTotalDuration,
    isPlaying,
    setCurrentTime,
    setIsPlaying,
    selectedClipId,
    setSelectedClipId,
    updateTextClip,
  } = useEditorStore();
  const language = useSettingsStore((s) => s.language);
  const text =
    language === "en"
      ? {
          emptyJumping: "Blank area detected, jumping to next clip...",
          emptyPlayhead: "Playhead is in a blank area",
          emptyNoClip: "Import media and add clips to timeline",
        }
      : {
          emptyJumping: "空白区间，正在跳转到下一个片段…",
          emptyPlayhead: "播放头位于空白区间",
          emptyNoClip: "导入视频后从素材库添加到时间轴",
        };
  const videoRef = useRef<HTMLVideoElement>(null);
  const transitionVideoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const textDragRef = useRef<{
    clipId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const seekRafRef = useRef(0);
  const pendingSeekRef = useRef<{ offset: number; clipId: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const [seekHover, setSeekHover] = useState(false);

  const sortedClips = useMemo(
    () => [...clips].sort((a, b) => (a.start === b.start ? a.trackIndex - b.trackIndex : a.start - b.start)),
    [clips]
  );
  const videoClips = useMemo(
    () => sortedClips.filter((clip) => clip.type === "video"),
    [sortedClips]
  );
  const activeTextClips = useMemo(
    () =>
      sortedClips.filter(
        (clip) =>
          clip.type === "text" &&
          clip.start <= currentTime + CLIP_EPS &&
          currentTime <= clip.end + CLIP_EPS &&
          (clip.content ?? "").trim().length > 0
      ),
    [currentTime, sortedClips]
  );
  const totalDuration = useMemo(() => Math.max(0, getTotalDuration()), [clips, getTotalDuration]);
  const displayDuration = Math.max(0.001, totalDuration || duration || 0);

  const clipAndOffset = useMemo(
    () =>
      getCurrentClipAndOffset(
        videoClips.map((clip) => ({
          id: clip.id,
          start: clip.start,
          end: clip.end,
          sourceStart: clip.sourceStart,
          sourceEnd: clip.sourceEnd,
        })),
        currentTime
      ),
    [currentTime, videoClips]
  );
  const currentClip = useMemo(
    () => (clipAndOffset ? videoClips.find((c) => c.id === clipAndOffset.clip.id) ?? null : null),
    [clipAndOffset, videoClips]
  );
  const nextVideoClip = useMemo(
    () => videoClips.find((clip) => clip.start > currentTime + 1e-4) ?? null,
    [currentTime, videoClips]
  );

  const activeVideoSrc = currentClip?.src ?? "";
  const videoKey = currentClip?.src ?? "none";
  const currentFilterCss = useMemo(() => {
    if (!currentClip?.filter) return "none";
    return (
      currentClip.filter.cssValue ??
      buildFilterCss(currentClip.filter.name, currentClip.filter.intensity)
    );
  }, [currentClip?.filter]);
  const currentVideoTransform = useMemo(() => {
    if (!currentClip) {
      return { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };
    }
    return {
      x: sampleKeyframe(currentClip, "x", currentTime, 0),
      y: sampleKeyframe(currentClip, "y", currentTime, 0),
      scale: sampleKeyframe(currentClip, "scale", currentTime, 1),
      rotation: sampleKeyframe(currentClip, "rotation", currentTime, 0),
      opacity: sampleKeyframe(currentClip, "opacity", currentTime, 1),
    };
  }, [currentClip, currentTime]);
  const transitionContext = useMemo(() => {
    if (!currentClip || !clipAndOffset) return null;
    const transition = transitions.find((t) => t.toClipId === currentClip.id);
    if (!transition) return null;
    const fromClip = videoClips.find((clip) => clip.id === transition.fromClipId);
    if (!fromClip) return null;
    const tStart = currentClip.start;
    const tEnd = Math.min(currentClip.end, tStart + transition.duration);
    if (currentTime < tStart || currentTime > tEnd) return null;
    const progress = (currentTime - tStart) / Math.max(CLIP_EPS, tEnd - tStart);
    const fromWindowStart = Math.max(fromClip.start, fromClip.end - transition.duration);
    const fromTimelinePos = fromWindowStart + progress * (fromClip.end - fromWindowStart);
    const fromInfo = getCurrentClipAndOffset(
      [
        {
          id: fromClip.id,
          start: fromClip.start,
          end: fromClip.end,
          sourceStart: fromClip.sourceStart,
          sourceEnd: fromClip.sourceEnd,
        },
      ],
      fromTimelinePos
    );
    if (!fromInfo) return null;
    const normalized = Math.max(0, Math.min(1, progress));
    return {
      type: transition.type,
      fromClip,
      fromOffset: fromInfo.offset,
      progress: normalized,
    };
  }, [clipAndOffset, currentClip, currentTime, transitions, videoClips]);
  const transitionVisual = useMemo(() => {
    if (!transitionContext) return null;
    const p = transitionContext.progress;
    switch (transitionContext.type) {
      case "slide":
        return {
          currentTransformExtra: ` translateX(${(1 - p) * 12}%)`,
          currentClipPath: undefined as string | undefined,
          fromTransformExtra: ` translateX(${-p * 12}%)`,
          fromClipPath: undefined as string | undefined,
          fromOpacity: 1,
        };
      case "wipe":
        return {
          currentTransformExtra: "",
          currentClipPath: `inset(0 ${Math.max(0, (1 - p) * 100)}% 0 0)`,
          fromTransformExtra: "",
          fromClipPath: `inset(0 0 0 ${Math.min(100, p * 100)}%)`,
          fromOpacity: 1,
        };
      case "fade":
      case "crossDissolve":
      default:
        return {
          currentTransformExtra: "",
          currentClipPath: undefined as string | undefined,
          fromTransformExtra: "",
          fromClipPath: undefined as string | undefined,
          fromOpacity: Math.max(0, 1 - p),
        };
    }
  }, [transitionContext]);

  const scheduleSeek = useCallback((offset: number, clipId: string) => {
    pendingSeekRef.current = { offset, clipId };
    if (seekRafRef.current) return;
    seekRafRef.current = requestAnimationFrame(() => {
      seekRafRef.current = 0;
      const pending = pendingSeekRef.current;
      const v = videoRef.current;
      if (!pending || !v) return;
      seekToOffset(v, pending.offset, pending.clipId);
    });
  }, []);

  // 根据时间轴 clip 同步预览视频时间（节流）
  useEffect(() => {
    if (!clipAndOffset || !currentClip) return;
    scheduleSeek(clipAndOffset.offset, currentClip.id);
  }, [clipAndOffset, currentClip, scheduleSeek]);

  useEffect(() => {
    return () => {
      if (seekRafRef.current) cancelAnimationFrame(seekRafRef.current);
    };
  }, []);

  // 播放/暂停控制
  useEffect(() => {
    const v = videoRef.current;
    const tv = transitionVideoRef.current;
    if (!v || !currentClip) return;
    v.playbackRate = Math.max(0.1, Math.min(10, currentClip.speed ?? 1));
    if (isPlaying) {
      v.play().catch(() => setIsPlaying(false));
      if (tv && transitionContext) void tv.play().catch(() => {});
    } else {
      v.pause();
      if (tv) tv.pause();
    }
  }, [currentClip, isPlaying, setIsPlaying, transitionContext]);

  // 播放时若落在空白区，自动跳到下一个视频片段；没有后续片段则停止播放
  useEffect(() => {
    if (!isPlaying || currentClip) return;
    if (nextVideoClip) {
      setCurrentTime(nextVideoClip.start);
      return;
    }
    setIsPlaying(false);
  }, [currentClip, isPlaying, nextVideoClip, setCurrentTime, setIsPlaying]);

  useEffect(() => {
    const tv = transitionVideoRef.current;
    if (!tv || !transitionContext) return;
    if (tv.src !== transitionContext.fromClip.src) {
      tv.src = transitionContext.fromClip.src;
    }
    seekToOffset(tv, transitionContext.fromOffset, transitionContext.fromClip.id);
  }, [transitionContext]);

  // 视频时间更新 -> 同步到时间轴 currentTime
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !currentClip) return;
    const onTime = () => {
      const sourceLen = Math.max(0.0001, currentClip.sourceEnd - currentClip.sourceStart);
      const timelineLen = Math.max(0.0001, currentClip.end - currentClip.start);
      const ratio = timelineLen / sourceLen;
      const offset = (v.currentTime - currentClip.sourceStart) * ratio;
      const mappedTimeline = Math.max(
        currentClip.start,
        Math.min(currentClip.end, currentClip.start + offset)
      );
      if (Math.abs(mappedTimeline - currentTime) > 0.03) {
        setCurrentTime(mappedTimeline);
      }
      if (v.currentTime >= currentClip.sourceEnd - 0.015) {
        if (!isPlaying) return;
        const next = videoClips.find(
          (clip) =>
            clip.id !== currentClip.id && clip.start >= currentClip.end - CLIP_EPS
        );
        if (next) {
          setCurrentTime(next.start);
        } else {
          setCurrentTime(currentClip.end);
          setIsPlaying(false);
        }
      }
    };
    const onEnd = () => setIsPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnd);
    };
  }, [currentClip, currentTime, isPlaying, setCurrentTime, setIsPlaying, videoClips]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - r.left) / r.width * displayDuration;
    setCurrentTime(t);
  }, [displayDuration, setCurrentTime]);

  const togglePlay = () => {
    if (!videoClips.length) return;
    if (!currentClip) {
      const nextClip = nextVideoClip ?? videoClips[0];
      setCurrentTime(nextClip.start);
    }
    setIsPlaying(!isPlaying);
  };

  const progress = displayDuration > 0 ? Math.min(1, currentTime / displayDuration) : 0;

  return (
    <div className="flex h-full flex-col bg-black/60">
      <div
        ref={stageRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onMouseMove={(e) => {
          const dragging = textDragRef.current;
          const stage = stageRef.current;
          if (!dragging || !stage) return;
          const rect = stage.getBoundingClientRect();
          const x = (e.clientX - rect.left - dragging.offsetX) / Math.max(1, rect.width);
          const y = (e.clientY - rect.top - dragging.offsetY) / Math.max(1, rect.height);
          updateTextClip(dragging.clipId, { position: { x, y } });
        }}
        onMouseUp={() => {
          textDragRef.current = null;
        }}
        onMouseLeave={() => {
          textDragRef.current = null;
        }}
      >
        {currentClip ? (
          <>
            <video
              key={videoKey}
              ref={videoRef}
              src={activeVideoSrc}
              className="max-h-full max-w-full object-contain"
              style={{
                filter: currentFilterCss,
                transform: `translate(${currentVideoTransform.x * 100}%, ${currentVideoTransform.y * 100}%) scale(${Math.max(0.01, currentVideoTransform.scale)}) rotate(${currentVideoTransform.rotation}deg)${transitionVisual?.currentTransformExtra ?? ""}`,
                opacity: Math.max(0, Math.min(1, currentVideoTransform.opacity)),
                clipPath: transitionVisual?.currentClipPath,
              }}
              muted={muted}
              autoPlay={isPlaying}
              preload="auto"
              playsInline
            />
            {transitionContext && (
              <video
                ref={transitionVideoRef}
                className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full object-contain"
                style={{
                  opacity: transitionVisual?.fromOpacity ?? 1,
                  transform: transitionVisual?.fromTransformExtra ?? undefined,
                  clipPath: transitionVisual?.fromClipPath,
                }}
                muted
                preload="auto"
                playsInline
              />
            )}
          </>
        ) : (
          <div className="text-center">
            <Play size={28} className="mx-auto mb-3 text-fg-muted/40" />
            <p className="text-sm text-fg-muted">
              {videoClips.length
                ? isPlaying && nextVideoClip
                  ? text.emptyJumping
                  : text.emptyPlayhead
                : text.emptyNoClip}
            </p>
          </div>
        )}
        {activeTextClips.map((clip) => {
          const pos = clip.position ?? { x: 0.5, y: 0.82 };
          const selected = selectedClipId === clip.id;
          const animation = clip.animation?.type ?? "fadeIn";
          const className =
            animation === "bounce"
              ? "animate-bounce"
              : animation === "typewriter"
                ? "overflow-hidden whitespace-nowrap border-r border-current"
                : "animate-fade-in";
          const animatedX = sampleKeyframe(clip, "x", currentTime, 0);
          const animatedY = sampleKeyframe(clip, "y", currentTime, 0);
          const animatedScale = sampleKeyframe(clip, "scale", currentTime, 1);
          const animatedRotation = sampleKeyframe(clip, "rotation", currentTime, 0);
          const animatedOpacity = sampleKeyframe(clip, "opacity", currentTime, 1);
          return (
            <div
              key={clip.id}
              className={`absolute select-none px-1 ${className}`}
              style={{
                left: `${Math.max(0, Math.min(1, pos.x)) * 100}%`,
                top: `${Math.max(0, Math.min(1, pos.y)) * 100}%`,
                transform: `translate(calc(-50% + ${animatedX * 100}%), calc(-50% + ${animatedY * 100}%)) scale(${Math.max(0.01, animatedScale)}) rotate(${animatedRotation}deg)`,
                opacity: Math.max(0, Math.min(1, animatedOpacity)),
                fontSize: `${clip.fontSize ?? 36}px`,
                fontFamily: clip.fontFamily ?? "PingFang SC, Microsoft YaHei, sans-serif",
                color: clip.color ?? "#ffffff",
                textShadow:
                  clip.shadow
                    ? `${clip.shadow.offsetX}px ${clip.shadow.offsetY}px ${clip.shadow.blur}px ${clip.shadow.color}`
                    : "0 2px 6px rgba(0,0,0,0.45)",
                WebkitTextStroke:
                  clip.stroke && clip.stroke.width > 0
                    ? `${clip.stroke.width}px ${clip.stroke.color}`
                    : undefined,
                outline: selected
                  ? "1px dashed color-mix(in srgb, var(--accent) 70%, white)"
                  : undefined,
                cursor: "move",
              }}
              onMouseDown={(e) => {
                const stage = stageRef.current;
                if (!stage) return;
                const rect = stage.getBoundingClientRect();
                const currentPos = clip.position ?? { x: 0.5, y: 0.82 };
                textDragRef.current = {
                  clipId: clip.id,
                  offsetX: e.clientX - rect.left - currentPos.x * rect.width,
                  offsetY: e.clientY - rect.top - currentPos.y * rect.height,
                };
                setSelectedClipId(clip.id);
                e.stopPropagation();
              }}
            >
              {clip.content}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border bg-bg-2/90 px-4 py-2 backdrop-blur">
        <div
          className="group relative mb-2 h-1.5 cursor-pointer rounded-full bg-bg-3"
          onClick={handleSeek}
          onMouseEnter={() => setSeekHover(true)}
          onMouseLeave={() => setSeekHover(false)}
        >
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress * 100}%` }} />
          <div className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow transition-opacity ${seekHover ? "opacity-100" : "opacity-0"}`}
            style={{ left: `${progress * 100}%` }} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
              className="flex h-7 w-7 items-center justify-center rounded text-fg-2 hover:bg-hover">
              <SkipBack size={14} />
            </button>
            <button onClick={togglePlay}
              disabled={!videoClips.length}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-fg transition-all hover:opacity-90">
              {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>
            <button onClick={() => setCurrentTime(Math.min(displayDuration, currentTime + 5))}
              className="flex h-7 w-7 items-center justify-center rounded text-fg-2 hover:bg-hover">
              <SkipForward size={14} />
            </button>
            <span className="ml-2 text-[11px] text-fg-muted tabular-nums">
              {formatTime(currentTime)} / {formatTime(displayDuration)}
            </span>
          </div>
          <button onClick={() => setMuted(!muted)}
            className="flex h-7 w-7 items-center justify-center rounded text-fg-2 hover:bg-hover">
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
