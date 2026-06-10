import { create } from "zustand";
import type { Project, MediaItem, Clip, Track } from "./types";
import { createEmptyProject, nextClipColor } from "./types";
import { extractWaveform } from "../services/waveform";

interface HistoryEntry {
  snapshot: string; // JSON.stringify of project
}

export interface ProjectState {
  project: Project;
  currentTime: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  _undoStack: HistoryEntry[];
  _redoStack: HistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Media
  addMedia: (file: File) => Promise<MediaItem>;
  removeMedia: (id: string) => void;

  // Clips
  addClip: (mediaId: string, trackIndex: number, start: number) => void;
  moveClip: (clipId: string, trackIndex: number, newStart: number) => void;
  removeClip: (clipId: string) => void;
  splitClip: (clipId: string, atTime: number) => void;
  trimClip: (clipId: string, newStart: number, newDuration: number) => void;
  setSelectedClip: (id: string | null) => void;

  // Playback
  setCurrentTime: (t: number) => void;
  setIsPlaying: (v: boolean) => void;

  // Track management
  addTrack: (type: "video" | "audio" | "text") => void;
  removeTrack: (trackId: string) => void;
  moveTrack: (fromIndex: number, toIndex: number) => void;

  // Project
  setProjectName: (name: string) => void;
}

