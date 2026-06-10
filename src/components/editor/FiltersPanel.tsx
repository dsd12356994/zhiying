import { useEffect, useMemo, useState } from "react";
import { FILTER_PRESETS, buildFilterCss, type FilterName } from "../../lib/filters";
import { useEditorStore } from "../../stores/editor-store";
import { useSettingsStore } from "../../stores/settings-store";

export function FiltersPanel() {
  const { clips, selectedClipId, applyFilter } = useEditorStore();
  const language = useSettingsStore((s) => s.language);
  const text =
    language === "en"
      ? {
          hintReady: "Choose a filter and adjust intensity.",
          hintSelect: "Select a video clip to apply filters.",
          intensity: "Intensity",
        }
      : {
          hintReady: "选择滤镜并调节强度",
          hintSelect: "请选择一个视频片段后设置滤镜",
          intensity: "强度",
        };
  const selectedClip = useMemo(
    () => clips.find((clip) => clip.id === selectedClipId) ?? null,
    [clips, selectedClipId]
  );
  const [filterName, setFilterName] = useState<FilterName>("none");
  const [intensity, setIntensity] = useState(1);

  useEffect(() => {
    if (!selectedClip?.filter) {
      setFilterName("none");
      setIntensity(1);
      return;
    }
    setFilterName(selectedClip.filter.name);
    setIntensity(selectedClip.filter.intensity);
  }, [selectedClip?.filter, selectedClip?.id]);

  const canApply = Boolean(selectedClipId && selectedClip?.type === "video");

  const applyCurrentFilter = (nextName: FilterName, nextIntensity: number) => {
    if (!selectedClipId) return;
    void applyFilter(selectedClipId, nextName, nextIntensity);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-2 text-[11px] text-fg-muted">
        {canApply ? text.hintReady : text.hintSelect}
      </div>

      <div className="grid grid-cols-2 gap-2 overflow-y-auto px-3 pb-3">
        {FILTER_PRESETS.map((preset) => {
          const selected = preset.name === filterName;
          return (
            <button
              key={preset.name}
              type="button"
              disabled={!canApply}
              onClick={() => {
                setFilterName(preset.name);
                applyCurrentFilter(preset.name, intensity);
              }}
              className={`rounded-md border p-1.5 text-left transition-colors ${
                selected ? "border-accent" : "border-border"
              } ${canApply ? "hover:bg-hover" : "opacity-60"}`}
            >
              <div
                className="mb-1 h-10 rounded"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(170,190,220,0.75) 100%)",
                  filter: buildFilterCss(preset.name, intensity),
                }}
              />
              <div className="truncate text-[10px] text-fg">{preset.label}</div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-border px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-[10px] text-fg-muted">
          <span>{text.intensity}</span>
          <span>{intensity.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          disabled={!canApply}
          value={intensity}
          onChange={(e) => {
            const next = Number(e.target.value);
            setIntensity(next);
            applyCurrentFilter(filterName, next);
          }}
          className="w-full"
        />
      </div>
    </div>
  );
}
