/**
 * WebCodecs-based video decoder service with <video> element fallback.
 *
 * WebCodecs path supports H.264/AVC1 MP4 files (common local exports).
 * Other formats automatically fall back to the video element extractor.
 */

const NativeVideoDecoder = globalThis.VideoDecoder;

export type VideoSource = File | Blob | string;

export type FrameCallback = (
  frame: ImageBitmap,
  timestampSec: number
) => void | Promise<void>;

export type FrameProgressCallback = (progress: number) => void;

export class WebCodecsNotSupportedError extends Error {
  constructor(message = "当前环境不支持 WebCodecs，已自动降级到 <video> 提取帧。") {
    super(message);
    this.name = "WebCodecsNotSupportedError";
  }
}

export function isWebCodecsSupported(): boolean {
  return (
    typeof NativeVideoDecoder !== "undefined" &&
    typeof EncodedVideoChunk !== "undefined" &&
    typeof VideoFrame !== "undefined"
  );
}

// ---------------------------------------------------------------------------
// Minimal MP4 demuxer (AVC1 / H.264, single video track)
// ---------------------------------------------------------------------------

interface Mp4Sample {
  offset: number;
  size: number;
  dts: number;
  pts: number;
  duration: number;
  isKey: boolean;
}

interface Mp4TrackInfo {
  codec: string;
  description: Uint8Array;
  timescale: number;
  samples: Mp4Sample[];
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset);
}

