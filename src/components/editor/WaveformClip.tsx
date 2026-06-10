import { useRef, useEffect } from "react";
import { useProjectStore } from "../../stores/project-store";

interface Props {
  mediaId: string;
  clipWidth: number;
  clipHeight: number;
}

/** 在 canvas 上绘制音频波形 */
export function WaveformClip({ mediaId, clipWidth, clipHeight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaItems = useProjectStore((s) => s.project.mediaItems);
  const media = mediaItems.find((m) => m.id === mediaId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !media?.waveform || media.waveform.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = clipWidth * dpr;
    canvas.height = clipHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = clipWidth;
    const h = clipHeight;
    const center = h / 2;
    const maxAmp = Math.max(...media.waveform, 0.1);

    ctx.clearRect(0, 0, w, h);

    // Draw waveform bars
    const barCount = Math.min(media.waveform.length, Math.floor(w / 2));
    const step = Math.max(1, Math.floor(media.waveform.length / barCount));
    const barWidth = Math.max(1, w / barCount - 0.5);

    for (let i = 0; i < barCount; i++) {
      const idx = Math.min(Math.floor(i * step), media.waveform.length - 1);
      const amp = (media.waveform[idx] / maxAmp) * center * 0.8;
      const x = (i / barCount) * w;

      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(x, center - amp, barWidth, Math.max(1, amp * 2));
    }
  }, [media?.waveform, clipWidth, clipHeight]);

  if (!media?.waveform || media.waveform.length === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{ width: clipWidth, height: clipHeight }}
      className="block"
    />
  );
}
