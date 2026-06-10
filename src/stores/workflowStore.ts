import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "reactflow";

export type WorkflowNodeType =
  | "import-video"
  | "trim"
  | "split"
  | "ai-narration"
  | "export";

export type WorkflowNodeStatus = "idle" | "running" | "success" | "error";

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: WorkflowNodeType;
  start: number;
  end: number;
  splitAt: number;
  narrationText: string;
  status: WorkflowNodeStatus;
  statusMessage: string;
}

export interface WorkflowSnapshot {
  version: 1;
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
}

const STORAGE_KEY = "zhiying-workflow";

const NODE_META: Record<
  WorkflowNodeType,
  { label: string; start?: number; end?: number }
> = {
  "import-video": { label: "导入视频" },
  trim: { label: "裁剪", start: 0, end: 10 },
  split: { label: "分割", start: 0, end: 0 },
  "ai-narration": { label: "AI 解说" },
  export: { label: "导出" },
};

let nodeSeq = 1;
const nextNodeId = (type: WorkflowNodeType) =>
  `${type}-${nodeSeq++}-${Date.now()}`;

export function createWorkflowNode(
  type: WorkflowNodeType,
  position: { x: number; y: number }
): Node<WorkflowNodeData> {
  const meta = NODE_META[type];
  return {
    id: nextNodeId(type),
    type: "workflow",
    position,
    data: {
      label: meta.label,
      nodeType: type,
      start: meta.start ?? 0,
      end: meta.end ?? 10,
      splitAt: 5,
      narrationText: "",
      status: "idle",
      statusMessage: "",
    },
  };
}

export const DEFAULT_WORKFLOW_NODES: Node<WorkflowNodeData>[] = [
  createWorkflowNode("import-video", { x: 40, y: 120 }),
  createWorkflowNode("trim", { x: 280, y: 120 }),
  createWorkflowNode("split", { x: 520, y: 120 }),
  createWorkflowNode("ai-narration", { x: 760, y: 120 }),
  createWorkflowNode("export", { x: 1000, y: 120 }),
];

function buildDefaultEdges(nodes: Node<WorkflowNodeData>[]): Edge[] {
  const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x);
  const edges: Edge[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    edges.push({
      id: `e-${sorted[i].id}-${sorted[i + 1].id}`,
      source: sorted[i].id,
      target: sorted[i + 1].id,
    });
  }
  return edges;
}

export interface WorkflowState {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  isRunning: boolean;
  runLog: string[];

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: Node<WorkflowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (type: WorkflowNodeType) => void;
  updateNodeData: (
    nodeId: string,
    patch: Partial<WorkflowNodeData>
  ) => void;
  setNodeStatus: (
    nodeId: string,
    status: WorkflowNodeStatus,
    message?: string
  ) => void;
  resetAllStatus: () => void;
  appendLog: (line: string) => void;
  clearLog: () => void;
  setIsRunning: (running: boolean) => void;
  resetToDefault: () => void;
  toSnapshot: () => WorkflowSnapshot;
  loadSnapshot: (snapshot: WorkflowSnapshot) => void;
  saveToStorage: () => void;
  loadFromStorage: () => boolean;
  exportJson: () => string;
  importJson: (json: string) => boolean;
}

export const useWorkflowStore = create<WorkflowState>()((set, get) => ({
  nodes: DEFAULT_WORKFLOW_NODES,
  edges: buildDefaultEdges(DEFAULT_WORKFLOW_NODES),
  isRunning: false,
  runLog: [],

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: (connection) =>
    set((s) => ({
      edges: addEdge(
        { ...connection, id: `e-${connection.source}-${connection.target}` },
        s.edges
      ),
    })),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (type) => {
    const { nodes } = get();
    const maxX = nodes.reduce((m, n) => Math.max(m, n.position.x), 0);
    set({ nodes: [...nodes, createWorkflowNode(type, { x: maxX + 220, y: 120 })] });
  },

  updateNodeData: (nodeId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
      ),
    })),

  setNodeStatus: (nodeId, status, message = "") =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, status, statusMessage: message } }
          : n
      ),
    })),

  resetAllStatus: () =>
    set((s) => ({
      nodes: s.nodes.map((n) => ({
        ...n,
        data: { ...n.data, status: "idle" as const, statusMessage: "" },
      })),
    })),

  appendLog: (line) => set((s) => ({ runLog: [...s.runLog, line] })),
  clearLog: () => set({ runLog: [] }),
  setIsRunning: (running) => set({ isRunning: running }),

  resetToDefault: () => {
    const nodes = DEFAULT_WORKFLOW_NODES.map((n) => ({
      ...n,
      data: { ...n.data, status: "idle" as const, statusMessage: "" },
    }));
    set({ nodes, edges: buildDefaultEdges(nodes), runLog: [] });
  },

  toSnapshot: () => ({
    version: 1,
    nodes: get().nodes,
    edges: get().edges,
  }),

  loadSnapshot: (snapshot) => {
    if (snapshot.version !== 1) return;
    set({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      runLog: [],
    });
  },

  saveToStorage: () => {
    localStorage.setItem(STORAGE_KEY, get().exportJson());
  },

  loadFromStorage: () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return get().importJson(raw);
  },

  exportJson: () => JSON.stringify(get().toSnapshot(), null, 2),

  importJson: (json) => {
    try {
      const snapshot = JSON.parse(json) as WorkflowSnapshot;
      if (!snapshot.nodes || !snapshot.edges) return false;
      get().loadSnapshot({
        version: 1,
        nodes: snapshot.nodes,
        edges: snapshot.edges,
      });
      return true;
    } catch {
      return false;
    }
  },
}));