function readBoxType(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

function findBox(
  buffer: ArrayBuffer,
  type: string,
  start = 0,
  end = buffer.byteLength
): { start: number; size: number } | null {
  const view = new DataView(buffer);
  let offset = start;
  while (offset + 8 <= end) {
    const size = readU32(view, offset);
    const boxType = readBoxType(view, offset + 4);
    if (size < 8) break;
    if (boxType === type) return { start: offset, size };
    offset += size;
  }
  return null;
}

function parseFullBoxVersion(view: DataView, offset: number): number {
  return view.getUint8(offset + 8);
}

function parseStsdAvc(
  buffer: ArrayBuffer,
  stsdStart: number
): { codec: string; description: Uint8Array } | null {
  const view = new DataView(buffer);
  const entryCount = readU32(view, stsdStart + 12);
  if (entryCount < 1) return null;

  let entryOffset = stsdStart + 16;
  const entrySize = readU32(view, entryOffset);
  const format = readBoxType(view, entryOffset + 4);
  if (format !== "avc1" && format !== "avc3") return null;

  const width = view.getUint16(entryOffset + 32);
  const height = view.getUint16(entryOffset + 34);
  const profile = view.getUint8(entryOffset + 40).toString(16).padStart(2, "0");
  const compat = view.getUint8(entryOffset + 41).toString(16).padStart(2, "0");
  const level = view.getUint8(entryOffset + 42).toString(16).padStart(2, "0");
  const codec = `avc1.${profile}${compat}${level}`;

  const avcC = findBox(buffer, "avcC", entryOffset + 8, entryOffset + entrySize);
  if (!avcC) return null;

  const descStart = avcC.start + 8;
  const descLen = avcC.size - 8;
  const description = new Uint8Array(buffer, descStart, descLen);

  void width;
  void height;
  return { codec, description };
}

function parseTrakVideo(
  buffer: ArrayBuffer,
  trakStart: number
): Mp4TrackInfo | null {
  const view = new DataView(buffer);
  const mdia = findBox(buffer, "mdia", trakStart + 8, trakStart + readU32(view, trakStart));
  if (!mdia) return null;

  const hdlr = findBox(buffer, "hdlr", mdia.start + 8, mdia.start + mdia.size);
  if (!hdlr) return null;
  const handler = readBoxType(view, hdlr.start + 16);
  if (handler !== "vide") return null;

  const mdhd = findBox(buffer, "mdhd", mdia.start + 8, mdia.start + mdia.size);
  const minf = findBox(buffer, "minf", mdia.start + 8, mdia.start + mdia.size);
  if (!mdhd || !minf) return null;

  const mdhdVersion = parseFullBoxVersion(view, mdhd.start);
  const timescale =
    mdhdVersion === 0
      ? readU32(view, mdhd.start + 20)
      : readU32(view, mdhd.start + 28);

  const stbl = findBox(buffer, "stbl", minf.start + 8, minf.start + minf.size);
  if (!stbl) return null;

  const stsd = findBox(buffer, "stsd", stbl.start + 8, stbl.start + stbl.size);
  if (!stsd) return null;
  const avc = parseStsdAvc(buffer, stsd.start);
  if (!avc) return null;

  const stco =
    findBox(buffer, "stco", stbl.start + 8, stbl.start + stbl.size) ??
    findBox(buffer, "co64", stbl.start + 8, stbl.start + stbl.size);
  const stsz = findBox(buffer, "stsz", stbl.start + 8, stbl.start + stbl.size);
  const stts = findBox(buffer, "stts", stbl.start + 8, stbl.start + stbl.size);
  const stss = findBox(buffer, "stss", stbl.start + 8, stbl.start + stbl.size);
  const ctts = findBox(buffer, "ctts", stbl.start + 8, stbl.start + stbl.size);
  if (!stco || !stsz || !stts) return null;

  const stcoType = readBoxType(view, stco.start + 4);
  const chunkCount = readU32(view, stco.start + 12);
  const chunkOffsets: number[] = [];
  for (let i = 0; i < chunkCount; i++) {
    chunkOffsets.push(
      stcoType === "stco"
        ? readU32(view, stco.start + 16 + i * 4)
        : Number(view.getBigUint64(stco.start + 16 + i * 8))
    );
  }

  const defaultSize = readU32(view, stsz.start + 12);
  const sampleCount = readU32(view, stsz.start + 16);
  const sampleSizes: number[] = [];
  if (defaultSize === 0) {
    for (let i = 0; i < sampleCount; i++) {
      sampleSizes.push(readU32(view, stsz.start + 20 + i * 4));
    }
  } else {
    for (let i = 0; i < sampleCount; i++) sampleSizes.push(defaultSize);
  }

  const sttsCount = readU32(view, stts.start + 12);
  const sttsDeltas: { count: number; delta: number }[] = [];
  for (let i = 0; i < sttsCount; i++) {
    sttsDeltas.push({
      count: readU32(view, stts.start + 16 + i * 8),
      delta: readU32(view, stts.start + 20 + i * 8),
    });
  }

  const keyframes = new Set<number>();
  if (stss) {
    const kfCount = readU32(view, stss.start + 12);
    for (let i = 0; i < kfCount; i++) {
      keyframes.add(readU32(view, stss.start + 16 + i * 4) - 1);
    }
  } else {
    keyframes.add(0);
  }

  const cttsOffsets: { count: number; offset: number }[] = [];
  if (ctts) {
    const cttsCount = readU32(view, ctts.start + 12);
    for (let i = 0; i < cttsCount; i++) {
      cttsOffsets.push({
        count: readU32(view, ctts.start + 16 + i * 8),
        offset: readU32(view, ctts.start + 20 + i * 8),
      });
    }
  }

  const samples: Mp4Sample[] = [];
  let dts = 0;
  let sampleIndex = 0;
  let cttsIndex = 0;
  let cttsUsed = 0;

  for (const { count, delta } of sttsDeltas) {
    for (let i = 0; i < count; i++) {
      let pts = dts;
      if (cttsOffsets.length > 0) {
        while (cttsIndex < cttsOffsets.length && cttsUsed >= cttsOffsets[cttsIndex].count) {
          cttsIndex++;
          cttsUsed = 0;
        }
        if (cttsIndex < cttsOffsets.length) {
          pts = dts + cttsOffsets[cttsIndex].offset;
          cttsUsed++;
        }
      }

      const size = sampleSizes[sampleIndex] ?? 0;

      let byteOffset = chunkOffsets[0] ?? 0;
      for (let s = 0; s < sampleIndex; s++) byteOffset += sampleSizes[s] ?? 0;

      samples.push({
        offset: byteOffset,
        size,
        dts,
        pts,
        duration: delta,
        isKey: keyframes.has(sampleIndex),
      });

      dts += delta;
      sampleIndex++;
    }
  }

  return {
    codec: avc.codec,
    description: avc.description,
    timescale,
    samples,
  };
}

function demuxMp4Avc(buffer: ArrayBuffer): Mp4TrackInfo | null {
  const moov = findBox(buffer, "moov");
  if (!moov) return null;

  const view = new DataView(buffer);
  let offset = moov.start + 8;
  const moovEnd = moov.start + moov.size;

  while (offset + 8 <= moovEnd) {
    const size = readU32(view, offset);
    const type = readBoxType(view, offset + 4);
    if (size < 8) break;
    if (type === "trak") {
      const track = parseTrakVideo(buffer, offset);
      if (track) return track;
    }
    offset += size;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Video element fallback
// ---------------------------------------------------------------------------

class VideoElementExtractor {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private objectUrl: string | null;
  private ownsUrl: boolean;

  constructor() {
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.preload = "auto";
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 Canvas 2D 上下文");
    this.ctx = ctx;
    this.objectUrl = null;
    this.ownsUrl = false;
  }

  async load(source: VideoSource): Promise<void> {
    const url = await this.resolveUrl(source);
    this.video.src = url;
    await this.waitForMetadata();
  }

  getDuration(): number {
    return Number.isFinite(this.video.duration) ? this.video.duration : 0;
  }

  async getFrameAtTime(timeSeconds: number): Promise<ImageBitmap> {
    await this.seekTo(timeSeconds);
    return this.captureFrame();
  }

  async decodeSegment(
    startSec: number,
    endSec: number,
    onFrame: FrameCallback,
    fps = 30
  ): Promise<void> {
    const interval = 1 / fps;
    for (let t = startSec; t <= endSec; t += interval) {
      const bitmap = await this.getFrameAtTime(Math.min(t, endSec));
      await onFrame(bitmap, t);
      bitmap.close();
    }
  }

  dispose(): void {
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    if (this.ownsUrl && this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }

  private async resolveUrl(source: VideoSource): Promise<string> {
    if (typeof source === "string") {
      this.ownsUrl = false;
      return source;
    }
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(source);
    this.ownsUrl = true;
    return this.objectUrl;
  }

  private waitForMetadata(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.video.readyState >= 1) {
        resolve();
        return;
      }
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("视频元数据加载失败"));
      };
      const cleanup = () => {
        this.video.removeEventListener("loadedmetadata", onLoaded);
        this.video.removeEventListener("error", onError);
      };
      this.video.addEventListener("loadedmetadata", onLoaded);
      this.video.addEventListener("error", onError);
    });
  }

  private seekTo(timeSeconds: number): Promise<void> {
    const video = this.video;
    const clamped = Math.max(0, Math.min(timeSeconds, this.getDuration()));
    const hasRvfc =
      typeof (video as HTMLVideoElement & { requestVideoFrameCallback?: unknown })
        .requestVideoFrameCallback === "function";

    return new Promise((resolve, reject) => {
      const onError = () => {
        cleanup();
        reject(new Error(`无法定位到 ${clamped}s`));
      };
      const cleanup = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
      };
      const onSeeked = () => {
        if (hasRvfc) {
          video.requestVideoFrameCallback(() => {
            cleanup();
            resolve();
          });
        } else {
          cleanup();
          resolve();
        }
      };

      video.addEventListener("seeked", onSeeked);
      video.addEventListener("error", onError);
      video.currentTime = clamped;
    });
  }

  private captureFrame(): Promise<ImageBitmap> {
    const { videoWidth: w, videoHeight: h } = this.video;
    if (!w || !h) throw new Error("视频尺寸无效");

    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.drawImage(this.video, 0, 0, w, h);
    return createImageBitmap(this.canvas);
  }
}

