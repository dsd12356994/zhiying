import type { Project, Clip } from "../stores/types";

export interface ExportProgress {
  status: "preparing" | "rendering" | "encoding" | "done" | "error";
  progress: number; // 0-100
  message: string;
}

type ProgressCallback = (p: ExportProgress) => void;

/**
 * 将时间轴渲染导出为视频文件
 * 用 canvas + MediaRecorder 实现
 */
export async function exportTimeline(
  project: Project,
  onProgress: ProgressCallback,
): Promise<Blob | null> {
  const { width, height, fps } = project;
  const totalDuration = project.duration || 10;

  onProgress({ status: "preparing", progress: 0, message: "准备渲染…" });

  // Setup canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Setup MediaRecorder
  const stream = canvas.captureStream(fps);
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm",
    videoBitsPerSecond: 10_000_000, // 10 Mbps
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const blobPromise = new Promise<Blob | null>((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      resolve(blob);
    };
  });

  // Preload all media elements
  onProgress({ status: "preparing", progress: 5, message: "加载媒体文件…" });
  const mediaElements = new Map<string, HTMLVideoElement | HTMLImageElement>();
  for (const media of project.mediaItems) {
    if (media.type === "video") {
      const el = document.createElement("video");
      el.src = media.url;
      el.preload = "auto";
      el.muted = true;
      await new Promise<void>((resolve) => {
        el.onloadeddata = () => resolve();
        setTimeout(resolve, 5000); // timeout
        el.load();
      });
      mediaElements.set(media.id, el);
    } else if (media.type === "image") {
      const img = new Image();
      img.src = media.url;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        setTimeout(resolve, 5000);
      });
      mediaElements.set(media.id, img);
    }
  }

  // Start recording
  mediaRecorder.start(1000 / fps); // chunk every frame interval
  onProgress({ status: "rendering", progress: 10, message: "开始渲染…" });

  // Collect all clips from all tracks (flatten)
  const allClips = project.tracks.flatMap((t, tIdx) =>
    t.clips.map((c) => ({
      ...c,
      trackType: t.type,
      trackIndex: tIdx,
    })),
  );

  // Render each frame
  const totalFrames = Math.ceil(totalDuration * fps);
  const videoTracks = project.tracks.filter((t) => t.type === "video").length;

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / fps;

    // Clear canvas
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    // Find all clips active at this time
    const activeClips = allClips.filter(
      (c) => c.start <= time && c.start + c.duration > time,
    );

    // Render video clips (bottom-up)
    const videoClips = activeClips
      .filter((c) => c.trackType === "video" && mediaElements.has(c.mediaId))
      .sort((a, b) => a.trackIndex - b.trackIndex);

    videoClips.forEach((clip, idx) => {
      const el = mediaElements.get(clip.mediaId)!;
      const clipTime = clip.mediaOffset + (time - clip.start);

      if ("currentTime" in el) {
        try { el.currentTime = clipTime; } catch {}
      }

      if (idx === videoClips.length - 1) {
        // Main track: full canvas
        ctx.drawImage(el as CanvasImageSource, 0, 0, width, height);
      } else {
        // PiP: small overlay
        const pipW = Math.floor(width * 0.35);
        const pipH = Math.floor(height * 0.25);
        const pipX = width - pipW - 10;
        const pipY = height - pipH - 10;
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4);
        ctx.drawImage(el as CanvasImageSource, pipX, pipY, pipW, pipH);
      }
    });

    // Render text clips
    activeClips
      .filter((c) => c.trackType === "text" && c.name)
      .forEach((clip) => {
        ctx.fillStyle = "white";
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(clip.name, width / 2, height / 2);
      });

    // Update progress every 10 frames
    if (frame % 10 === 0 || frame === totalFrames - 1) {
      const progress = 10 + Math.floor((frame / totalFrames) * 80);
      onProgress({
        status: "rendering",
        progress,
        message: `渲染中… ${Math.round((frame / totalFrames) * 100)}%`,
      });
    }

    // Yield to let MediaRecorder capture
    await new Promise((r) => setTimeout(r, 0));
  }

  // Stop recording
  onProgress({ status: "encoding", progress: 95, message: "编码视频…" });
  mediaRecorder.stop();

  const blob = await blobPromise;
  onProgress({ status: "done", progress: 100, message: "导出完成！" });

  return blob;
}

/** 下载 Blob 为文件 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
