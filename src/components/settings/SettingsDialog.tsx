import { X } from "lucide-react";
import { EXPORT_PRESETS, useSettingsStore } from "../../stores/settings-store";
import { resetOnboardingDone } from "../onboarding/OnboardingTour";

interface Props {
  open: boolean;
  onClose: () => void;
}

const shortcutLabels: Record<string, string> = {
  playPause: "播放 / 暂停",
  split: "分割片段",
  undo: "撤销",
  redo: "重做",
  marker: "添加标记",
  removeMarker: "删除最近标记",
};

export function SettingsDialog({ open, onClose }: Props) {
  const { theme, setTheme, language, setLanguage, exportPreset, setExportPreset, shortcuts, setShortcut } =
    useSettingsStore();
  const text = language === "en"
    ? {
        title: "Preferences",
        lang: "Language",
        theme: "Theme",
        light: "Light",
        dark: "Dark",
        exportPreset: "Export Preset",
        exportHint:
          "Current export pipeline applies fps first; resolution/bitrate are saved and will be wired into exporter next.",
        shortcuts: "Shortcuts",
      }
    : {
        title: "偏好设置",
        lang: "语言 / Language",
        theme: "主题",
        light: "浅色",
        dark: "深色",
        exportPreset: "导出预设",
        exportHint: "当前导出链路优先应用帧率；分辨率与码率已保存为项目偏好，后续将接入导出器。",
        shortcuts: "快捷键",
      };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-[480px] rounded-xl border border-border bg-bg-elev p-5 shadow-2xl animate-modal-pop">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-semibold text-fg">{text.title}</div>
          <button onClick={onClose} className="text-fg-muted hover:text-fg">
            <X size={16} />
          </button>
        </div>

        <section className="mb-4 rounded-lg border border-border bg-bg-2 p-3">
          <div className="mb-2 text-xs font-medium text-fg">{text.lang}</div>
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage("zh")}
              className={`rounded-md px-3 py-1 text-xs ${
                language === "zh" ? "bg-accent text-accent-fg" : "bg-bg-3 text-fg-2"
              }`}
            >
              中文
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-md px-3 py-1 text-xs ${
                language === "en" ? "bg-accent text-accent-fg" : "bg-bg-3 text-fg-2"
              }`}
            >
              English
            </button>
          </div>

          <div className="mb-2 text-xs font-medium text-fg">{text.theme}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`rounded-md px-3 py-1 text-xs ${
                theme === "light" ? "bg-accent text-accent-fg" : "bg-bg-3 text-fg-2"
              }`}
            >
              {text.light}
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`rounded-md px-3 py-1 text-xs ${
                theme === "dark" ? "bg-accent text-accent-fg" : "bg-bg-3 text-fg-2"
              }`}
            >
              {text.dark}
            </button>
          </div>
        </section>

        <section className="mb-4 rounded-lg border border-border bg-bg-2 p-3">
          <div className="mb-2 text-xs font-medium text-fg">{text.exportPreset}</div>
          <select
            value={exportPreset}
            onChange={(e) => setExportPreset(e.target.value as typeof exportPreset)}
            className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg outline-none"
          >
            {EXPORT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} · {preset.width}x{preset.height} · {preset.bitrateMbps}Mbps
              </option>
            ))}
          </select>
          <div className="mt-1 text-[11px] text-fg-muted">{text.exportHint}</div>
        </section>

        <section className="rounded-lg border border-border bg-bg-2 p-3">
          <div className="mb-2 text-xs font-medium text-fg">{text.shortcuts}</div>
          <div className="space-y-2">
            {Object.entries(shortcuts).map(([action, binding]) => (
              <div key={action} className="flex items-center justify-between gap-3">
                <span className="text-xs text-fg-2">{shortcutLabels[action] ?? action}</span>
                <input
                  value={binding}
                  onChange={(e) => setShortcut(action, e.target.value)}
                  className="w-36 rounded-md border border-border bg-bg px-2 py-1 text-xs text-fg outline-none"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                resetOnboardingDone();
                onClose();
                window.location.reload();
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg"
            >
              重置新手引导 / Reset Tour
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