// ---------------------------------------------------------------------------
// WebCodecs decoder (H.264 MP4)
// ---------------------------------------------------------------------------

class WebCodecsMp4Decoder {
  private buffer: ArrayBuffer | null = null;
  private track: Mp4TrackInfo | null = null;
  private fallback: VideoElementExtractor;
  private warned = false;

  constructor() {
    this.fallback = new VideoElementExtractor();
  }

  async load(source: VideoSource): Promise<void> {
    const blob = await this.sourceToBlob(source);
    this.buffer = await blob.arrayBuffer();
    this.track = demuxMp4Avc(this.buffer);

    if (!this.track) {
      this.warnFallback("无法解析 MP4/H.264 轨道，降级到 <video> 提取帧。");
      await this.fallback.load(source);
      return;
    }

    await this.fallback.load(source);
  }

  getDuration(): number {
    if (!this.track) return this.fallback.getDuration();
    const last = this.track.samples.at(-1);
    if (!last) return this.fallback.getDuration();
    return (last.dts + last.duration) / this.track.timescale;
  }

  async getFrameAtTime(timeSeconds: number): Promise<ImageBitmap> {
    if (!this.track || !this.buffer) return this.fallback.getFrameAtTime(timeSeconds);
    const frame = await this.decodeNearestFrame(timeSeconds);
    if (!frame) return this.fallback.getFrameAtTime(timeSeconds);
    const bitmap = await this.videoFrameToBitmap(frame);
    frame.close();
    return bitmap;
  }

