import { useMemo, useState } from "react";
import { useEditorStore } from "../../stores/editor-store";
import { useProjectStore } from "../../stores/project-store";
import {
  filterPresets,
  musicPresets,
  textStylePresets,
  transitionPresets,
  type MusicPresetItem,
} from "../../lib/assets/presets";
import { useSettingsStore } from "../../stores/settings-store";

export function MarketplacePanel() {
  const {
    clips,
    selectedClipId,
    currentTime,
    getTotalDuration,
    applyFilter,
    addTransition,
    addTextClip,
    updateTextClip,
    addClip: addEditorClip,
  } = useEditorStore();
  const { addMedia, addClip: addProjectClip } = useProjectStore();
  const language = useSettingsStore((s) => s.language);
  const text =
    language === "en"
      ? {
          title: "Marketplace Presets",
          filter: "Filter Presets",
          transition: "Transition Presets",
          textStyle: "Text Style Presets",
          music: "Music Presets",
          importing: "Importing...",
          importPrefix: "Import",
          msgFilter: "Filter applied:",
          msgTransition: "Transition added:",
          msgText: "Text style created:",
          msgMusicOk: "Music imported:",
          msgMusicFail: "Music import failed:",
          msgUnknown: "Unknown error",
          msgDownloadFail: "Download failed",
        }
      : {
          title: "素材市场（预设）",
          filter: "滤镜预设",
          transition: "转场预设",
          textStyle: "字幕样式预设",
          music: "音乐预设",
          importing: "导入中...",
          importPrefix: "导入",
          msgFilter: "已应用滤镜：",
          msgTransition: "已添加转场：",
          msgText: "已创建字幕：",
          msgMusicOk: "已导入音乐：",
          msgMusicFail: "音乐导入失败：",
          msgUnknown: "未知错误",
          msgDownloadFail: "下载失败",
        };
  const [message, setMessage] = useState<string>("");
  const [importingMusicId, setImportingMusicId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...clips].sort((a, b) => (a.start === b.start ? a.trackIndex - b.trackIndex : a.start - b.start)),
    [clips]
  );
  const selectedClip = useMemo(
    () => sorted.find((clip) => clip.id === selectedClipId) ?? null,
    [selectedClipId, sorted]
  );
  const nextClip = useMemo(() => {
    if (!selectedClip) return null;
    return (
      sorted.find(
        (clip) =>
          clip.id !== selectedClip.id &&
          clip.trackIndex === selectedClip.trackIndex &&
          clip.start >= selectedClip.end - 0.0001
      ) ?? null
    );
  }, [selectedClip, sorted]);

  const applyMusicPreset = async (preset: MusicPresetItem) => {
    setImportingMusicId(preset.id);
    setMessage("");
    try {
      const res = await fetch(preset.url);
      if (!res.ok) throw new Error(`${text.msgDownloadFail} (${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], preset.filename, { type: blob.type || "audio/mpeg" });
      const media = await addMedia(file);
      const start = Math.max(0, currentTime);
      addProjectClip(media.id, 1, start);
      addEditorClip({
        type: "audio",
        src: media.url,
        start,
        end: start + media.duration,
        sourceStart: 0,
        sourceEnd: media.duration,
        trackIndex: 1,
        name: media.name,
      });
      setMessage(`${text.msgMusicOk} ${preset.label}`);
    } catch (error) {
      setMessage(`${text.msgMusicFail} ${error instanceof Error ? error.message : text.msgUnknown}`);
    } finally {
      setImportingMusicId(null);
    }
  };

  return (
    <div className="flex h-full flex-col px-3 py-2 text-[11px]">
      <div className="mb-2 text-fg-muted">{text.title}</div>
      {message && (
        <div className="mb-2 rounded border border-border bg-bg-2 px-2 py-1 text-[10px] text-fg-2">{message}</div>
      )}

      <div className="overflow-y-auto pr-1">
        <section className="mb-3">
          <div className="mb-1 text-[10px] text-fg-muted">{text.filter}</div>
          <div className="grid grid-cols-2 gap-2">
            {filterPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={!selectedClip || selectedClip.type !== "video"}
                onClick={() => {
                  if (!selectedClip) return;
                  void applyFilter(selectedClip.id, preset.filterName, preset.intensity);
                  setMessage(`${text.msgFilter} ${preset.label}`);
                }}
                className="rounded border border-border p-1 text-left hover:bg-hover disabled:opacity-50"
              >
                <div
                  className="mb-1 h-8 rounded"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.86) 0%, rgba(160,180,220,0.7) 100%)",
                    filter: preset.previewCss,
                  }}
                />
                <div className="truncate text-[10px] text-fg">{preset.label}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-3">
          <div className="mb-1 text-[10px] text-fg-muted">{text.transition}</div>
          <div className="space-y-1">
            {transitionPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={!selectedClip || !nextClip}
                onClick={() => {
                  if (!selectedClip || !nextClip) return;
                  addTransition({
                    fromClipId: selectedClip.id,
                    toClipId: nextClip.id,
                    type: preset.type,
                    duration: preset.duration,
                  });
                  setMessage(`${text.msgTransition} ${preset.label}`);
                }}
                className="w-full rounded border border-border px-2 py-1 text-left text-[10px] text-fg hover:bg-hover disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-3">
          <div className="mb-1 text-[10px] text-fg-muted">{text.textStyle}</div>
          <div className="space-y-1">
            {textStylePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  const start = Math.max(0, currentTime);
                  const end = Math.min(Math.max(start + 2.5, start + 0.1), Math.max(getTotalDuration(), start + 2.5));
                  const id = addTextClip(preset.content, start, end, preset.fontSize, preset.color);
                  if (!id) return;
                  updateTextClip(id, {
                    fontFamily: preset.fontFamily,
                    stroke: preset.stroke,
                    shadow: preset.shadow,
                    animation: preset.animation,
                  });
                  setMessage(`${text.msgText} ${preset.label}`);
                }}
                className="w-full rounded border border-border px-2 py-1 text-left text-[10px] text-fg hover:bg-hover"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-1 text-[10px] text-fg-muted">{text.music}</div>
          <div className="space-y-1">
            {musicPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={importingMusicId !== null}
                onClick={() => void applyMusicPreset(preset)}
                className="w-full rounded border border-border px-2 py-1 text-left text-[10px] text-fg hover:bg-hover disabled:opacity-50"
              >
                {importingMusicId === preset.id
                  ? text.importing
                  : `${text.importPrefix} ${preset.label}`}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

