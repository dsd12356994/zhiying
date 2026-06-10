import { useEditorStore } from "../stores/editor-store";
import { exportAndDownload } from "./videoExporter";

export type CommandType =
  | "trim_to"
  | "trim_last"
  | "split"
  | "export"
  | "subtitle"
  | "unknown";

export interface ParsedCommand {
  type: CommandType;
  seconds?: number;
  text?: string;
  raw: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
}

const TRIM_TO_PATTERNS = [
  /裁剪到\s*(\d+(?:\.\d+)?)\s*秒/i,
  /裁到\s*(\d+(?:\.\d+)?)\s*秒/i,
  /trim\s+to\s*(\d+(?:\.\d+)?)\s*(?:seconds?|s|sec)?/i,
  /cut\s+to\s*(\d+(?:\.\d+)?)\s*(?:seconds?|s|sec)?/i,
];

const TRIM_LAST_PATTERNS = [
  /删除最后\s*(\d+(?:\.\d+)?)\s*秒/i,
  /去掉最后\s*(\d+(?:\.\d+)?)\s*秒/i,
  /remove(?:\s+the)?\s+last\s*(\d+(?:\.\d+)?)\s*(?:seconds?|s|sec)?/i,
  /delete(?:\s+the)?\s+last\s*(\d+(?:\.\d+)?)\s*(?:seconds?|s|sec)?/i,
];

const SPLIT_PATTERNS = [
  /^分割$/i,
  /^切分$/i,
  /^split$/i,
  /在.*分割/,
  /split\s+at\s+playhead/i,
];

const EXPORT_PATTERNS = [
  /导出视频/i,
  /导出/i,
  /export\s+video/i,
  /^export$/i,
];

const SUBTITLE_PATTERNS = [
  /添加字幕\s*[「『"'](.+?)[」』"']/i,
  /添加字幕\s+(.+)/i,
  /add\s+subtitle\s*[「『"'](.+?)[」』"']/i,
  /add\s+subtitle\s+(.+)/i,
];

function matchPatterns(
  input: string,
  patterns: RegExp[]
): RegExpMatchArray | null {
  const trimmed = input.trim();
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match;
  }
  return null;
}

export function parseCommand(input: string): ParsedCommand {
  const raw = input.trim();
  if (!raw) return { type: "unknown", raw };

  const trimTo = matchPatterns(raw, TRIM_TO_PATTERNS);
  if (trimTo?.[1]) {
    return { type: "trim_to", seconds: parseFloat(trimTo[1]), raw };
  }

  const trimLast = matchPatterns(raw, TRIM_LAST_PATTERNS);
  if (trimLast?.[1]) {
    return { type: "trim_last", seconds: parseFloat(trimLast[1]), raw };
  }

  if (matchPatterns(raw, SPLIT_PATTERNS)) {
    return { type: "split", raw };
  }

  if (matchPatterns(raw, EXPORT_PATTERNS)) {
    return { type: "export", raw };
  }

  const subtitle = matchPatterns(raw, SUBTITLE_PATTERNS);
  if (subtitle?.[1]) {
    return { type: "subtitle", text: subtitle[1].trim(), raw };
  }

  return { type: "unknown", raw };
}

export async function executeCommand(
  command: ParsedCommand
): Promise<CommandResult> {
  const store = useEditorStore.getState();

  switch (command.type) {
    case "trim_to": {
      if (command.seconds === undefined || Number.isNaN(command.seconds)) {
        return { success: false, message: "❌ 无法识别裁剪时长。" };
      }
      if (!store.videoFile || store.clips.length === 0) {
        return { success: false, message: "❌ 请先导入视频后再裁剪。" };
      }
      const ok = store.trimTo(command.seconds);
      return ok
        ? {
            success: true,
            message: `✅ 已裁剪到 ${command.seconds} 秒（已更新 trimEnd 与当前片段）。`,
          }
        : {
            success: false,
            message: `❌ 裁剪失败：目标时间 ${command.seconds}s 超出有效范围。`,
          };
    }

    case "trim_last": {
      if (command.seconds === undefined || Number.isNaN(command.seconds)) {
        return { success: false, message: "❌ 无法识别删除时长。" };
      }
      if (!store.videoFile || store.clips.length === 0) {
        return { success: false, message: "❌ 请先导入视频。" };
      }
      const ok = store.trimLast(command.seconds);
      return ok
        ? {
            success: true,
            message: `✅ 已删除当前片段最后 ${command.seconds} 秒。`,
          }
        : {
            success: false,
            message: `❌ 无法删除最后 ${command.seconds} 秒（片段过短或参数无效）。`,
          };
    }

    case "split": {
      if (!store.videoFile || store.clips.length === 0) {
        return { success: false, message: "❌ 请先导入视频后再分割。" };
      }
      const ok = store.splitAtPlayhead();
      return ok
        ? {
            success: true,
            message: `✅ 已在播放头（${store.currentTime.toFixed(2)}s）处分割片段。`,
          }
        : {
            success: false,
            message:
              "❌ 分割失败：请将播放头移到片段内部（避开首尾 0.05s）。",
          };
    }

    case "export": {
      if (!store.videoFile || store.clips.length === 0) {
        return { success: false, message: "❌ 没有可导出的片段，请先导入视频。" };
      }
      try {
        const inputs = store.clips.map((clip) => ({
          id: clip.id,
          type: clip.type,
          src: clip.src,
          start: clip.start,
          end: clip.end,
          sourceStart: clip.sourceStart,
          sourceEnd: clip.sourceEnd,
          speed: clip.speed,
          filter: clip.filter,
          content: clip.content,
          fontSize: clip.fontSize,
          fontFamily: clip.fontFamily,
          color: clip.color,
          stroke: clip.stroke,
          shadow: clip.shadow,
          position: clip.position,
          animation: clip.animation,
          keyframes: clip.keyframes,
          file: store.videoFile!,
        }));
        const result = await exportAndDownload(inputs, {
          filename: `zhiying-${store.videoFile.name.replace(/\.\w+$/, "")}-export.mp4`,
          transitions: store.transitions.map((t) => ({
            id: t.id,
            fromClipId: t.fromClipId,
            toClipId: t.toClipId,
            type: t.type,
            duration: t.duration,
          })),
        });
        return {
          success: true,
          message: `✅ 导出成功（${result.method === "webcodecs" ? "WebCodecs" : "FFmpeg"}），文件已开始下载。`,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "未知错误";
        return { success: false, message: `❌ 导出失败：${msg}` };
      }
    }

    case "subtitle": {
      if (!command.text) {
        return { success: false, message: "❌ 请提供字幕文本。" };
      }
      store.addPendingSubtitle(command.text);
      const count = useEditorStore.getState().pendingSubtitles.length;
      return {
        success: true,
        message: `✅ 字幕「${command.text}」已暂存（共 ${count} 条，渲染功能后续实现）。`,
      };
    }

    default:
      return {
        success: false,
        message:
          "❓ 未识别命令。支持：裁剪到 X 秒、删除最后 Y 秒、分割、导出视频、添加字幕 [文本]",
      };
  }
}

export async function parseAndExecute(input: string): Promise<CommandResult> {
  const command = parseCommand(input);
  if (command.type === "unknown") {
    return {
      success: false,
      message:
        "❓ 未识别命令。支持：裁剪到 X 秒、删除最后 Y 秒、分割、导出视频、添加字幕 [文本]",
    };
  }
  return executeCommand(command);
}