  async decodeSegment(
    startSec: number,
    endSec: number,
    onFrame: FrameCallback
  ): Promise<void> {
    if (!this.track || !this.buffer) {
      return this.fallback.decodeSegment(startSec, endSec, onFrame);
    }

    const { timescale, samples } = this.track;
    const startTs = startSec * timescale;
    const endTs = endSec * timescale;

    let startIndex = samples.findIndex((s) => s.pts >= startTs);
    if (startIndex < 0) startIndex = samples.length - 1;
    while (startIndex > 0 && !samples[startIndex].isKey) startIndex--;

    const decoder = new NativeVideoDecoder({
      output: async (frame: VideoFrame) => {
        const tsSec = frame.timestamp / 1_000_000;
        if (tsSec >= startSec - 0.001 && tsSec <= endSec + 0.001) {
          const bitmap = await this.videoFrameToBitmap(frame);
          await onFrame(bitmap, tsSec);
          bitmap.close();
        }
        frame.close();
      },
      error: (e: DOMException) => {
        console.error("[VideoDecoder] WebCodecs error:", e);
      },
    });

    decoder.configure({
      codec: this.track.codec,
      description: this.track.description,
      optimizeForLatency: true,
    });

    for (let i = startIndex; i < samples.length; i++) {
      const sample = samples[i];
      if (sample.dts > endTs) break;

      const data = new Uint8Array(this.buffer, sample.offset, sample.size);
      const chunk = new EncodedVideoChunk({
        type: sample.isKey ? "key" : "delta",
        timestamp: Math.round((sample.pts / timescale) * 1_000_000),
        duration: Math.round((sample.duration / timescale) * 1_000_000),
        data,
      });
      decoder.decode(chunk);
    }

    await decoder.flush();
    decoder.close();
  }

  dispose(): void {
    this.buffer = null;
    this.track = null;
    this.fallback.dispose();
  }

  get mode(): "webcodecs" | "fallback" {
    return this.track ? "webcodecs" : "fallback";
  }

  private async decodeNearestFrame(timeSeconds: number): Promise<VideoFrame | null> {
    if (!this.track || !this.buffer) return null;

    const { timescale, samples, codec, description } = this.track;
    const targetTs = timeSeconds * timescale;

    let startIndex = 0;
    for (let i = 0; i < samples.length; i++) {
      if (samples[i].pts <= targetTs) startIndex = i;
      else break;
    }
    while (startIndex > 0 && !samples[startIndex].isKey) startIndex--;

    let result: VideoFrame | null = null;

    const decoder = new NativeVideoDecoder({
      output: (frame: VideoFrame) => {
        const pts = frame.timestamp / 1_000_000;
        if (pts <= timeSeconds + 0.05) {
          result?.close();
          result = frame;
        } else {
          frame.close();
        }
      },
      error: (e: DOMException) => {
        console.error("[VideoDecoder] decode frame error:", e);
      },
    });

    decoder.configure({ codec, description, optimizeForLatency: true });

    for (let i = startIndex; i < samples.length; i++) {
      const sample = samples[i];
      if (sample.pts > targetTs + timescale * 0.5) break;

      const data = new Uint8Array(this.buffer, sample.offset, sample.size);
      decoder.decode(
        new EncodedVideoChunk({
          type: sample.isKey ? "key" : "delta",
          timestamp: Math.round((sample.pts / timescale) * 1_000_000),
          duration: Math.round((sample.duration / timescale) * 1_000_000),
          data,
        })
      );
    }

    await decoder.flush();
    decoder.close();
    return result;
  }

