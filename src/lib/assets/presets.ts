import type { FilterName } from "../filters";

export interface FilterPresetItem {
  id: string;
  label: string;
  filterName: FilterName;
  intensity: number;
  previewCss: string;
}

export interface TransitionPresetItem {
  id: string;
  label: string;
  type: "crossDissolve" | "fade" | "slide" | "wipe";
  duration: number;
}

export interface TextStylePresetItem {
  id: string;
  label: string;
  content: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  stroke?: { width: number; color: string };
  shadow?: { blur: number; offsetX: number; offsetY: number; color: string };
  animation?: { type: "fadeIn" | "bounce" | "typewriter"; duration: number };
}

export interface MusicPresetItem {
  id: string;
  label: string;
  url: string;
  filename: string;
}

export const filterPresets: FilterPresetItem[] = [
  { id: "f-vintage", label: "复古胶片", filterName: "vintage", intensity: 0.9, previewCss: "sepia(0.65) contrast(1.1)" },
  { id: "f-noir", label: "黑白纪实", filterName: "noir", intensity: 1, previewCss: "grayscale(1) contrast(1.2)" },
  { id: "f-cinematic", label: "电影感", filterName: "cinematic", intensity: 0.85, previewCss: "contrast(1.2) saturate(0.9)" },
  { id: "f-dreamy", label: "梦幻", filterName: "dreamy", intensity: 0.8, previewCss: "brightness(1.08) blur(0.6px)" },
];

export const transitionPresets: TransitionPresetItem[] = [
  { id: "t-cross", label: "交叉溶解 · 1.0s", type: "crossDissolve", duration: 1 },
  { id: "t-fade", label: "淡入淡出 · 0.8s", type: "fade", duration: 0.8 },
  { id: "t-slide", label: "滑动 · 0.6s", type: "slide", duration: 0.6 },
  { id: "t-wipe", label: "擦除 · 0.7s", type: "wipe", duration: 0.7 },
];

export const textStylePresets: TextStylePresetItem[] = [
  {
    id: "txt-title",
    label: "主标题",
    content: "请输入标题",
    fontSize: 56,
    color: "#ffffff",
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
    stroke: { width: 3, color: "#000000" },
    shadow: { blur: 10, offsetX: 0, offsetY: 2, color: "rgba(0,0,0,0.35)" },
    animation: { type: "fadeIn", duration: 0.4 },
  },
  {
    id: "txt-sub",
    label: "字幕条",
    content: "这里是字幕内容",
    fontSize: 34,
    color: "#fef08a",
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
    stroke: { width: 2, color: "#111827" },
    animation: { type: "typewriter", duration: 0.9 },
  },
  {
    id: "txt-pop",
    label: "强调弹出",
    content: "精彩瞬间！",
    fontSize: 46,
    color: "#60a5fa",
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
    shadow: { blur: 14, offsetX: 0, offsetY: 0, color: "rgba(96,165,250,0.45)" },
    animation: { type: "bounce", duration: 0.7 },
  },
];

export const musicPresets: MusicPresetItem[] = [
  {
    id: "music-calm",
    label: "Calm Loop",
    url: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8f9f4134c.mp3?filename=fashion-week-13074.mp3",
    filename: "calm-loop.mp3",
  },
  {
    id: "music-vlog",
    label: "Vlog Beat",
    url: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_1f29f27d8c.mp3?filename=travel-vlog-13195.mp3",
    filename: "vlog-beat.mp3",
  },
];

