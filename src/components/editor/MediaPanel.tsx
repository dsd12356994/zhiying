import { useRef } from "react";
import { Upload, Film, Music, Image as ImageIcon, FileText, Trash2 } from "lucide-react";
import { useProjectStore } from "../../stores/project-store";
import { useEditorStore } from "../../stores/editor-store";
import type { MediaItem } from "../../stores/types";

const typeIcons: Record<string, React.ReactNode> = {
  video: <Film size={16} className="text-blue-400" />,
  audio: <Music size={16} className="text-green-400" />,
  image: <ImageIcon size={16} className="text-yellow-400" />,
};

const typeLabels: Record<string, string> = {
  video: "视频",
  audio: "音频",
  image: "图片",
};

export function MediaPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { project, addMedia, removeMedia } = useProjectStore();

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        await addMedia(file);
      } catch (e) {
        console.error("导入失败:", file.name, e);
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="flex h-full flex-col bg-bg-1">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-fg-2">素材库</span>
        <span className="text-[10px] text-fg-muted">{project.mediaItems.length} 项</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div
        className="flex-1 overflow-y-auto p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {project.mediaItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Upload size={28} className="text-fg-muted/40" />
            <p className="text-xs text-fg-muted">拖入文件或点击下方按钮</p>
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-2 px-4 py-2 text-xs text-fg-2 transition-colors hover:bg-hover"
            >
              <Upload size={14} />
              导入素材
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {project.mediaItems.map((item) => (
              <MediaItemRow
                key={item.id}
                item={item}
                onRemove={() => removeMedia(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {project.mediaItems.length > 0 && (
        <div className="border-t border-border p-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-fg-muted transition-colors hover:border-strong hover:text-fg-2"
          >
            <Upload size={14} />
            导入更多
          </button>
        </div>
      )}
    </div>
  );
}

function MediaItemRow({ item, onRemove }: { item: MediaItem; onRemove: () => void }) {
  const { addClip } = useProjectStore();
  const { currentTime } = useEditorStore();

  const handleClick = () => {
    const t = Math.round(currentTime * 10) / 10;
    // project-store: 供导出和AI使用
    addClip(item.id, 0, t);
    // editor-store: 同步到时间轴显示
    const editorStore = useEditorStore.getState();
    // 如果还没设置videoFile，初始化编辑器
    if (!editorStore.videoFile) {
      editorStore.setVideoFile(item.file, item.url);
      editorStore.setDuration(item.duration);
    }
    editorStore.addClip({
      start: t,
      end: t + item.duration,
      sourceStart: 0,
      sourceEnd: item.duration,
      src: item.url,
      type: item.type as "video" | "audio" | "text",
      trackIndex: 0,
    });
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-zhiying-media-id", item.id);
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      className="group flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-bg-2 px-2.5 py-2 transition-colors hover:bg-hover active:cursor-grabbing"
    >
      <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded bg-black/30">
        {item.type === "video" ? (
          <video
            src={item.url}
            className="h-full w-full rounded object-cover"
            preload="metadata"
            draggable={false}
          />
        ) : (
          typeIcons[item.type]
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-fg">{item.name}</p>
        <p className="text-[10px] text-fg-muted">
          {typeLabels[item.type]} · {formatTime(item.duration)}
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 size={14} className="text-fg-muted hover:text-red-400" />
      </button>
    </div>
  );
}