  private async videoFrameToBitmap(frame: VideoFrame): Promise<ImageBitmap> {
    if ("createImageBitmap" in globalThis) {
      return createImageBitmap(frame);
    }
    const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 OffscreenCanvas 上下文");
    ctx.drawImage(frame, 0, 0);
    return createImageBitmap(canvas);
  }

  private async sourceToBlob(source: VideoSource): Promise<Blob> {
    if (typeof source === "string") {
      const res = await fetch(source);
      return res.blob();
    }
    return source instanceof File ? source : source;
  }

  private warnFallback(message: string): void {
    if (!this.warned) {
      console.warn(`[VideoDecoder] ${message}`);
      this.warned = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class VideoDecoder {
  private impl: WebCodecsMp4Decoder | VideoElementExtractor;
  private mode: "webcodecs" | "fallback";
  private loaded = false;
  private static warnedNoWebCodecs = false;

  private constructor(
    impl: WebCodecsMp4Decoder | VideoElementExtractor,
    mode: "webcodecs" | "fallback",
    loaded = false
  ) {
    this.impl = impl;
    this.mode = mode;
    this.loaded = loaded;
  }

  /** Create and load a decoder from a File, Blob, or blob URL. */
  static async create(source: VideoSource): Promise<VideoDecoder> {
    if (isWebCodecsSupported()) {
      const mp4 = new WebCodecsMp4Decoder();
      await mp4.load(source);
      return new VideoDecoder(mp4, mp4.mode, true);
    }

    if (!VideoDecoder.warnedNoWebCodecs) {
      console.warn(
        "[VideoDecoder] 当前浏览器不支持 WebCodecs，已降级到 <video> 元素提取帧。"
      );
      VideoDecoder.warnedNoWebCodecs = true;
    }

    const fallback = new VideoElementExtractor();
    await fallback.load(source);
    return new VideoDecoder(fallback, "fallback", true);
  }

  get decodeMode(): "webcodecs" | "fallback" {
    return this.mode;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  async load(source: VideoSource): Promise<void> {
    await this.impl.load(source);
    this.loaded = true;
  }

  /** Video duration in seconds. */
  getDuration(): number {
    return this.impl.getDuration();
  }

  /**
   * Extract a single frame at the given timestamp (seconds).
   * Caller is responsible for calling `bitmap.close()` when done.
   */
  async getFrameAtTime(timeSeconds: number): Promise<ImageBitmap> {
    return this.impl.getFrameAtTime(timeSeconds);
  }

  /**
   * Decode frames in [startSec, endSec] and invoke `onFrame` for each.
   * Each ImageBitmap is closed automatically after the callback resolves.
   */
  async decodeSegment(
    startSec: number,
    endSec: number,
    onFrame: FrameCallback
  ): Promise<void> {
    if (this.impl instanceof WebCodecsMp4Decoder) {
      return this.impl.decodeSegment(startSec, endSec, onFrame);
    }
    return this.impl.decodeSegment(startSec, endSec, onFrame);
  }

  /**
   * Decode all frames across full duration.
   * Warning: this can consume significant memory for long videos.
   */
  async getAllFrames(onProgress?: FrameProgressCallback): Promise<ImageBitmap[]> {
    const frames: ImageBitmap[] = [];
    const duration = this.getDuration();
    if (duration <= 0) return frames;

    await this.decodeSegment(0, duration, async (frame, timestampSec) => {
      frames.push(frame);
      if (onProgress) onProgress(Math.min(1, timestampSec / duration));
    });

    if (onProgress) onProgress(1);
    return frames;
  }

  dispose(): void {
    this.impl.dispose();
    this.loaded = false;
  }
}
