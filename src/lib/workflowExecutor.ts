import type { Edge, Node } from "reactflow";
import { useEditorStore } from "../stores/editor-store";
import type { WorkflowNodeData } from "../stores/workflowStore";
import { VideoDecoder } from "./videoDecoder";
import { exportAndDownload } from "./videoExporter";

export interface WorkflowContext {
  hasVideo: boolean;
  videoFileName?: string;
  simulatedAudioTracks: string[];
}

export interface WorkflowExecutorOptions {
  pickVideoFile?: () => Promise<File | null>;
  promptNarration?: (hint?: string) => Promise<string | null>;
  onLog?: (message: string) => void;
  onNodeStatus?: (
    nodeId: string,
    status: WorkflowNodeData["status"],
    message?: string
  ) => void;
}

export interface WorkflowExecutionResult {
  success: boolean;
  message: string;
  context: WorkflowContext;
}

function topologicalOrder(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[]
): string[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    adj.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue = [...nodeIds].filter((id) => (inDegree.get(id) ?? 0) === 0);
  const result: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(id);
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  if (result.length !== nodeIds.size) {
    throw new Error("工作流存在循环依赖，无法执行。");
  }

  return result;
}

async function loadVideoFile(file: File): Promise<void> {
  const decoder = await VideoDecoder.create(file);
  const duration = decoder.getDuration();
  const resolvedDuration = duration > 0 ? duration : 60;
  const src = URL.createObjectURL(file);
  decoder.dispose();

  const store = useEditorStore.getState();
  store.setVideoFile(file, src);
  store.setDuration(resolvedDuration);
  store.initializeClips(resolvedDuration, src);
  store.setCurrentTime(0);
  store.setIsPlaying(false);
}

async function executeNode(
  node: Node<WorkflowNodeData>,
  ctx: WorkflowContext,
  options: WorkflowExecutorOptions
): Promise<void> {
  const store = useEditorStore.getState();
  const log = (msg: string) => options.onLog?.(msg);
  const { data } = node;

  switch (data.nodeType) {
    case "import-video": {
      if (store.videoFile) {
        ctx.hasVideo = true;
        ctx.videoFileName = store.videoFile.name;
        log(`导入视频：复用已加载文件「${store.videoFile.name}」`);
        return;
      }

      const file = await options.pickVideoFile?.();
      if (!file) throw new Error("未选择视频文件");

      await loadVideoFile(file);
      ctx.hasVideo = true;
      ctx.videoFileName = file.name;
      log(`导入视频：已加载「${file.name}」`);
      return;
    }

    case "trim": {
      if (!ctx.hasVideo && !store.videoFile) {
        throw new Error("裁剪失败：请先导入视频");
      }
      const ok = store.applyTrimRange(data.start, data.end);
      if (!ok) throw new Error("裁剪失败：无有效片段");
      log(`裁剪：${data.start}s → ${data.end}s`);
      return;
    }

    case "split": {
      if (!store.videoFile || store.clips.length === 0) {
        throw new Error("分割失败：请先导入视频");
      }
      const splitAt =
        data.splitAt > 0
          ? data.splitAt
          : (store.trimStart + store.trimEnd) / 2;
      store.setCurrentTime(splitAt);
      const ok = store.splitAtPlayhead();
      if (!ok) throw new Error(`分割失败：${splitAt.toFixed(2)}s 不在片段内部`);
      log(`分割：在 ${splitAt.toFixed(2)}s 处切开`);
      return;
    }

    case "ai-narration": {
      let text = data.narrationText?.trim() ?? "";
      if (!text) {
        text = (await options.promptNarration?.("请输入 AI 解说文本"))?.trim() ?? "";
      }
      if (!text) throw new Error("AI 解说已取消：未提供文本");

      store.addPendingSubtitle(`[解说] ${text}`);
      await new Promise((r) => setTimeout(r, 600));
      const trackId = `audio-sim-${Date.now()}`;
      ctx.simulatedAudioTracks.push(trackId);
      log(`AI 解说：已生成模拟音频轨道（${text.slice(0, 20)}…）`);
      return;
    }

    case "export": {
      if (!store.videoFile || store.clips.length === 0) {
        throw new Error("导出失败：没有可导出的片段");
      }
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
        filename: `zhiying-workflow-${store.videoFile.name.replace(/\.\w+$/, "")}.mp4`,
        transitions: store.transitions.map((t) => ({
          id: t.id,
          fromClipId: t.fromClipId,
          toClipId: t.toClipId,
          type: t.type,
          duration: t.duration,
        })),
      });
      log(`导出完成（${result.method === "webcodecs" ? "WebCodecs" : "FFmpeg"}）`);
      return;
    }

    default:
      throw new Error(`未知节点类型：${String(data.nodeType)}`);
  }
}

export async function executeWorkflow(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  options: WorkflowExecutorOptions = {}
): Promise<WorkflowExecutionResult> {
  const order = topologicalOrder(nodes, edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const ctx: WorkflowContext = {
    hasVideo: false,
    simulatedAudioTracks: [],
  };

  options.onLog?.("开始执行工作流…");

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    options.onNodeStatus?.(nodeId, "running", "执行中…");
    options.onLog?.(`▶ ${node.data.label}`);

    try {
      await executeNode(node, ctx, options);
      options.onNodeStatus?.(nodeId, "success", "完成");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "执行失败";
      options.onNodeStatus?.(nodeId, "error", msg);
      options.onLog?.(`✖ ${node.data.label}：${msg}`);
      return { success: false, message: msg, context: ctx };
    }
  }

  options.onLog?.("工作流执行完成。");
  return { success: true, message: "工作流执行成功", context: ctx };
}
