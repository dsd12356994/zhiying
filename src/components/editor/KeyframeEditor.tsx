import { useMemo, useState } from "react";
import { useEditorStore, type KeyframeProperty } from "../../stores/editor-store";

const PROPS: Array<{ key: KeyframeProperty; label: string }> = [
  { key: "x", label: "X 位置" },
  { key: "y", label: "Y 位置" },
  { key: "scale", label: "缩放" },
  { key: "rotation", label: "旋转" },
  { key: "opacity", label: "透明度" },
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
        {selectedClip ? "为选中片段添加关键帧" : "请先选中一个片段"}
      </div>

      <div className="mb-1 text-[10px] text-fg-muted">属性</div>
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
            {p.label}
          </option>
        ))}
      </select>

      <div className="mb-1 flex items-center justify-between text-[10px] text-fg-muted">
        <span>值</span>
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
        在当前时间添加关键帧（{localTime.toFixed(2)}s）
      </button>

      <div className="text-[10px] text-fg-muted">当前属性关键帧</div>
      <div className="mt-1 flex-1 overflow-y-auto space-y-1">
        {keyframes.length === 0 ? (
          <div className="text-[10px] text-fg-muted">暂无关键帧</div>
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
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
