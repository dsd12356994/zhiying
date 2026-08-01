import { create } from "zustand";

export type ThemeMode = "light" | "dark";
export type ExportPresetId = "1080p30" | "720p30" | "480p30";
export type UiLanguage = "zh" | "en";
export type AiProviderKey = "mock" | "openai" | "deepseek" | "claude" | "zhipu";

export interface AiProviderConfig {
  apiKey: string;
  model: string;
  apiUrl: string;
}

export interface AiConfig {
  provider: AiProviderKey;
  visionProvider: AiProviderKey | "";  // "" = auto: use provider if vision-capable, else first available
  openai: AiProviderConfig;
  deepseek: AiProviderConfig;
  claude: AiProviderConfig;
  zhipu: AiProviderConfig;
  heygenApiKey: string;
  videoGenProvider: "runway" | "fal" | "tongyi" | "kling" | "cogvideo";
  videoGenRegion: "beijing" | "singapore";
  videoGenEndpoint: string;
  videoGenWorkspaceId: string;
  videoGenModel: string;
  runwayApiKey: string;
  falApiKey: string;
  dashscopeApiKey: string;
  klingApiKey: string;
  replicateApiKey: string;
}

export const AI_CONFIG_KEY = "zhiying.aiConfig.v1";

export const DEFAULT_AI_CONFIG: AiConfig = {
  provider: "mock",
  visionProvider: "",
  openai: { apiKey: "", model: "gpt-4.1-mini", apiUrl: "" },
  deepseek: { apiKey: "", model: "deepseek-chat", apiUrl: "" },
  claude: { apiKey: "", model: "claude-sonnet-4-6", apiUrl: "" },
  zhipu: { apiKey: "", model: "glm-4-flash", apiUrl: "" },
  heygenApiKey: "",
  videoGenProvider: "runway",
  videoGenRegion: "beijing",
  videoGenEndpoint: "",
  videoGenWorkspaceId: "",
  videoGenModel: "",
  runwayApiKey: "",
  falApiKey: "",
  dashscopeApiKey: "",
  klingApiKey: "",
  replicateApiKey: "",
};

/** Providers that support vision/image analysis */
export const VISION_PROVIDERS: AiProviderKey[] = ["openai", "claude", "zhipu"];

export function resolveVisionProvider(config: AiConfig): AiProviderKey | null {
  if (config.visionProvider && VISION_PROVIDERS.includes(config.visionProvider as AiProviderKey)) {
    return config.visionProvider as AiProviderKey;
  }
  // Auto-detect: use main provider if vision-capable
  if (VISION_PROVIDERS.includes(config.provider)) return config.provider;
  // Fallback: first vision-capable provider with an API key
  for (const vp of VISION_PROVIDERS) {
    if (config[vp].apiKey) return vp;
  }
  return null;
}

export function readAiConfig(): AiConfig {
  if (typeof window === "undefined") return DEFAULT_AI_CONFIG;
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    return {
      provider: (["mock", "openai", "deepseek", "claude", "zhipu"] as AiProviderKey[]).includes(
        parsed.provider as AiProviderKey
      )
        ? (parsed.provider as AiProviderKey)
        : DEFAULT_AI_CONFIG.provider,
      visionProvider: parsed.visionProvider === undefined
        ? DEFAULT_AI_CONFIG.visionProvider
        : (parsed.visionProvider as AiProviderKey | ""),
      openai: { ...DEFAULT_AI_CONFIG.openai, ...(parsed.openai ?? {}) },
      deepseek: { ...DEFAULT_AI_CONFIG.deepseek, ...(parsed.deepseek ?? {}) },
      claude: { ...DEFAULT_AI_CONFIG.claude, ...(parsed.claude ?? {}) },
      zhipu: { ...DEFAULT_AI_CONFIG.zhipu, ...(parsed.zhipu ?? {}) },
      heygenApiKey: parsed.heygenApiKey ?? DEFAULT_AI_CONFIG.heygenApiKey,
      videoGenProvider: (["runway", "fal", "tongyi", "kling", "cogvideo"] as const).includes(parsed.videoGenProvider as "runway" | "fal" | "tongyi" | "kling" | "cogvideo")
        ? (parsed.videoGenProvider as "runway" | "fal" | "tongyi" | "kling" | "cogvideo")
        : DEFAULT_AI_CONFIG.videoGenProvider,
      videoGenRegion: (["beijing", "singapore"] as const).includes(parsed.videoGenRegion as "beijing")
        ? (parsed.videoGenRegion as "beijing" | "singapore")
        : "beijing",
      videoGenEndpoint: parsed.videoGenEndpoint ?? "",
      videoGenWorkspaceId: parsed.videoGenWorkspaceId ?? "",
      videoGenModel: parsed.videoGenModel ?? "",
      runwayApiKey: parsed.runwayApiKey ?? "",
      falApiKey: parsed.falApiKey ?? "",
      dashscopeApiKey: parsed.dashscopeApiKey ?? "",
      klingApiKey: parsed.klingApiKey ?? "",
      replicateApiKey: parsed.replicateApiKey ?? "",
    };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
}

export function persistAiConfig(config: AiConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore quota failures
  }
}

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
  aiConfig: AiConfig;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: UiLanguage) => void;
  setExportPreset: (preset: ExportPresetId) => void;
  setShortcut: (action: string, binding: string) => void;
  getExportPresetConfig: () => ExportPreset;
  setAiConfig: (patch: Partial<AiConfig>) => void;
  setAiProviderConfig: (provider: keyof Omit<AiConfig, "provider">, patch: Partial<AiProviderConfig>) => void;
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
const initialAiConfig = readAiConfig();

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  theme: initial.theme,
  language: initial.language,
  exportPreset: initial.exportPreset,
  shortcuts: initial.shortcuts,
  aiConfig: initialAiConfig,

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

  setAiConfig: (patch) =>
    set((s) => {
      const next = { ...s.aiConfig, ...patch };
      persistAiConfig(next);
      return { aiConfig: next };
    }),

  setAiProviderConfig: (provider, patch) =>
    set((s) => {
      const next: AiConfig = {
        ...s.aiConfig,
        [provider]: { ...s.aiConfig[provider], ...patch },
      };
      persistAiConfig(next);
      return { aiConfig: next };
    }),
}));

