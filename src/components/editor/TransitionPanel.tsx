import { useMemo, useState } from "react";
import { useEditorStore } from "../../stores/editor-store";
import { useSettingsStore } from "../../stores/settings-store";

const TRANSITION_TYPES = ["crossDissolve", "fade", "slide", "wipe"] as const;

export function TransitionPanel() {
  const { clips, selectedClipId, addTransition } = useEditorStore();
  const language = useSettingsStore((s) => s.language);
  const text =
    language === "en"
      ? {
          typeLabels: {
            crossDissolve: "Cross Dissolve",
            fade: "Fade",
            slide: "Slide",
            wipe: "Wipe",
          } as Record<(typeof TRANSITION_TYPES)[number], string>,
          target: "Target",
          selectHint: "Select a clip (the next clip on same track will be used).",
          duration: "Duration",
          apply: "Apply To Adjacent Clips",
        }
      : {
          typeLabels: {
            crossDissolve: "交叉溶解",
            fade: "淡入淡出",
            slide: "滑动",
            wipe: "擦除",
          } as Record<(typeof TRANSITION_TYPES)[number], string>,
          target: "目标",
          selectHint: "请先选中一个片段（系统将使用其后一个同轨片段）",
          duration: "时长",
          apply: "应用到相邻片段",
        };
  const [type, setType] = useState<(typeof TRANSITION_TYPES)[number]>("crossDissolve");
  const [duration, setDuration] = useState(1);

  const sorted = useMemo(
    () => [...clips].sort((a, b) => (a.start === b.start ? a.trackIndex - b.trackIndex : a.start - b.start)),
    [clips]
  );
  const selected = useMemo(
    () => sorted.find((clip) => clip.id === selectedClipId) ?? null,
    [selectedClipId, sorted]
  );
  const nextClip = useMemo(() => {
    if (!selected) return null;
    return (
      sorted.find(
        (clip) =>
          clip.id !== selected.id &&
          clip.trackIndex === selected.trackIndex &&
          clip.start >= selected.end - 0.0001
      ) ?? null
    );
  }, [selected, sorted]);

  return (
    <div className="flex h-full flex-col px-3 py-2">
      <div className="mb-2 text-[11px] text-fg-muted">
        {selected && nextClip
          ? `${text.target}: ${selected.name ?? selected.id.slice(0, 6)} -> ${nextClip.name ?? nextClip.id.slice(0, 6)}`
          : text.selectHint}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TRANSITION_TYPES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setType(item)}
            className={`rounded border px-2 py-1 text-[11px] ${
              type === item ? "border-accent text-accent" : "border-border text-fg-2"
            } hover:bg-hover`}
          >
            {text.typeLabels[item]}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] text-fg-muted">
          <span>{text.duration}</span>
          <span>{duration.toFixed(1)}s</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <button
        type="button"
        className="mt-3 rounded border border-border bg-bg-2 px-2 py-1 text-[11px] text-fg hover:bg-hover disabled:opacity-50"
        disabled={!selected || !nextClip}
        onClick={() => {
          if (!selected || !nextClip) return;
          addTransition({
            fromClipId: selected.id,
            toClipId: nextClip.id,
            type,
            duration,
          });
        }}
      >
        {text.apply}
      </button>
    </div>
  );
}
