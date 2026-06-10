import { useMemo } from "react";
import { useEditorStore } from "../../stores/editor-store";
import { useSettingsStore } from "../../stores/settings-store";

export function SpeedEditor() {
  const { clips, selectedClipId, setClipSpeed } = useEditorStore();
  const language = useSettingsStore((s) => s.language);
  const text =
    language === "en"
      ? {
          hintReady: "Adjust speed for selected video clip",
          hintSelect: "Select a video clip",
          speed: "Speed",
          duration: "Clip duration",
        }
      : {
          hintReady: "调节选中视频片段速度",
          hintSelect: "请选择一个视频片段",
          speed: "速度",
          duration: "当前片段时长",
        };
  const selectedClip = useMemo(
    () => clips.find((clip) => clip.id === selectedClipId) ?? null,
    [clips, selectedClipId]
  );
  const canEdit = Boolean(selectedClip && selectedClip.type === "video");
  const speed = selectedClip?.speed ?? 1;
  const clipDuration = selectedClip ? selectedClip.end - selectedClip.start : 0;

  return (
    <div className="flex h-full flex-col px-3 py-2">
      <div className="mb-2 text-[11px] text-fg-muted">
        {canEdit ? text.hintReady : text.hintSelect}
      </div>
      <div className="mb-1 flex items-center justify-between text-[10px] text-fg-muted">
        <span>{text.speed}</span>
        <span>{speed.toFixed(2)}x</span>
      </div>
      <input
        className="w-full"
        type="range"
        min={0.1}
        max={10}
        step={0.1}
        disabled={!canEdit}
        value={speed}
        onChange={(e) => {
          if (!selectedClip) return;
          setClipSpeed(selectedClip.id, Number(e.target.value));
        }}
      />
      <div className="mt-3 rounded border border-border bg-bg-2 px-2 py-1 text-[10px] text-fg-muted">
        {text.duration}: {clipDuration.toFixed(2)}s
      </div>
    </div>
  );
}
