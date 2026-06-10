import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { VideoDecoder } from "./videoDecoder";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportClipInput {
  id?: string;
  type?: "video" | "audio" | "text";
  src?: string;
  start: number;
  end: number;
  sourceStart?: number;
  sourceEnd?: number;
  speed?: number;
  filter?: { cssValue?: string; name?: string; intensity?: number };
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  stroke?: { width: number; color: string };
  shadow?: { blur: number; offsetX: number; offsetY: number; color: string };
  position?: { x: number; y: number };
  animation?: { type: "fadeIn" | "bounce" | "typewriter"; duration: number };
  keyframes?: Partial<
    Record<
      "x" | "y" | "scale" | "rotation" | "opacity",
      Array<{ time: number; value: number; easing: "linear" | "easeInOut" | "bounce" }>
    >
  >;
  file: File;
}

export interface ExportProgress {
  progress: number;
  stage: string;
}

export type ExportProgressCallback = (info: ExportProgress) => void;

export interface ExportTransitionInput {
  id?: string;
  fromClipId: string;
  toClipId: string;
  type: "crossDissolve" | "slide" | "wipe" | "fade";
  duration: number;
}

interface AudioMixPlan {
  outputStart: number;
  outputEnd: number;
  sourceStart: number;
  sourceEnd: number;
  sourceKey: string;
}

const AUDIO_DECODE_TIMEOUT_MS = 8000;

export interface ExportOptions {
  fps?: number;
  filename?: string;
  onProgress?: ExportProgressCallback;
  transitions?: ExportTransitionInput[];
}

export interface ExportResult {
  blob: Blob;
  method: "webcodecs" | "ffmpeg";
}

const DEFAULT_FPS = 30;
const SAMPLE_RATE = 48_000;
const AUDIO_CHANNELS = 2;
const WEB_CODECS_INIT_TIMEOUT_MS = 12000;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function evenDimension(n: number): number {
  const v = Math.max(2, Math.floor(n));
  return v % 2 === 0 ? v : v - 1;
}

