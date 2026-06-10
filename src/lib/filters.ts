export type FilterName =
  | "none"
  | "vintage"
  | "noir"
  | "sepia"
  | "warm"
  | "cool"
  | "dreamy"
  | "sharp"
  | "blur"
  | "pixelate"
  | "cinematic"
  | "film"
  | "mono"
  | "tealOrange"
  | "sunset"
  | "fresh"
  | "dramatic"
  | "soft"
  | "highKey"
  | "lowKey";

export interface ClipFilter {
  name: FilterName;
  intensity: number;
  cssValue?: string;
}

export interface FilterPreset {
  name: FilterName;
  label: string;
  css: (intensity: number) => string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const mix = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

export const FILTER_PRESETS: FilterPreset[] = [
  { name: "none", label: "原片", css: () => "none" },
  {
    name: "vintage",
    label: "复古",
    css: (t) => `sepia(${mix(0, 0.55, t)}) contrast(${mix(1, 1.08, t)}) saturate(${mix(1, 0.88, t)})`,
  },
  { name: "noir", label: "黑白", css: (t) => `grayscale(${mix(0, 1, t)}) contrast(${mix(1, 1.25, t)})` },
  { name: "sepia", label: "棕褐", css: (t) => `sepia(${mix(0, 1, t)})` },
  { name: "warm", label: "暖调", css: (t) => `saturate(${mix(1, 1.25, t)}) hue-rotate(${mix(0, -8, t)}deg)` },
  { name: "cool", label: "冷调", css: (t) => `saturate(${mix(1, 0.95, t)}) hue-rotate(${mix(0, 10, t)}deg)` },
  { name: "dreamy", label: "梦幻", css: (t) => `brightness(${mix(1, 1.12, t)}) blur(${mix(0, 1.6, t)}px)` },
  { name: "sharp", label: "锐化", css: (t) => `contrast(${mix(1, 1.3, t)}) saturate(${mix(1, 1.15, t)})` },
  { name: "blur", label: "模糊", css: (t) => `blur(${mix(0, 2.2, t)}px)` },
  {
    name: "pixelate",
    label: "像素",
    css: (t) => `contrast(${mix(1, 1.2, t)}) saturate(${mix(1, 0.65, t)})`,
  },
  {
    name: "cinematic",
    label: "电影感",
    css: (t) => `contrast(${mix(1, 1.2, t)}) saturate(${mix(1, 0.88, t)}) brightness(${mix(1, 0.95, t)})`,
  },
  { name: "film", label: "胶片", css: (t) => `contrast(${mix(1, 1.12, t)}) sepia(${mix(0, 0.2, t)})` },
  { name: "mono", label: "单色", css: (t) => `grayscale(${mix(0, 0.85, t)})` },
  {
    name: "tealOrange",
    label: "青橙",
    css: (t) => `hue-rotate(${mix(0, 8, t)}deg) saturate(${mix(1, 1.2, t)}) contrast(${mix(1, 1.1, t)})`,
  },
  { name: "sunset", label: "夕阳", css: (t) => `sepia(${mix(0, 0.28, t)}) saturate(${mix(1, 1.22, t)})` },
  { name: "fresh", label: "清新", css: (t) => `brightness(${mix(1, 1.08, t)}) saturate(${mix(1, 1.15, t)})` },
  { name: "dramatic", label: "戏剧", css: (t) => `contrast(${mix(1, 1.35, t)}) brightness(${mix(1, 0.9, t)})` },
  { name: "soft", label: "柔和", css: (t) => `contrast(${mix(1, 0.92, t)}) brightness(${mix(1, 1.08, t)})` },
  { name: "highKey", label: "高调", css: (t) => `brightness(${mix(1, 1.2, t)}) contrast(${mix(1, 0.9, t)})` },
  { name: "lowKey", label: "低调", css: (t) => `brightness(${mix(1, 0.8, t)}) contrast(${mix(1, 1.2, t)})` },
];

const PRESET_MAP = new Map(FILTER_PRESETS.map((p) => [p.name, p]));

export function buildFilterCss(name: FilterName, intensity = 1): string {
  const preset = PRESET_MAP.get(name);
  if (!preset) return "none";
  return preset.css(clamp01(intensity));
}
