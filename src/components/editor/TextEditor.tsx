import { useMemo } from "react";
import { useEditorStore } from "../../stores/editor-store";
import { useSettingsStore } from "../../stores/settings-store";

const ANIMATIONS = ["fadeIn", "bounce", "typewriter"] as const;

export function TextEditor() {
  const { clips, selectedClipId, currentTime, addTextClip, updateTextClip } = useEditorStore();
  const language = useSettingsStore((s) => s.language);
  const text =
    language === "en"
      ? {
          hintEdit: "Edit selected text clip",
          hintSelect: "Select a text clip or create one",
          addAtPlayhead: "Create Text At Playhead (2s)",
          defaultText: "Double click to edit",
          content: "Content",
          fontSize: "Font Size",
          color: "Color",
          animation: "Animation",
          animationLabels: { fadeIn: "Fade In", bounce: "Bounce", typewriter: "Typewriter" } as Record<
            (typeof ANIMATIONS)[number],
            string
          >,
        }
      : {
          hintEdit: "编辑当前字幕片段",
          hintSelect: "请选择字幕片段，或新建字幕",
          addAtPlayhead: "在播放头新建字幕（2s）",
          defaultText: "双击修改字幕",
          content: "文本内容",
          fontSize: "字号",
          color: "颜色",
          animation: "动画",
          animationLabels: { fadeIn: "淡入", bounce: "弹跳", typewriter: "打字机" } as Record<
            (typeof ANIMATIONS)[number],
            string
          >,
        };
  const selectedTextClip = useMemo(() => {
    const clip = clips.find((c) => c.id === selectedClipId);
    return clip?.type === "text" ? clip : null;
  }, [clips, selectedClipId]);

  return (
    <div className="flex h-full flex-col px-3 py-2">
      <div className="mb-2 text-[11px] text-fg-muted">
        {selectedTextClip ? text.hintEdit : text.hintSelect}
      </div>

      <button
        type="button"
        className="mb-3 rounded border border-border bg-bg-2 px-2 py-1 text-[11px] text-fg hover:bg-hover"
        onClick={() => {
          const start = currentTime;
          const end = currentTime + 2;
          addTextClip(text.defaultText, start, end, 36, "#ffffff");
        }}
      >
        {text.addAtPlayhead}
      </button>

      <div className="mb-1 text-[10px] text-fg-muted">{text.content}</div>
      <textarea
        rows={3}
        value={selectedTextClip?.content ?? ""}
        disabled={!selectedTextClip}
        onChange={(e) =>
          selectedTextClip && updateTextClip(selectedTextClip.id, { content: e.target.value })
        }
        className="mb-3 resize-none rounded border border-border bg-bg-2 px-2 py-1.5 text-[12px] text-fg disabled:opacity-60"
      />

      <div className="mb-1 flex items-center justify-between text-[10px] text-fg-muted">
        <span>{text.fontSize}</span>
        <span>{Math.round(selectedTextClip?.fontSize ?? 36)}</span>
      </div>
      <input
        className="mb-3 w-full"
        type="range"
        min={16}
        max={96}
        step={1}
        disabled={!selectedTextClip}
        value={selectedTextClip?.fontSize ?? 36}
        onChange={(e) =>
          selectedTextClip &&
          updateTextClip(selectedTextClip.id, { fontSize: Number(e.target.value) })
        }
      />

      <div className="mb-1 text-[10px] text-fg-muted">{text.color}</div>
      <input
        className="mb-3 h-8 w-full rounded border border-border bg-bg-2"
        type="color"
        disabled={!selectedTextClip}
        value={selectedTextClip?.color ?? "#ffffff"}
        onChange={(e) =>
          selectedTextClip && updateTextClip(selectedTextClip.id, { color: e.target.value })
        }
      />

      <div className="mb-1 text-[10px] text-fg-muted">{text.animation}</div>
      <select
        className="rounded border border-border bg-bg-2 px-2 py-1 text-[11px] text-fg disabled:opacity-60"
        disabled={!selectedTextClip}
        value={selectedTextClip?.animation?.type ?? "fadeIn"}
        onChange={(e) =>
          selectedTextClip &&
          updateTextClip(selectedTextClip.id, {
            animation: {
              type: e.target.value as "fadeIn" | "bounce" | "typewriter",
              duration: selectedTextClip.animation?.duration ?? 0.35,
            },
          })
        }
      >
        {ANIMATIONS.map((a) => (
          <option key={a} value={a}>
            {text.animationLabels[a]}
          </option>
        ))}
      </select>
    </div>
  );
}