function report(onProgress: ExportProgressCallback | undefined, progress: number, stage: string) {
  onProgress?.({ progress: Math.min(1, Math.max(0, progress)), stage });
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时（>${ms}ms）`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function saveAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function totalClipDuration(clips: ExportClipInput[]): number {
  return clips.reduce(
    (sum, c) => (c.type === "text" ? sum : sum + Math.max(0, c.end - c.start)),
    0
  );
}

function easeValue(t: number, easing: "linear" | "easeInOut" | "bounce"): number {
  if (easing === "easeInOut") return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  if (easing === "bounce") return Math.abs(Math.sin(t * Math.PI * 2) * (1 - t));
  return t;
}

function sampleKeyframe(
  clip: ExportClipInput,
  property: "x" | "y" | "scale" | "rotation" | "opacity",
  localTime: number,
  fallback: number
): number {
  const list = clip.keyframes?.[property];
  if (!list?.length) return fallback;
  if (list.length === 1) return list[0].value;

  const sorted = [...list].sort((a, b) => a.time - b.time);
  if (localTime <= sorted[0].time) return sorted[0].value;
  if (localTime >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;

  for (let i = 0; i < sorted.length - 1; i++) {
    const left = sorted[i];
    const right = sorted[i + 1];
    if (localTime >= left.time && localTime <= right.time) {
      const span = Math.max(1e-6, right.time - left.time);
      const rawT = (localTime - left.time) / span;
      const eased = easeValue(Math.max(0, Math.min(1, rawT)), left.easing);
      return left.value + (right.value - left.value) * eased;
    }
  }
  return fallback;
}

function mapTimelineToSource(clip: ExportClipInput, timelineTime: number): number {
  const timelineLen = Math.max(1e-6, clip.end - clip.start);
  const sourceStart = clip.sourceStart ?? clip.start;
  const sourceEnd = clip.sourceEnd ?? clip.end;
  const sourceLen = Math.max(1e-6, sourceEnd - sourceStart);
  const local = Math.max(0, Math.min(timelineLen, timelineTime - clip.start));
  return sourceStart + (local / timelineLen) * sourceLen;
}

function drawBitmapWithClipStyle(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  clip: ExportClipInput,
  localTime: number,
  width: number,
  height: number,
  alpha: number,
  options?: {
    translateXPercent?: number;
    clipLeftPercent?: number;
    clipRightPercent?: number;
  }
): void {
  const kx = sampleKeyframe(clip, "x", localTime, 0);
  const ky = sampleKeyframe(clip, "y", localTime, 0);
  const kScale = sampleKeyframe(clip, "scale", localTime, 1);
  const kRotation = sampleKeyframe(clip, "rotation", localTime, 0);
  const kOpacity = sampleKeyframe(clip, "opacity", localTime, 1);
  const translateXPercent = options?.translateXPercent ?? 0;
  const leftPct = Math.max(0, Math.min(100, options?.clipLeftPercent ?? 0));
  const rightPct = Math.max(0, Math.min(100, options?.clipRightPercent ?? 0));

  ctx.save();
  if (leftPct > 0 || rightPct > 0) {
    const leftPx = (leftPct / 100) * width;
    const visibleWidth = Math.max(0, width * (1 - (leftPct + rightPct) / 100));
    ctx.beginPath();
    ctx.rect(leftPx, 0, visibleWidth, height);
    ctx.clip();
  }
  ctx.filter = clip.filter?.cssValue ?? "none";
  ctx.globalAlpha = Math.max(0, Math.min(1, kOpacity * alpha));
  ctx.translate(
    width * 0.5 + kx * width + (translateXPercent / 100) * width,
    height * 0.5 + ky * height
  );
  ctx.rotate((kRotation * Math.PI) / 180);
  ctx.scale(Math.max(0.01, kScale), Math.max(0.01, kScale));
  ctx.drawImage(bitmap, -width * 0.5, -height * 0.5, width, height);
  ctx.restore();
}

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  textClip: ExportClipInput,
  outputTime: number,
  width: number,
  height: number
): void {
  if (!textClip.content) return;
  if (outputTime < textClip.start || outputTime > textClip.end) return;

  const localTime = Math.max(0, outputTime - textClip.start);
  const anim = textClip.animation;
  const animDuration = anim?.duration ?? 0.4;
  const animProgress = animDuration > 0 ? Math.max(0, Math.min(1, localTime / animDuration)) : 1;
  let animationScale = 1;

  const x = sampleKeyframe(textClip, "x", localTime, 0);
  const y = sampleKeyframe(textClip, "y", localTime, 0);
  const scale = sampleKeyframe(textClip, "scale", localTime, 1);
  const rotation = sampleKeyframe(textClip, "rotation", localTime, 0);
  let opacity = sampleKeyframe(textClip, "opacity", localTime, 1);

  if (anim?.type === "fadeIn") {
    opacity *= animProgress;
  } else if (anim?.type === "bounce") {
    animationScale = 1 + Math.sin(animProgress * Math.PI * 2) * (1 - animProgress) * 0.2;
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

  const basePos = textClip.position ?? { x: 0.5, y: 0.5 };
  const px = basePos.x * width + x * width;
  const py = basePos.y * height + y * height;
  ctx.translate(px, py);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(
    Math.max(0.01, scale * animationScale),
    Math.max(0.01, scale * animationScale)
  );

  const fontSize = Math.max(10, textClip.fontSize ?? 42);
  ctx.font = `${fontSize}px ${textClip.fontFamily ?? "Arial"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (textClip.shadow) {
    ctx.shadowBlur = textClip.shadow.blur;
    ctx.shadowOffsetX = textClip.shadow.offsetX;
    ctx.shadowOffsetY = textClip.shadow.offsetY;
    ctx.shadowColor = textClip.shadow.color;
  }

  const rawText = textClip.content ?? "";
  const drawText =
    anim?.type === "typewriter"
      ? rawText.slice(0, Math.max(1, Math.floor(rawText.length * animProgress)))
      : rawText;

  if (textClip.stroke && textClip.stroke.width > 0) {
    ctx.lineWidth = textClip.stroke.width;
    ctx.strokeStyle = textClip.stroke.color;
    ctx.strokeText(drawText, 0, 0);
  }

  ctx.fillStyle = textClip.color ?? "#ffffff";
  ctx.fillText(drawText, 0, 0);
  ctx.restore();
}

async function decodeAudioSourceToBuffer(
  sourceKey: string,
  file: File | undefined,
  src: string | undefined,
  audioContext: AudioContext
): Promise<AudioBuffer | null> {
  try {
    let data: ArrayBuffer | null = null;
    if (src) {
      const resp = await fetch(src);
      if (resp.ok) data = await resp.arrayBuffer();
    } else if (file) {
      data = await file.arrayBuffer();
    }
    if (!data) return null;
    const decodePromise = audioContext.decodeAudioData(data.slice(0));
    const timeoutPromise = new Promise<AudioBuffer | null>((resolve) => {
      setTimeout(() => resolve(null), AUDIO_DECODE_TIMEOUT_MS);
    });
    return await Promise.race([decodePromise, timeoutPromise]);
  } catch (error) {
    console.warn("[videoExporter] decode audio source failed:", sourceKey, error);
    return null;
  }
}

function sampleAudio(buffer: AudioBuffer, channel: number, timeSec: number): number {
  const data = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
  if (!data.length) return 0;
  const position = Math.max(0, Math.min(data.length - 1, timeSec * buffer.sampleRate));
  const left = Math.floor(position);
  const right = Math.min(data.length - 1, left + 1);
  const frac = position - left;
  return data[left] * (1 - frac) + data[right] * frac;
}

function buildMixedAudioFrame(
  frameStartSec: number,
  numberOfFrames: number,
  sampleRate: number,
  plans: AudioMixPlan[],
  sourceBufferMap: Map<string, AudioBuffer>
): Float32Array {
  const out = new Float32Array(numberOfFrames * AUDIO_CHANNELS);
  if (plans.length === 0) return out;
  const frameEndSec = frameStartSec + numberOfFrames / sampleRate;

  for (const plan of plans) {
    if (plan.outputStart >= frameEndSec || plan.outputEnd <= frameStartSec) continue;
    const buffer = sourceBufferMap.get(plan.sourceKey);
    if (!buffer) continue;
    const startSample = Math.max(
      0,
      Math.floor((Math.max(frameStartSec, plan.outputStart) - frameStartSec) * sampleRate)
    );
    const endSample = Math.min(
      numberOfFrames,
      Math.ceil((Math.min(frameEndSec, plan.outputEnd) - frameStartSec) * sampleRate)
    );
    const outSpan = Math.max(1e-6, plan.outputEnd - plan.outputStart);

    for (let s = startSample; s < endSample; s++) {
      const t = frameStartSec + s / sampleRate;
      const ratio = (t - plan.outputStart) / outSpan;
      const sourceTime = plan.sourceStart + ratio * (plan.sourceEnd - plan.sourceStart);
      out[s * 2] += sampleAudio(buffer, 0, sourceTime);
      out[s * 2 + 1] += sampleAudio(buffer, 1, sourceTime);
    }
  }

  for (let s = 0; s < numberOfFrames; s++) {
    out[s * 2] = Math.max(-1, Math.min(1, out[s * 2]));
    out[s * 2 + 1] = Math.max(-1, Math.min(1, out[s * 2 + 1]));
  }
  return out;
}

async function pickVideoCodec(width: number, height: number, fps: number): Promise<string> {
  const candidates = ["avc1.42001f", "avc1.4d0033", "avc1.640028"];
  for (const codec of candidates) {
    const support = await VideoEncoder.isConfigSupported({
      codec,
      width,
      height,
      bitrate: 2_000_000,
      framerate: fps,
    });
    if (support.supported) return codec;
  }
  throw new Error("当前环境不支持 H.264 视频编码");
}

async function pickAudioCodec(): Promise<string> {
  const candidates = ["mp4a.40.2", "opus"];
  for (const codec of candidates) {
    const support = await AudioEncoder.isConfigSupported({
      codec,
      sampleRate: SAMPLE_RATE,
      numberOfChannels: AUDIO_CHANNELS,
      bitrate: 128_000,
    });
    if (support.supported) return codec;
  }
  throw new Error("当前环境不支持音频编码");
}

function isWebCodecsExportSupported(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof AudioEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined"
  );
}

