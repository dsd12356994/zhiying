import { useEffect } from "react";
import { useProjectStore } from "../stores/project-store";
import { useEditorStore } from "../stores/editor-store";
import { matchesShortcut, type ShortcutAction } from "../lib/keyboard-shortcuts";

function shouldIgnoreEvent(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const SEEK_SMALL_SEC = 1 / 30;
    const SEEK_LARGE_SEC = 1;
    const SHUTTLE_STEPS = [1, 2, 4];
    const SHUTTLE_MAX = 4;
    const nextShuttleRate = (current: number, direction: 1 | -1): number => {
      const abs = Math.abs(current);
      const currentIndex = SHUTTLE_STEPS.findIndex((s) => Math.abs(s - abs) < 0.001);
      const nextAbs =
        currentIndex >= 0
          ? SHUTTLE_STEPS[Math.min(SHUTTLE_STEPS.length - 1, currentIndex + 1)]
          : SHUTTLE_STEPS[0];
      return direction * nextAbs;
    };
    const emitShuttleFeedback = (label: string) => {
      window.dispatchEvent(
        new CustomEvent("zhiying-shuttle-feedback", {
          detail: { label, at: Date.now() },
        })
      );
    };
    const clampToTrimRange = (time: number) => {
      const store = useEditorStore.getState();
      const start = Math.max(0, Math.min(store.trimStart, store.duration));
      const end = Math.max(start, Math.min(store.trimEnd, store.duration));
      return Math.max(start, Math.min(end, time));
    };

    const runAction = (action: ShortcutAction) => {
      const editorStore = useEditorStore.getState();
      const projectStore = useProjectStore.getState();
      switch (action) {
        case "togglePlay":
          if (editorStore.videoFile) {
            editorStore.togglePlaying();
          } else if (typeof projectStore.setIsPlaying === "function") {
            projectStore.setIsPlaying(!projectStore.isPlaying);
          }
          break;
        case "splitAtPlayhead":
          if (projectStore.selectedClipId) {
            projectStore.splitClip(projectStore.selectedClipId, projectStore.currentTime);
          } else {
            editorStore.splitAtPlayhead();
          }
          break;
        case "deleteSelectedClip":
          if (projectStore.selectedClipId) {
            projectStore.removeClip(projectStore.selectedClipId);
            projectStore.setSelectedClip(null);
          } else if (editorStore.selectedClipId) {
            editorStore.removeClip(editorStore.selectedClipId);
          }
          break;
        case "addMarkerAtPlayhead":
          editorStore.addMarker(editorStore.currentTime);
          break;
        case "removeNearestMarker":
          editorStore.removeNearestMarker(editorStore.currentTime, 0.2);
          break;
        case "seekBackwardSmall":
          editorStore.setCurrentTime(clampToTrimRange(editorStore.currentTime - SEEK_SMALL_SEC));
          break;
        case "seekForwardSmall":
          editorStore.setCurrentTime(clampToTrimRange(editorStore.currentTime + SEEK_SMALL_SEC));
          break;
        case "seekBackwardLarge":
          editorStore.setCurrentTime(clampToTrimRange(editorStore.currentTime - SEEK_LARGE_SEC));
          break;
        case "seekForwardLarge":
          editorStore.setCurrentTime(clampToTrimRange(editorStore.currentTime + SEEK_LARGE_SEC));
          break;
        case "seekToStart":
          {
            const store = useEditorStore.getState();
            editorStore.setCurrentTime(Math.max(0, Math.min(store.trimStart, store.duration)));
          }
          break;
        case "seekToEnd":
          {
            const store = useEditorStore.getState();
            const start = Math.max(0, Math.min(store.trimStart, store.duration));
            const end = Math.max(start, Math.min(store.trimEnd, store.duration));
            editorStore.setCurrentTime(end);
          }
          break;
        case "shuttleBackward":
          {
            const store = useEditorStore.getState();
            if (!store.videoFile) break;
            store.setCurrentTime(clampToTrimRange(store.currentTime));
            const rate =
              store.isPlaying && store.playbackRate < 0
                ? nextShuttleRate(store.playbackRate, -1)
                : -1;
            store.setPlaybackRate(rate);
            store.play();
            emitShuttleFeedback(`JKL ${Math.abs(rate)}x 反向`);
          }
          break;
        case "shuttlePause":
          editorStore.pause();
          editorStore.setPlaybackRate(1);
          emitShuttleFeedback("JKL 暂停");
          if (typeof projectStore.setIsPlaying === "function") {
            projectStore.setIsPlaying(false);
          }
          break;
        case "shuttleForward":
          {
            const store = useEditorStore.getState();
            if (store.videoFile) {
              store.setCurrentTime(clampToTrimRange(store.currentTime));
              const rate =
                store.isPlaying && store.playbackRate > 0
                  ? nextShuttleRate(store.playbackRate, 1)
                  : 1;
              store.setPlaybackRate(rate);
              store.play();
              emitShuttleFeedback(`JKL ${Math.abs(rate)}x`);
            } else if (typeof projectStore.setIsPlaying === "function") {
              projectStore.setIsPlaying(true);
            }
          }
          break;
        case "shuttleBackwardMax":
          {
            const store = useEditorStore.getState();
            if (!store.videoFile) break;
            store.setCurrentTime(clampToTrimRange(store.currentTime));
            store.setPlaybackRate(-SHUTTLE_MAX);
            store.play();
            emitShuttleFeedback(`JKL ${SHUTTLE_MAX}x 反向`);
          }
          break;
        case "shuttleForwardMax":
          {
            const store = useEditorStore.getState();
            if (!store.videoFile) break;
            store.setCurrentTime(clampToTrimRange(store.currentTime));
            store.setPlaybackRate(SHUTTLE_MAX);
            store.play();
            emitShuttleFeedback(`JKL ${SHUTTLE_MAX}x`);
          }
          break;
        case "toggleTimeDisplayMode":
          editorStore.toggleTimeDisplayMode();
          break;
        case "undo":
          if (projectStore.canUndo) {
            projectStore.undo();
          } else if (editorStore.canUndo) {
            editorStore.undo();
          }
          break;
        case "redo":
          if (projectStore.canRedo) {
            projectStore.redo();
          } else if (editorStore.canRedo) {
            editorStore.redo();
          }
          break;
        case "zoomInTimeline":
          editorStore.setZoom(editorStore.zoom + 0.2);
          break;
        case "zoomOutTimeline":
          editorStore.setZoom(editorStore.zoom - 0.2);
          break;
        case "saveProject":
          // Reserved for future persistent save action.
          break;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreEvent(event.target)) return;

      const actions: ShortcutAction[] = [
        "togglePlay",
        "splitAtPlayhead",
        "deleteSelectedClip",
        "addMarkerAtPlayhead",
        "removeNearestMarker",
        "seekBackwardSmall",
        "seekForwardSmall",
        "seekBackwardLarge",
        "seekForwardLarge",
        "seekToStart",
        "seekToEnd",
        "shuttleBackward",
        "shuttlePause",
        "shuttleForward",
        "shuttleBackwardMax",
        "shuttleForwardMax",
        "toggleTimeDisplayMode",
        "undo",
        "redo",
        "zoomInTimeline",
        "zoomOutTimeline",
        "saveProject",
      ];

      for (const action of actions) {
        if (matchesShortcut(event, action)) {
          event.preventDefault();
          runAction(action);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

