import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Play,
  Save,
  FolderOpen,
  Plus,
  X,
  Film,
  Scissors,
  Split,
  Mic,
  Download,
} from "lucide-react";
import { useEditorStore } from "../../stores/editor-store";
import {
  useWorkflowStore,
  createWorkflowNode,
  type WorkflowNodeData,
  type WorkflowNodeType,
} from "../../stores/workflowStore";
import { executeWorkflow } from "../../lib/workflowExecutor";

const PALETTE: { type: WorkflowNodeType; icon: React.ReactNode }[] = [
  { type: "import-video", icon: <Film size={14} /> },
  { type: "trim", icon: <Scissors size={14} /> },
  { type: "split", icon: <Split size={14} /> },
  { type: "ai-narration", icon: <Mic size={14} /> },
  { type: "export", icon: <Download size={14} /> },
];

const STATUS_COLOR: Record<WorkflowNodeData["status"], string> = {
  idle: "var(--text-secondary)",
  running: "var(--accent)",
  success: "color-mix(in srgb, var(--accent) 60%, var(--text-primary))",
  error: "#e74c3c",
};

function WorkflowNode({ id, data }: NodeProps<WorkflowNodeData>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  return (
    <div
      className="min-w-[168px] px-3 py-2 text-xs"
      style={{
        backgroundColor: "var(--bg-primary)",
        border: `1px solid ${data.status === "error" ? "#e74c3c" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        color: "var(--text-primary)",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "var(--accent)", width: 8, height: 8 }}
      />

      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium">{data.label}</span>
        <span
          className="text-[9px]"
          style={{ color: STATUS_COLOR[data.status] }}
        >
          {data.status}
        </span>
      </div>

      {data.nodeType === "trim" && (
        <div className="mt-1 flex flex-col gap-1">
          <label className="flex items-center gap-1 text-[10px]">
            start
            <input
              type="number"
              step="0.1"
              value={data.start}
              onChange={(e) =>
                updateNodeData(id, { start: Number(e.target.value) })
              }
              className="w-14 rounded px-1 py-0.5"
              style={{
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-secondary)",
              }}
            />
          </label>
          <label className="flex items-center gap-1 text-[10px]">
            end
            <input
              type="number"
              step="0.1"
              value={data.end}
              onChange={(e) =>
                updateNodeData(id, { end: Number(e.target.value) })
              }
              className="w-14 rounded px-1 py-0.5"
              style={{
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-secondary)",
              }}
            />
          </label>
        </div>
      )}

      {data.nodeType === "split" && (
        <label className="mt-1 flex items-center gap-1 text-[10px]">
          位置(s)
          <input
            type="number"
            step="0.1"
            value={data.splitAt}
            onChange={(e) =>
              updateNodeData(id, { splitAt: Number(e.target.value) })
            }
            className="w-14 rounded px-1 py-0.5"
            style={{
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg-secondary)",
            }}
          />
        </label>
      )}

      {data.nodeType === "ai-narration" && (
        <textarea
          value={data.narrationText}
          onChange={(e) =>
            updateNodeData(id, { narrationText: e.target.value })
          }
          placeholder="解说文本（可留空，运行时弹窗）"
          rows={2}
          className="mt-1 w-full resize-none rounded px-1 py-0.5 text-[10px]"
          style={{
            border: "1px solid var(--border)",
            backgroundColor: "var(--bg-secondary)",
          }}
        />
      )}

      {data.statusMessage && (
        <p
          className="mt-1 truncate text-[9px]"
          style={{ color: STATUS_COLOR[data.status] }}
          title={data.statusMessage}
        >
          {data.statusMessage}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "var(--accent)", width: 8, height: 8 }}
      />
    </div>
  );
}

export function FlowTab() {
  const { showFlowTab, toggleFlowTab } = useEditorStore();
  const {
    nodes,
    edges,
    isRunning,
    runLog,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setNodeStatus,
    resetAllStatus,
    appendLog,
    clearLog,
    setIsRunning,
    saveToStorage,
    loadFromStorage,
    exportJson,
    importJson,
    resetToDefault,
  } = useWorkflowStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const filePickResolver = useRef<((file: File | null) => void) | null>(null);
  const narrationResolver = useRef<((text: string | null) => void) | null>(null);

  const [narrationOpen, setNarrationOpen] = useState(false);
  const [narrationDraft, setNarrationDraft] = useState("");
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [loadDraft, setLoadDraft] = useState("");

  const nodeTypes = useMemo(() => ({ workflow: WorkflowNode }), []);

  useEffect(() => {
    if (showFlowTab) loadFromStorage();
  }, [showFlowTab, loadFromStorage]);

  const pickVideoFile = useCallback((): Promise<File | null> => {
    return new Promise((resolve) => {
      filePickResolver.current = resolve;
      fileInputRef.current?.click();
    });
  }, []);

  const promptNarration = useCallback((hint?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      narrationResolver.current = resolve;
      setNarrationDraft(hint ?? "");
      setNarrationOpen(true);
    });
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    filePickResolver.current?.(file);
    filePickResolver.current = null;
    e.target.value = "";
  };

  const handleNarrationConfirm = () => {
    narrationResolver.current?.(narrationDraft.trim() || null);
    narrationResolver.current = null;
    setNarrationOpen(false);
  };

  const handleNarrationCancel = () => {
    narrationResolver.current?.(null);
    narrationResolver.current = null;
    setNarrationOpen(false);
  };

  const handleRun = async () => {
    if (isRunning) return;
    clearLog();
    resetAllStatus();
    setIsRunning(true);

    try {
      const result = await executeWorkflow(nodes, edges, {
        pickVideoFile,
        promptNarration,
        onLog: appendLog,
        onNodeStatus: setNodeStatus,
      });
      appendLog(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "执行异常";
      appendLog(`❌ ${msg}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSave = () => {
    saveToStorage();
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zhiying-workflow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    appendLog("已保存工作流到本地并下载 JSON。");
  };

  const handleLoad = () => {
    setLoadDraft(exportJson());
    setLoadDialogOpen(true);
  };

  const handleApplyLoad = () => {
    const ok = importJson(loadDraft);
    appendLog(ok ? "工作流已加载。" : "加载失败：JSON 格式无效。");
    setLoadDialogOpen(false);
  };

  if (!showFlowTab) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-sm"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--text-primary) 30%, transparent)",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileInput}
      />

      <div
        className="relative flex h-[88vh] w-[92vw] flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between px-4 py-2.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            AI 工作流编辑器
          </span>
          <div className="flex items-center gap-1">
            <ToolbarBtn
              icon={<Play size={14} />}
              label={isRunning ? "运行中…" : "运行工作流"}
              onClick={() => void handleRun()}
              disabled={isRunning}
              accent
            />
            <ToolbarBtn icon={<Save size={14} />} label="保存" onClick={handleSave} />
            <ToolbarBtn
              icon={<FolderOpen size={14} />}
              label="加载"
              onClick={handleLoad}
            />
            <button
              onClick={toggleFlowTab}
              className="flow-close-btn ml-1 flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ color: "var(--text-secondary)" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Palette */}
          <aside
            className="flex w-36 shrink-0 flex-col gap-1 p-2"
            style={{ borderRight: "1px solid var(--border)" }}
          >
            <span
              className="mb-1 px-1 text-[10px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              节点库
            </span>
            {PALETTE.map(({ type, icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => addNode(type)}
                className="tool-btn flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px]"
                style={{ color: "var(--text-primary)" }}
              >
                {icon}
                {createWorkflowNode(type, { x: 0, y: 0 }).data.label}
              </button>
            ))}
            <button
              type="button"
              onClick={resetToDefault}
              className="mt-2 flex items-center gap-1 px-2 py-1 text-[10px]"
              style={{ color: "var(--text-secondary)" }}
            >
              <Plus size={10} />
              重置模板
            </button>
          </aside>

          {/* Canvas */}
          <div className="relative min-w-0 flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              nodesDraggable
              nodesConnectable
              elementsSelectable
              style={{ background: "var(--bg-secondary)" }}
            >
              <Background gap={16} color="var(--border)" />
              <Controls />
              <MiniMap
                nodeColor={() => "var(--accent)"}
                maskColor="color-mix(in srgb, var(--bg-primary) 70%, transparent)"
              />
            </ReactFlow>
          </div>

          {/* Log panel */}
          <aside
            className="flex w-52 shrink-0 flex-col"
            style={{ borderLeft: "1px solid var(--border)" }}
          >
            <div
              className="px-2 py-1.5 text-[10px] font-medium"
              style={{
                borderBottom: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              执行日志
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {runLog.length === 0 ? (
                <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  点击「运行工作流」开始执行
                </p>
              ) : (
                runLog.map((line, i) => (
                  <p
                    key={i}
                    className="mb-1 text-[10px] leading-relaxed"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {line}
                  </p>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Narration dialog */}
      {narrationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-80 p-4"
            style={{
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <h3
              className="mb-2 text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              AI 解说文本
            </h3>
            <textarea
              value={narrationDraft}
              onChange={(e) => setNarrationDraft(e.target.value)}
              rows={4}
              className="w-full resize-none rounded px-2 py-1.5 text-xs"
              style={{
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
              }}
              placeholder="输入解说文案…"
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleNarrationCancel}
                className="rounded px-3 py-1 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleNarrationConfirm}
                className="rounded px-3 py-1 text-xs"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-fg)",
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load JSON dialog */}
      {loadDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="flex h-[60vh] w-[50vw] flex-col p-4"
            style={{
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <h3
              className="mb-2 text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              加载工作流 JSON
            </h3>
            <textarea
              value={loadDraft}
              onChange={(e) => setLoadDraft(e.target.value)}
              className="min-h-0 flex-1 resize-none rounded px-2 py-1.5 font-mono text-[10px]"
              style={{
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
              }}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLoadDialogOpen(false)}
                className="rounded px-3 py-1 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  loadFromStorage();
                  appendLog("已从 localStorage 恢复上次保存的工作流。");
                  setLoadDialogOpen(false);
                }}
                className="rounded px-3 py-1 text-xs"
                style={{ border: "1px solid var(--border)" }}
              >
                读缓存
              </button>
              <button
                type="button"
                onClick={handleApplyLoad}
                className="rounded px-3 py-1 text-xs"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-fg)",
                }}
              >
                应用 JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  icon,
  label,
  onClick,
  disabled,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tool-btn flex items-center gap-1 rounded-md px-2 py-1 text-[11px] disabled:opacity-40"
      style={{
        color: accent ? "var(--accent-fg)" : "var(--text-primary)",
        backgroundColor: accent ? "var(--accent)" : "transparent",
        border: accent ? "none" : "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