// ---------------------------------------------------------------------------
// WebCodecs export path
// ---------------------------------------------------------------------------

async function exportWithWebCodecs(
  clips: ExportClipInput[],
  options: ExportOptions
): Promise<Blob> {
  const fps = options.fps ?? DEFAULT_FPS;
  const onProgress = options.onProgress;
  const frameDurationUs = Math.round(1_000_000 / fps);
  const audioFramesPerVideoFrame = Math.max(
    1,
    Math.round(SAMPLE_RATE / fps)
  );

  report(onProgress, 0, "初始化 WebCodecs 编码器…");
  const videoClips = clips.filter((c) => c.type !== "text" && c.type !== "audio");
  const textClips = clips.filter((c) => c.type === "text");
  const transitions = options.transitions ?? [];
  const transitionByToClipId = new Map(
    transitions
      .filter((t) => t.duration > 0)
      .map((t) => [t.toClipId, t] as const)
  );
  const videoClipById = new Map(videoClips.map((c) => [c.id ?? "", c]));
  if (!videoClips.length) {
    throw new Error("没有可导出的视频片段");
  }

  const firstVideoClip = videoClips[0];
  const firstDecoder = await withTimeout(
    VideoDecoder.create(firstVideoClip.file),
    WEB_CODECS_INIT_TIMEOUT_MS,
    "初始化视频解码器"
  );
  const firstProbeTime = Math.min(
    firstVideoClip.sourceStart ?? firstVideoClip.start,
    Math.max(
      0,
      (firstVideoClip.sourceEnd ?? firstVideoClip.end) - 0.001
    )
  );
  const probe = await withTimeout(
    firstDecoder.getFrameAtTime(firstProbeTime),
    WEB_CODECS_INIT_TIMEOUT_MS,
    "探测首帧"
  );
  const width = evenDimension(probe.width);
  const height = evenDimension(probe.height);
  probe.close();
  firstDecoder.dispose();

  const videoCodec = await withTimeout(
    pickVideoCodec(width, height, fps),
    WEB_CODECS_INIT_TIMEOUT_MS,
    "选择视频编码器"
  );
  const audioCodec = await withTimeout(
    pickAudioCodec(),
    WEB_CODECS_INIT_TIMEOUT_MS,
    "选择音频编码器"
  );

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height },
    audio: {
      codec: audioCodec.startsWith("opus") ? "opus" : "aac",
      sampleRate: SAMPLE_RATE,
      numberOfChannels: AUDIO_CHANNELS,
    },
    fastStart: "in-memory",
  });

  let videoEncoder: VideoEncoder | null = null;
  let audioEncoder: AudioEncoder | null = null;
  let audioContext: AudioContext | null = null;

  try {
    videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        throw e;
      },
    });

    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => {
        throw e;
      },
    });

    videoEncoder.configure({
      codec: videoCodec,
      width,
      height,
      bitrate: 2_000_000,
      framerate: fps,
    });

    audioEncoder.configure({
      codec: audioCodec,
      sampleRate: SAMPLE_RATE,
      numberOfChannels: AUDIO_CHANNELS,
      bitrate: 128_000,
    });

    const videoTimelineDuration = videoClips.reduce((sum, c) => sum + Math.max(0, c.end - c.start), 0);
    const maxAudioEnd = clips
      .filter((c) => c.type === "audio")
      .reduce((maxEnd, c) => Math.max(maxEnd, c.end), 0);
    const exportTimelineDuration = Math.max(
      videoTimelineDuration,
      maxAudioEnd,
      ...textClips.map((c) => c.end)
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("无法创建导出画布上下文");
    }
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const activeAudioContext = audioContext;
    const sourceBufferMap = new Map<string, AudioBuffer>();
    const resolveSourceKey = (clip: ExportClipInput) =>
      clip.src ?? `${clip.file.name}-${clip.file.size}-${clip.file.lastModified}`;
    const ensureSourceBuffer = async (clip: ExportClipInput) => {
      const key = resolveSourceKey(clip);
      if (sourceBufferMap.has(key)) return key;
      const buffer = await decodeAudioSourceToBuffer(key, clip.file, clip.src, activeAudioContext);
      if (buffer) sourceBufferMap.set(key, buffer);
      return key;
    };
    report(onProgress, 0.06, "解析音频轨…");
    const videoAudioPlans: AudioMixPlan[] = [];
    let outputCursor = 0;
    for (const clip of videoClips) {
      const duration = Math.max(0, clip.end - clip.start);
      if (duration <= 0) continue;
      const sourceKey = await ensureSourceBuffer(clip);
      videoAudioPlans.push({
        outputStart: outputCursor,
        outputEnd: outputCursor + duration,
        sourceStart: clip.sourceStart ?? clip.start,
        sourceEnd: clip.sourceEnd ?? clip.end,
        sourceKey,
      });
      outputCursor += duration;
    }
    const extraAudioPlans: AudioMixPlan[] = [];
    for (const clip of clips) {
      if (clip.type !== "audio") continue;
      const sourceKey = await ensureSourceBuffer(clip);
      extraAudioPlans.push({
        outputStart: Math.max(0, clip.start),
        outputEnd: Math.max(0, clip.end),
        sourceStart: clip.sourceStart ?? 0,
        sourceEnd: clip.sourceEnd ?? Math.max(0, clip.end - clip.start),
        sourceKey,
      });
    }
    const mixPlans = [...videoAudioPlans, ...extraAudioPlans].filter((p) => p.outputEnd - p.outputStart > 1e-6);
    if (mixPlans.length === 0) {
      report(onProgress, 0.08, "未检测到可用音频轨，导出静音音轨…");
    }

    let encodedDuration = 0;
    let globalFrameIndex = 0;
    let outputTimestampUs = 0;

    for (let clipIndex = 0; clipIndex < videoClips.length; clipIndex++) {
      const clip = videoClips[clipIndex];
      const clipDuration = Math.max(0, clip.end - clip.start);
      if (clipDuration <= 0) continue;
      const activeTransition =
        clip.id ? transitionByToClipId.get(clip.id) ?? null : null;
      const fromClip =
        activeTransition?.fromClipId
          ? videoClipById.get(activeTransition.fromClipId) ?? null
          : null;
      const fromDecoder = fromClip ? await VideoDecoder.create(fromClip.file) : null;
      const transitionDuration = Math.min(
        clipDuration,
        Math.max(0, activeTransition?.duration ?? 0)
      );

      report(
        onProgress,
        encodedDuration / Math.max(videoTimelineDuration, 0.001),
        `编码片段 ${clipIndex + 1}/${videoClips.length}…`
      );

      const decoder = await VideoDecoder.create(clip.file);
      const frameCount = Math.max(1, Math.ceil(clipDuration * fps));
      const sourceStart = clip.sourceStart ?? clip.start;
      const sourceEnd = clip.sourceEnd ?? clip.end;
      const sourceSpan = Math.max(0.001, sourceEnd - sourceStart);

      for (let i = 0; i < frameCount; i++) {
        const localTime = i / fps;
        if (localTime >= clipDuration) break;
        const progressInClip = Math.max(0, Math.min(1, localTime / clipDuration));
        const sourceTime = sourceStart + progressInClip * sourceSpan;

        const bitmap = await decoder.getFrameAtTime(
          Math.min(sourceTime, Math.max(0, sourceEnd - 0.001))
        );

        const outTimeSec = outputTimestampUs / 1_000_000;

        ctx.save();
        ctx.clearRect(0, 0, width, height);
        const inTransition = !!fromClip && transitionDuration > 0 && localTime <= transitionDuration;
        if (inTransition && fromClip && fromDecoder) {
          const progress = Math.max(0, Math.min(1, localTime / transitionDuration));
          const fromWindowStart = Math.max(fromClip.start, fromClip.end - transitionDuration);
          const fromTimelinePos =
            fromWindowStart + progress * (fromClip.end - fromWindowStart);
          const fromSourceTime = mapTimelineToSource(fromClip, fromTimelinePos);
          const fromBitmap = await fromDecoder.getFrameAtTime(
            Math.min(fromSourceTime, Math.max(0, (fromClip.sourceEnd ?? fromClip.end) - 0.001))
          );
          const fromLocalTime = Math.max(0, fromTimelinePos - fromClip.start);
          const transitionType = activeTransition?.type ?? "crossDissolve";
          if (transitionType === "slide") {
            drawBitmapWithClipStyle(ctx, fromBitmap, fromClip, fromLocalTime, width, height, 1, {
              translateXPercent: -progress * 12,
            });
            drawBitmapWithClipStyle(ctx, bitmap, clip, localTime, width, height, 1, {
              translateXPercent: (1 - progress) * 12,
            });
          } else if (transitionType === "wipe") {
            drawBitmapWithClipStyle(ctx, fromBitmap, fromClip, fromLocalTime, width, height, 1, {
              clipLeftPercent: progress * 100,
            });
            drawBitmapWithClipStyle(ctx, bitmap, clip, localTime, width, height, 1, {
              clipRightPercent: (1 - progress) * 100,
            });
          } else {
            // fade/crossDissolve: opacity blend
            drawBitmapWithClipStyle(
              ctx,
              fromBitmap,
              fromClip,
              fromLocalTime,
              width,
              height,
              1 - progress
            );
            drawBitmapWithClipStyle(ctx, bitmap, clip, localTime, width, height, progress);
          }
          fromBitmap.close();
        } else {
          drawBitmapWithClipStyle(ctx, bitmap, clip, localTime, width, height, 1);
        }
        ctx.restore();
        bitmap.close();

        for (const textClip of textClips) {
          drawTextOverlay(ctx, textClip, outTimeSec, width, height);
        }

        const frameBitmap = await createImageBitmap(canvas);
        const videoFrame = new VideoFrame(frameBitmap, {
          timestamp: outputTimestampUs,
          duration: frameDurationUs,
        });
        frameBitmap.close();

        videoEncoder.encode(videoFrame, {
          keyFrame: globalFrameIndex % (fps * 2) === 0,
        });
        videoFrame.close();

        const frameStartSec = outputTimestampUs / 1_000_000;
        const mixed = buildMixedAudioFrame(
          frameStartSec,
          audioFramesPerVideoFrame,
          SAMPLE_RATE,
          mixPlans,
          sourceBufferMap
        );
        const audioData = new AudioData({
          format: "f32",
          sampleRate: SAMPLE_RATE,
          numberOfFrames: audioFramesPerVideoFrame,
          numberOfChannels: AUDIO_CHANNELS,
          timestamp: outputTimestampUs,
          data: new Float32Array(mixed),
        });
        audioEncoder.encode(audioData);
        audioData.close();

        outputTimestampUs += frameDurationUs;
        globalFrameIndex++;
        encodedDuration += 1 / fps;

        report(
          onProgress,
          encodedDuration / Math.max(videoTimelineDuration, 0.001),
          `编码片段 ${clipIndex + 1}/${videoClips.length}…`
        );
      }

      decoder.dispose();
      fromDecoder?.dispose();
    }

    const tailFrames = Math.max(0, Math.ceil((exportTimelineDuration - videoTimelineDuration) * fps));
    for (let i = 0; i < tailFrames; i++) {
      const outTimeSec = outputTimestampUs / 1_000_000;
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      ctx.restore();
      for (const textClip of textClips) {
        drawTextOverlay(ctx, textClip, outTimeSec, width, height);
      }

      const frameBitmap = await createImageBitmap(canvas);
      const videoFrame = new VideoFrame(frameBitmap, {
        timestamp: outputTimestampUs,
        duration: frameDurationUs,
      });
      frameBitmap.close();
      videoEncoder.encode(videoFrame, { keyFrame: globalFrameIndex % (fps * 2) === 0 });
      videoFrame.close();

      const frameStartSec = outputTimestampUs / 1_000_000;
      const mixed = buildMixedAudioFrame(
        frameStartSec,
        audioFramesPerVideoFrame,
        SAMPLE_RATE,
        mixPlans,
        sourceBufferMap
      );
      const audioData = new AudioData({
        format: "f32",
        sampleRate: SAMPLE_RATE,
        numberOfFrames: audioFramesPerVideoFrame,
        numberOfChannels: AUDIO_CHANNELS,
        timestamp: outputTimestampUs,
        data: new Float32Array(mixed),
      });
      audioEncoder.encode(audioData);
      audioData.close();

      outputTimestampUs += frameDurationUs;
      globalFrameIndex++;
      encodedDuration += 1 / fps;
      report(onProgress, Math.min(1, encodedDuration / Math.max(exportTimelineDuration, 0.001)), "编码字幕尾帧…");
    }

    report(onProgress, 0.95, "封装 MP4…");
    await videoEncoder.flush();
    await audioEncoder.flush();
    muxer.finalize();

    report(onProgress, 1, "导出完成");
    return new Blob([target.buffer], { type: "video/mp4" });
  } finally {
    videoEncoder?.close();
    audioEncoder?.close();
    await audioContext?.close().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// FFmpeg.wasm fallback
// ---------------------------------------------------------------------------

function buildFfmpegFilter(clips: ExportClipInput[]): {
  filter: string;
  totalDuration: number;
} {
  const visualClips = clips.filter((c) => c.type !== "text" && c.type !== "audio");
  const totalDuration = totalClipDuration(visualClips);
  const vTrims = visualClips.map((c, i) => {
    const s = c.sourceStart ?? c.start;
    const e = c.sourceEnd ?? c.end;
    return `[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`;
  });
  const vLabels = visualClips.map((_, i) => `[v${i}]`).join("");
  const filter = [
    ...vTrims,
    `${vLabels}concat=n=${visualClips.length}:v=1:a=0[outv]`,
    `anullsrc=channel_layout=stereo:sample_rate=${SAMPLE_RATE}:d=${totalDuration}[outa]`,
  ].join(";");

  return { filter, totalDuration };
}

async function exportWithFfmpeg(
  clips: ExportClipInput[],
  options: ExportOptions
): Promise<Blob> {
  const onProgress = options.onProgress;
  report(onProgress, 0, "加载 FFmpeg.wasm…");

  const ffmpeg = new FFmpeg();

  ffmpeg.on("progress", ({ progress }) => {
    report(onProgress, 0.1 + progress * 0.85, "FFmpeg 编码中…");
  });

  const coreVersion = "0.12.10";
  const baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${coreVersion}/dist/esm`;

  await ffmpeg.load({
    coreURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.js`,
      "text/javascript"
    ),
    wasmURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.wasm`,
      "application/wasm"
    ),
  });

  report(onProgress, 0.08, "读取源视频…");
  const inputFile = clips[0].file;
  const inputName = "input" + (inputFile.name.match(/\.\w+$/)?.[0] ?? ".mp4");
  await ffmpeg.writeFile(inputName, await fetchFile(inputFile));

  const { filter } = buildFfmpegFilter(clips);

  report(onProgress, 0.12, "FFmpeg 拼接片段…");

  const exitCode = await ffmpeg.exec([
    "-i",
    inputName,
    "-filter_complex",
    filter,
    "-map",
    "[outv]",
    "-map",
    "[outa]",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "output.mp4",
  ]);

  if (exitCode !== 0) {
    throw new Error(`FFmpeg 导出失败（exit code ${exitCode}）`);
  }

  report(onProgress, 0.98, "读取输出文件…");
  const data = await ffmpeg.readFile("output.mp4");
  const bytes = (
    data instanceof Uint8Array
      ? data
      : new TextEncoder().encode(String(data))
  ).slice();

  report(onProgress, 1, "导出完成");
  return new Blob([bytes], { type: "video/mp4" });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function exportVideo(
  clips: ExportClipInput[],
  options: ExportOptions = {}
): Promise<ExportResult> {
  if (!clips.length) {
    throw new Error("没有可导出的片段");
  }

  for (const clip of clips) {
    if (clip.end <= clip.start) {
      throw new Error("片段时长无效：end 必须大于 start");
    }
  }
  if (!clips.some((c) => c.type !== "text" && c.type !== "audio")) {
    throw new Error("没有可导出的可视片段（至少需要一个视频片段）");
  }

  if (isWebCodecsExportSupported()) {
    try {
      const blob = await exportWithWebCodecs(clips, options);
      return { blob, method: "webcodecs" };
    } catch (error) {
      console.warn(
        "[videoExporter] WebCodecs 导出失败，降级到 FFmpeg.wasm：",
        error
      );
      options.onProgress?.({
        progress: 0,
        stage: "WebCodecs 失败，切换 FFmpeg.wasm…",
      });
    }
  } else {
    options.onProgress?.({
      progress: 0,
      stage: "WebCodecs 不可用，使用 FFmpeg.wasm…",
    });
  }

  const blob = await exportWithFfmpeg(clips, options);
  return { blob, method: "ffmpeg" };
}

export async function exportAndDownload(
  clips: ExportClipInput[],
  options: ExportOptions = {}
): Promise<ExportResult> {
  const filename =
    options.filename ??
    `zhiying-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.mp4`;

  const result = await exportVideo(clips, options);
  saveAs(result.blob, filename);
  return result;
}