function pushHistory(s: ProjectState) {
  // 深拷贝 project，File 对象会被 JSON.stringify 序列化为 {}，不影响使用
  const entry: HistoryEntry = { snapshot: JSON.stringify(s.project, (_k, v) => v instanceof File ? v.name : v) };
  return {
    _undoStack: [...s._undoStack.slice(-50), entry], // max 50
    _redoStack: [],
    canUndo: true,
    canRedo: false,
  };
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  project: createEmptyProject(),
  currentTime: 0,
  isPlaying: false,
  selectedClipId: null,
  _undoStack: [],
  _redoStack: [],
  canUndo: false,
  canRedo: false,

  undo: () => {
    const { _undoStack, _redoStack, project } = get();
    if (_undoStack.length === 0) return;
    const prev = _undoStack[_undoStack.length - 1];
    const newUndo = _undoStack.slice(0, -1);
    const redoEntry: HistoryEntry = { snapshot: JSON.stringify(project) };
    set({
      project: JSON.parse(prev.snapshot),
      _undoStack: newUndo,
      _redoStack: [..._redoStack, redoEntry],
      canUndo: newUndo.length > 0,
      canRedo: true,
    });
  },

  redo: () => {
    const { _redoStack, _undoStack, project } = get();
    if (_redoStack.length === 0) return;
    const next = _redoStack[_redoStack.length - 1];
    const newRedo = _redoStack.slice(0, -1);
    const undoEntry: HistoryEntry = { snapshot: JSON.stringify(project) };
    set({
      project: JSON.parse(next.snapshot),
      _redoStack: newRedo,
      _undoStack: [..._undoStack, undoEntry],
      canRedo: newRedo.length > 0,
      canUndo: true,
    });
  },

  setCurrentTime: (t) => set({ currentTime: t }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setSelectedClip: (id) => set({ selectedClipId: id }),

  addTrack: (type) => {
    set(pushHistory);
    const newTrack: Track = {
      id: crypto.randomUUID(),
      name: type === "video" ? "视频轨道" : type === "audio" ? "音频轨道" : "文字轨道",
      type, clips: [], locked: false, muted: false,
    };
    set((s) => ({ project: { ...s.project, tracks: [...s.project.tracks, newTrack] } }));
  },

  removeTrack: (trackId) => {
    set(pushHistory);
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.length > 1
          ? s.project.tracks.filter((t) => t.id !== trackId)
          : s.project.tracks,
      },
    }));
  },

  moveTrack: (fromIndex, toIndex) => {
    set(pushHistory);
    set((s) => {
      const tracks = [...s.project.tracks];
      const [moved] = tracks.splice(fromIndex, 1);
      tracks.splice(toIndex, 0, moved);
      return { project: { ...s.project, tracks } };
    });
  },

  setProjectName: (name) =>
    set((s) => ({ project: { ...s.project, name } })),

  addMedia: async (file: File) => {
    const url = URL.createObjectURL(file);
    let duration = 0;
    let width: number | undefined;
    let height: number | undefined;
    let waveform: number[] | undefined;

    if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
      duration = await getMediaDuration(url);
    }
    if (file.type.startsWith("video/") || file.type.startsWith("image/")) {
      const dims = await getMediaDimensions(url, file.type);
      width = dims.width;
      height = dims.height;
    }

    const mediaType = file.type.startsWith("video/")
      ? "video" : file.type.startsWith("audio/") ? "audio" : "image";
    if (mediaType === "image" && duration === 0) duration = 5;
    if (duration === 0) duration = 10;

    const mediaItem: MediaItem = {
      id: crypto.randomUUID(), name: file.name, type: mediaType,
      url, file, duration, width, height, waveform,
    };

    set((s) => {
      const hist = pushHistory(s);
      return {
        ...hist,
        project: {
          ...s.project,
          mediaItems: [...s.project.mediaItems, mediaItem],
          duration: Math.max(s.project.duration,
            ...s.project.tracks.flatMap((t) => t.clips).map((c) => c.start + c.duration)),
        },
      };
    });
    return mediaItem;
  },

  removeMedia: (id) => {
    set(pushHistory);
    set((s) => {
      const item = s.project.mediaItems.find((m) => m.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return {
        project: {
          ...s.project, mediaItems: s.project.mediaItems.filter((m) => m.id !== id),
          tracks: s.project.tracks.map((t) => ({
            ...t, clips: t.clips.filter((c) => c.mediaId !== id),
          })),
        },
      };
    });
  },

  addClip: (mediaId, trackIndex, start) => {
    set(pushHistory);
    const media = get().project.mediaItems.find((m) => m.id === mediaId);
    if (!media) return;
    const clip: Clip = {
      id: crypto.randomUUID(), mediaId, name: media.name, type: media.type,
      start, duration: media.duration, mediaOffset: 0, trackIndex, color: nextClipColor(),
    };
    set((s) => {
      const tracks = s.project.tracks.map((t, i) =>
        i === trackIndex
          ? { ...t, clips: [...t.clips, clip].sort((a, b) => a.start - b.start) }
          : t);
      const maxEnd = Math.max(...tracks.flatMap((t) => t.clips).map((c) => c.start + c.duration));
      return { project: { ...s.project, tracks, duration: maxEnd } };
    });
  },

  moveClip: (clipId, newTrackIndex, newStart) => {
    set(pushHistory);
    set((s) => {
      const tracks = s.project.tracks.map((t) => ({
        ...t, clips: t.clips.filter((c) => c.id !== clipId),
      }));
      for (const t of s.project.tracks) {
        const clip = t.clips.find((c) => c.id === clipId);
        if (clip) {
          const updated = { ...clip, trackIndex: newTrackIndex, start: Math.max(0, newStart) };
          tracks[newTrackIndex] = {
            ...tracks[newTrackIndex],
            clips: [...tracks[newTrackIndex].clips, updated].sort((a, b) => a.start - b.start),
          };
          break;
        }
      }
      const maxEnd = Math.max(...tracks.flatMap((t) => t.clips).map((c) => c.start + c.duration));
      return { project: { ...s.project, tracks, duration: maxEnd } };
    });
  },

  removeClip: (clipId) => {
    set(pushHistory);
    set((s) => {
      // Find the deleted clip to know its position
      const deleted = s.project.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
      // Remove clip from tracks
      const tracks = s.project.tracks.map((t) => ({
        ...t, clips: t.clips.filter((c) => c.id !== clipId),
      }));
      // Check if current time falls in a gap after deletion
      const hasContent = tracks.some((t) => t.clips.some((c) => c.start <= s.currentTime && c.start + c.duration > s.currentTime));
      // If deleted clip was playing, pause
      const wasPlaying = deleted && s.currentTime >= deleted.start && s.currentTime < deleted.start + deleted.duration;
      return {
        project: { ...s.project, tracks },
        isPlaying: wasPlaying ? false : s.isPlaying,
        selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
      };
    });
  },

  splitClip: (clipId, atTime) => {
    set(pushHistory);
    set((s) => {
      const tracks = s.project.tracks.map((t) => {
        const idx = t.clips.findIndex((c) => c.id === clipId);
        if (idx === -1) return t;
        const clip = t.clips[idx];
        const splitPoint = atTime - clip.start;
        if (splitPoint <= 0 || splitPoint >= clip.duration) return t;
        const newClips = [...t.clips];
        newClips.splice(idx, 1,
          { ...clip, id: crypto.randomUUID(), duration: splitPoint },
          { ...clip, id: crypto.randomUUID(), start: atTime, duration: clip.duration - splitPoint, mediaOffset: splitPoint },
        );
        return { ...t, clips: newClips.sort((a, b) => a.start - b.start) };
      });
      return { project: { ...s.project, tracks } };
    });
  },

  trimClip: (clipId, newStart, newDuration) => {
    set(pushHistory);
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId
              ? { ...c, start: Math.max(0, newStart), duration: Math.max(0.5, newDuration) }
              : c),
        })),
      },
    }));
  },
}));

function getMediaDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => { resolve(video.duration || 0); video.remove(); };
    video.onerror = () => { resolve(0); video.remove(); };
    video.src = url;
  });
}

function getMediaDimensions(url: string, mimeType: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (mimeType.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => { resolve({ width: video.videoWidth, height: video.videoHeight }); video.remove(); };
      video.onerror = () => resolve({ width: 0, height: 0 });
      video.src = url;
    } else {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = url;
    }
  });
}
