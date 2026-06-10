import { useState, useCallback } from "react";
import { X, Download, AlertCircle, Film } from "lucide-react";
import { useProjectStore } from "../../stores/project-store";
import { useEditorStore } from "../../stores/editor-store";
import { exportVideo, saveAs } from "../../lib/videoExporter";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ExportProgressView {
  status: "preparing" | "rendering" | "encoding" | "done" | "error";
  progress: number; // 0-100
  message: string;
}

export function ExportDialog({ open, onClose }: Props) {
  const { project } = useProjectStore();
  const { clips, transitions, videoFile, getTotalDuration } = useEditorStore();
  const [progress, setProgress] = useState<ExportProgressView | null>(null);
  const [result, setResult] = useState<Blob | null>(null);

  const hasAudioClips = clips.some((c) => c.type === "audio");
  const capabilityWarnings = [
    hasAudioClips ? "独立音频轨（WebCodecs 已支持，FFmpeg 降级可能不完整）" : "",
  ].filter(Boolean);

  const handleExport = useCallback(async () => {
    if (!videoFile || clips.length === 0) {
      setProgress({
        status: "error",
        progress: 0,
        message: "请先导入素材并在时间轴上放置片段后再导出。",
      });
      return;
    }
    setProgress({ status: "preparing", progress: 0, message: "准备导出…" });
    setResult(null);
    try {
      const exportInputs = clips.map((clip) => ({
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
        file: videoFile,
      }));
      const result = await exportVideo(exportInputs, {
        onProgress: ({ progress, stage }) => {
          const p = Math.round(progress * 100);
          setProgress({
            status: p >= 100 ? "done" : p >= 95 ? "encoding" : "rendering",
            progress: p,
            message: stage,
          });
        },
        transitions: transitions.map((t) => ({
          id: t.id,
          fromClipId: t.fromClipId,
          toClipId: t.toClipId,
          type: t.type,
          duration: t.duration,
        })),
      });
      setResult(result.blob);
      setProgress({
        status: "done",
        progress: 100,
        message: `导出完成（${result.method}）`,
      });
    } catch (error) {
      setProgress({
        status: "error",
        progress: 0,
        message: error instanceof Error ? error.message : "导出失败",
      });
    }
  }, [clips, transitions, videoFile]);

  const handleDownload = useCallback(() => {
    if (result) {
      saveAs(result, `${project.name || "智映导出"}.mp4`);
    }
  }, [result, project.name]);

  if (!open) return null;

  const isDone = progress?.status === "done";
  const isError = progress?.status === "error";
  const isRunning = progress && !isDone && !isError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-96 rounded-xl border border-border bg-bg-elev p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Film size={18} className="text-accent" />
            <span className="text-sm font-medium text-fg">导出视频</span>
          </div>
          <button onClick={onClose} className="text-fg-muted hover:text-fg">
            <X size={16} />
          </button>
        </div>

        {/* Info */}
        <div className="mb-4 space-y-1 rounded-lg bg-bg-2 p-3 text-xs text-fg-2">
          <div className="flex justify-between">
            <span>分辨率</span>
            <span className="text-fg">{project.width}×{project.height}</span>
          </div>
          <div className="flex justify-between">
            <span>时长</span>
            <span className="text-fg">{getTotalDuration().toFixed(1)}s</span>
          </div>
          <div className="flex justify-between">
            <span>帧率</span>
            <span className="text-fg">{project.fps} fps</span>
          </div>
          <div className="flex justify-between">
            <span>格式</span>
            <span className="text-fg">MP4 (WebCodecs/FFmpeg)</span>
          </div>
          <div className="flex justify-between">
            <span>轨道数</span>
            <span className="text-fg">{Math.max(1, new Set(clips.map((c) => c.trackIndex)).size)}</span>
          </div>
        </div>
        {capabilityWarnings.length > 0 && (
          <div className="mb-4 rounded-lg border border-border px-3 py-2 text-[11px] text-fg-muted">
            当前导出链路中，以下内容可能不会完整导出：
            <span className="text-fg"> {capabilityWarnings.join(" / ")}</span>
          </div>
        )}
        {capabilityWarnings.length === 0 && transitions.length > 0 && (
          <div className="mb-4 rounded-lg border border-border px-3 py-2 text-[11px] text-fg-muted">
            转场导出支持：<span className="text-fg">crossDissolve / fade / slide / wipe</span>
          </div>
        )}

        {/* Progress */}
        {progress && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-fg-2">
                {isDone ? "✅ 导出完成" : isRunning ? progress.message : ""}
              </span>
              <span className="text-fg-muted">{progress.progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-bg-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress.progress}%`,
                  backgroundColor: isDone ? "#10b981" : "var(--accent)",
                }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle size={14} />
            {progress?.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!isRunning && !isDone && (
            <button
              onClick={handleExport}
              disabled={!videoFile || clips.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-xs font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Download size={14} />
              开始导出
            </button>
          )}
          {isDone && result && (
            <>
              <button
                onClick={handleDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-xs font-medium text-accent-fg transition-opacity hover:opacity-90"
              >
                <Download size={14} />
                下载视频 ({Math.round(result.size / 1024 / 1024)} MB)
              </button>
              <button
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2.5 text-xs text-fg-2 hover:bg-hover"
              >
                关闭
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
