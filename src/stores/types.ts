/** 媒体资源 */
export interface MediaItem {
  id: string;
  name: string;
  type: "video" | "audio" | "image";
  url: string;         // object URL
  file: File;
  duration: number;
  waveform?: number[]; // 音频波形振幅数据    // seconds
  width?: number;
  height?: number;
}

/** 时间轴上的片段 */
export interface Clip {
  id: string;
  mediaId: string;
  name: string;
  type: "video" | "audio" | "image" | "text";
  start: number;       // 在时间轴上的起始位置（秒）
  duration: number;    // 片段时长（秒）
  mediaOffset: number; // 在原始媒体中的开始位置（秒）
  trackIndex: number;
  color: string;
}

/** 轨道 */
export interface Track {
  id: string;
  name: string;
  type: "video" | "audio" | "text";
  clips: Clip[];
  locked: boolean;
  muted: boolean;
}

/** 项目 */
export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  tracks: Track[];
  mediaItems: MediaItem[];
}

/** 时间轴视口 */
export interface Viewport {
  startTime: number;
  endTime: number;
  zoom: number; // pixels per second
}

export function createEmptyProject(name = "未命名项目"): Project {
  return {
    id: crypto.randomUUID(),
    name,
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 0,
    tracks: [
      { id: crypto.randomUUID(), name: "视频轨道", type: "video", clips: [], locked: false, muted: false },
      { id: crypto.randomUUID(), name: "音频轨道", type: "audio", clips: [], locked: false, muted: false },
      { id: crypto.randomUUID(), name: "文字轨道", type: "text", clips: [], locked: false, muted: false },
    ],
    mediaItems: [],
  };
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

const CLIP_COLORS = [
  "#4f9cf7", "#7c5cfc", "#f59e0b", "#10b981",
  "#ef4444", "#ec4899", "#06b6d4", "#84cc16",
];

let colorIndex = 0;
export function nextClipColor(): string {
  return CLIP_COLORS[colorIndex++ % CLIP_COLORS.length];
}
