import { create } from "zustand";

export type ThemeMode = "light" | "dark";
export type ExportPresetId = "1080p30" | "720p30" | "480p30";
export type UiLanguage = "zh" | "en";

export interface ExportPreset {
  id: ExportPresetId;
  label: string;
  width: number;
  height: number;
  fps: number;
  bitrateMbps: number;
}

export const EXPORT_PRESETS: ExportPreset[] = [
  { id: "1080p30", label: "1080p · 30fps", width: 1920, height: 1080, fps: 30, bitrateMbps: 10 },
  { id: "720p30", label: "720p · 30fps", width: 1280, height: 720, fps: 30, bitrateMbps: 6 },
  { id: "480p30", label: "480p · 30fps", width: 854, height: 480, fps: 30, bitrateMbps: 3 },
];

const STORAGE_KEY = "zhiying.settings.v1";

interface SettingsState {
  theme: ThemeMode;
  language: UiLanguage;
  exportPreset: ExportPresetId;
  shortcuts: Record<string, string>;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: UiLanguage) => void;
  setExportPreset: (preset: ExportPresetId) => void;
  setShortcut: (action: string, binding: string) => void;
  getExportPresetConfig: () => ExportPreset;
}

interface PersistedSettings {
  theme: ThemeMode;
  language: UiLanguage;
  exportPreset: ExportPresetId;
  shortcuts: Record<string, string>;
}

const DEFAULT_SHORTCUTS: Record<string, string> = {
  playPause: "Space",
  split: "Ctrl+B",
  undo: "Ctrl+Z",
  redo: "Ctrl+Shift+Z",
  marker: "M",
  removeMarker: "Shift+M",
};

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

function readInitial(): PersistedSettings {
  const fallback: PersistedSettings = {
    theme: "light",
    language: "zh",
    exportPreset: "1080p30",
    shortcuts: DEFAULT_SHORTCUTS,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    const theme = parsed.theme === "dark" ? "dark" : "light";
    const language = parsed.language === "en" ? "en" : "zh";
    const exportPreset = EXPORT_PRESETS.some((p) => p.id === parsed.exportPreset)
      ? (parsed.exportPreset as ExportPresetId)
      : "1080p30";
    const shortcuts = { ...DEFAULT_SHORTCUTS, ...(parsed.shortcuts ?? {}) };
    return { theme, language, exportPreset, shortcuts };
  } catch {
    return fallback;
  }
}

function persist(state: PersistedSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota/storage failures
  }
}

const initial = readInitial();
applyTheme(initial.theme);

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  theme: initial.theme,
  language: initial.language,
  exportPreset: initial.exportPreset,
  shortcuts: initial.shortcuts,

  setTheme: (theme) =>
    set((s) => {
      applyTheme(theme);
      const next = {
        theme,
        language: s.language,
        exportPreset: s.exportPreset,
        shortcuts: s.shortcuts,
      };
      persist(next);
      return { theme };
    }),

  setLanguage: (language) =>
    set((s) => {
      const next = {
        theme: s.theme,
        language,
        exportPreset: s.exportPreset,
        shortcuts: s.shortcuts,
      };
      persist(next);
      return { language };
    }),

  setExportPreset: (preset) =>
    set((s) => {
      const next = {
        theme: s.theme,
        language: s.language,
        exportPreset: preset,
        shortcuts: s.shortcuts,
      };
      persist(next);
      return { exportPreset: preset };
    }),

  setShortcut: (action, binding) =>
    set((s) => {
      const shortcuts = { ...s.shortcuts, [action]: binding };
      const next = {
        theme: s.theme,
        language: s.language,
        exportPreset: s.exportPreset,
        shortcuts,
      };
      persist(next);
      return { shortcuts };
    }),

  getExportPresetConfig: () => {
    const id = get().exportPreset;
    return EXPORT_PRESETS.find((p) => p.id === id) ?? EXPORT_PRESETS[0];
  },
}));

