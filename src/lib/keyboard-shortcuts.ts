export type ShortcutAction =
  | "togglePlay"
  | "splitAtPlayhead"
  | "deleteSelectedClip"
  | "addMarkerAtPlayhead"
  | "removeNearestMarker"
  | "seekBackwardSmall"
  | "seekForwardSmall"
  | "seekBackwardLarge"
  | "seekForwardLarge"
  | "seekToStart"
  | "seekToEnd"
  | "shuttleBackward"
  | "shuttlePause"
  | "shuttleForward"
  | "shuttleBackwardMax"
  | "shuttleForwardMax"
  | "toggleTimeDisplayMode"
  | "undo"
  | "redo"
  | "zoomInTimeline"
  | "zoomOutTimeline"
  | "saveProject";

export interface ShortcutDef {
  id: ShortcutAction;
  label: string;
  keys: string[];
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: "togglePlay", label: "播放/暂停", keys: ["Space"] },
  { id: "splitAtPlayhead", label: "分割", keys: ["Ctrl+B", "Cmd+B"] },
  { id: "deleteSelectedClip", label: "删除选中片段", keys: ["Delete", "Backspace"] },
  { id: "addMarkerAtPlayhead", label: "添加标记点", keys: ["M"] },
  { id: "removeNearestMarker", label: "删除最近标记点", keys: ["Shift+M"] },
  { id: "seekBackwardSmall", label: "后退一小步", keys: ["Left"] },
  { id: "seekForwardSmall", label: "前进一小步", keys: ["Right"] },
  { id: "seekBackwardLarge", label: "后退一大步", keys: ["Shift+Left"] },
  { id: "seekForwardLarge", label: "前进一大步", keys: ["Shift+Right"] },
  { id: "seekToStart", label: "跳转到开头", keys: ["Home"] },
  { id: "seekToEnd", label: "跳转到末尾", keys: ["End"] },
  { id: "shuttleBackward", label: "JKL 倒退预览", keys: ["J"] },
  { id: "shuttlePause", label: "JKL 暂停", keys: ["K"] },
  { id: "shuttleForward", label: "JKL 播放", keys: ["L"] },
  { id: "shuttleBackwardMax", label: "JKL 倒退最大档", keys: ["Shift+J"] },
  { id: "shuttleForwardMax", label: "JKL 正放最大档", keys: ["Shift+L"] },
  { id: "toggleTimeDisplayMode", label: "切换时间显示格式", keys: ["Shift+T"] },
  { id: "undo", label: "撤销", keys: ["Ctrl+Z", "Cmd+Z"] },
  { id: "redo", label: "重做", keys: ["Ctrl+Shift+Z", "Cmd+Shift+Z"] },
  { id: "zoomInTimeline", label: "时间轴放大", keys: ["Ctrl++", "Cmd++"] },
  { id: "zoomOutTimeline", label: "时间轴缩小", keys: ["Ctrl+-", "Cmd+-"] },
  { id: "saveProject", label: "保存", keys: ["Ctrl+S", "Cmd+S"] },
];

export function matchesShortcut(
  event: KeyboardEvent,
  action: ShortcutAction
): boolean {
  const key = event.key.toLowerCase();
  const ctrlOrCmd = event.ctrlKey || event.metaKey;

  switch (action) {
    case "togglePlay":
      return key === " " || event.code === "Space";
    case "splitAtPlayhead":
      return ctrlOrCmd && key === "b";
    case "deleteSelectedClip":
      return key === "delete" || key === "backspace";
    case "addMarkerAtPlayhead":
      return key === "m" && !event.shiftKey && !ctrlOrCmd && !event.altKey;
    case "removeNearestMarker":
      return key === "m" && event.shiftKey && !ctrlOrCmd && !event.altKey;
    case "seekBackwardSmall":
      return event.key === "ArrowLeft" && !event.shiftKey && !ctrlOrCmd && !event.altKey;
    case "seekForwardSmall":
      return event.key === "ArrowRight" && !event.shiftKey && !ctrlOrCmd && !event.altKey;
    case "seekBackwardLarge":
      return event.key === "ArrowLeft" && event.shiftKey && !ctrlOrCmd && !event.altKey;
    case "seekForwardLarge":
      return event.key === "ArrowRight" && event.shiftKey && !ctrlOrCmd && !event.altKey;
    case "seekToStart":
      return key === "home";
    case "seekToEnd":
      return key === "end";
    case "shuttleBackward":
      return key === "j" && !event.shiftKey && !ctrlOrCmd && !event.altKey;
    case "shuttlePause":
      return key === "k" && !event.shiftKey && !ctrlOrCmd && !event.altKey;
    case "shuttleForward":
      return key === "l" && !event.shiftKey && !ctrlOrCmd && !event.altKey;
    case "shuttleBackwardMax":
      return key === "j" && event.shiftKey && !ctrlOrCmd && !event.altKey;
    case "shuttleForwardMax":
      return key === "l" && event.shiftKey && !ctrlOrCmd && !event.altKey;
    case "toggleTimeDisplayMode":
      return key === "t" && event.shiftKey && !ctrlOrCmd && !event.altKey;
    case "undo":
      return ctrlOrCmd && key === "z" && !event.shiftKey;
    case "redo":
      return ctrlOrCmd && key === "z" && event.shiftKey;
    case "zoomInTimeline":
      return ctrlOrCmd && (key === "=" || key === "+");
    case "zoomOutTimeline":
      return ctrlOrCmd && (key === "-" || key === "_");
    case "saveProject":
      return ctrlOrCmd && key === "s";
    default:
      return false;
  }
}

