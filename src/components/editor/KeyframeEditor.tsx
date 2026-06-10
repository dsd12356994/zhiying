import { useMemo, useState } from "react";
import { useEditorStore, type KeyframeProperty } from "../../stores/editor-store";
import { useSettingsStore } from "../../stores/settings-store";

const PROPS: Array<{ key: KeyframeProperty }> = [
  { key: "x" },
  { key: "y" },
  { key: "scale" },
  { key: "rotation" },
  { key: "opacity" },
];

function defaultValue(prop: KeyframeProperty) {
  if (prop === "scale") return 1;
  if (prop === "opacity") return 1;
  return 0;
}

export function KeyframeEditor() {
  const {
    clips,
    selectedClipId,
    currentTime,
    addKeyframe,
    updateKeyframe,
    removeKeyframe,
  } = useEditorStore();
  const language = useSettingsStore((s) => s.language);
  const text =
    language === "en"
      ? {
          propLabels: {
            x: "X Position",
            y: "Y Position",
            scale: "Scale",
            rotation: "Rotation",
            opacity: "Opacity",
          } as Record<KeyframeProperty, string>,
          hintReady: "Add keyframes for selected clip",
          hintSelect: "Select a clip first",
          property: "Property",
          value: "Value",
          addCurrent: "Add Keyframe At Current Time",
          listTitle: "Keyframes For Current Property",
          empty: "No keyframes yet",
          remove: "Delete",
        }
      : {
          propLabels: {
            x: "X 位置",
            y: "Y 位置",
            scale: "缩放",
            rotation: "旋转",
            opacity: "透明度",
          } as Record<KeyframeProperty, string>,
          hintReady: "为选中片段添加关键帧",
          hintSelect: "请先选中一个片段",
          property: "属性",
          value: "值",
          addCurrent: "在当前时间添加关键帧",
          listTitle: "当前属性关键帧",
          empty: "暂无关键帧",
          remove: "删除",
        };
  const [prop, setProp] = useState<KeyframeProperty>("scale");
  const [value, setValue] = useState(1);
  const selectedClip = useMemo(
    () => clips.find((clip) => clip.id === selectedClipId) ?? null,
    [clips, selectedClipId]
  );
  const localTime = selectedClip ? Math.max(0, currentTime - selectedClip.start) : 0;
  const keyframes = selectedClip?.keyframes?.[prop] ?? [];

  return (
    <div className="flex h-full flex-col px-3 py-2">
      <div className="mb-2 text-[11px] text-fg-muted">
        {selectedClip ? text.hintReady : text.hintSelect}
      </div>

      <div className="mb-1 text-[10px] text-fg-muted">{text.property}</div>
      <select
        className="mb-2 rounded border border-border bg-bg-2 px-2 py-1 text-[11px] text-fg"
        value={prop}
        onChange={(e) => {
          const next = e.target.value as KeyframeProperty;
          setProp(next);
          setValue(defaultValue(next));
        }}
      >
        {PROPS.map((p) => (
          <option key={p.key} value={p.key}>
            {text.propLabels[p.key]}
          </option>
        ))}
      </select>

      <div className="mb-1 flex items-center justify-between text-[10px] text-fg-muted">
        <span>{text.value}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <input
        className="mb-2 w-full"
        type="range"
        min={prop === "opacity" ? 0 : -2}
        max={prop === "rotation" ? 360 : prop === "opacity" ? 1 : prop === "scale" ? 3 : 2}
        step={prop === "rotation" ? 1 : 0.01}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />

      <button
        type="button"
        className="mb-3 rounded border border-border bg-bg-2 px-2 py-1 text-[11px] text-fg hover:bg-hover disabled:opacity-50"
        disabled={!selectedClip}
        onClick={() => {
          if (!selectedClip) return;
          addKeyframe(selectedClip.id, prop, localTime, value);
        }}
      >
        {text.addCurrent} ({localTime.toFixed(2)}s)
      </button>

      <div className="text-[10px] text-fg-muted">{text.listTitle}</div>
      <div className="mt-1 flex-1 overflow-y-auto space-y-1">
        {keyframes.length === 0 ? (
          <div className="text-[10px] text-fg-muted">{text.empty}</div>
        ) : (
          keyframes.map((k) => (
            <div
              key={k.id}
              className="rounded border border-border bg-bg-2 px-2 py-1 text-[10px]"
            >
              <div className="flex items-center gap-1">
                <span className="text-fg-muted">t</span>
                <input
                  type="number"
                  step={0.01}
                  value={k.time}
                  className="w-14 rounded border border-border bg-bg-1 px-1 py-0.5 text-[10px]"
                  onChange={(e) =>
                    selectedClip &&
                    updateKeyframe(selectedClip.id, prop, k.id, {
                      time: Number(e.target.value),
                    })
                  }
                />
                <span className="text-fg-muted">v</span>
                <input
                  type="number"
                  step={0.01}
                  value={k.value}
                  className="w-14 rounded border border-border bg-bg-1 px-1 py-0.5 text-[10px]"
                  onChange={(e) =>
                    selectedClip &&
                    updateKeyframe(selectedClip.id, prop, k.id, {
                      value: Number(e.target.value),
                    })
                  }
                />
                <select
                  value={k.easing}
                  className="rounded border border-border bg-bg-1 px-1 py-0.5 text-[10px]"
                  onChange={(e) =>
                    selectedClip &&
                    updateKeyframe(selectedClip.id, prop, k.id, {
                      easing: e.target.value as "linear" | "easeInOut" | "bounce",
                    })
                  }
                >
                  <option value="linear">linear</option>
                  <option value="easeInOut">easeInOut</option>
                  <option value="bounce">bounce</option>
                </select>
                <button
                  type="button"
                  className="ml-auto text-fg-muted hover:text-fg"
                  onClick={() => selectedClip && removeKeyframe(selectedClip.id, prop, k.id)}
                >
                  {text.remove}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
