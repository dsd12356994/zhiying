import { Toolbar } from "./components/editor/Toolbar";
import { ThemeToggle } from "./components/ThemeToggle";
import { MediaPanel } from "./components/editor/MediaPanel";
import { Preview } from "./components/editor/Preview";
import { Timeline } from "./components/editor/Timeline";
import { ChatBox } from "./components/editor/ChatBox";
import { ExportDialog } from "./components/editor/ExportDialog";
import { FlowTab } from "./components/workspace/FlowTab";
import { InspectorPanel } from "./components/editor/InspectorPanel";
import { useEditorStore } from "./stores/editor-store";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

function App() {
  const { showMediaPanel, showInspector, toggleFlowTab, showExportDialog, setExportDialog } = useEditorStore();
  useKeyboardShortcuts();

  return (
    <div
      className="flex h-full flex-col"
      style={{
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      {/* Top toolbar */}
      <Toolbar trailing={<ThemeToggle />} />

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Media panel */}
        {showMediaPanel && (
          <>
            <div
              className="w-56 shrink-0 overflow-hidden"
              style={{ borderRight: "1px solid var(--border)" }}
            >
              <MediaPanel />
            </div>
            <div
              className="resize-handle w-px cursor-col-resize transition-colors"
              style={{ backgroundColor: "var(--border)" }}
            />
          </>
        )}

        {/* Center: Preview */}
        <div className="flex-1 overflow-hidden">
          <Preview />
        </div>

        {/* Right: Inspector */}
        {showInspector && (
          <>
            <div
              className="resize-handle w-px cursor-col-resize transition-colors"
              style={{ backgroundColor: "var(--border)" }}
            />
            <div
              className="w-56 shrink-0 overflow-hidden"
              style={{
                borderLeft: "1px solid var(--border)",
                backgroundColor: "var(--bg-secondary)",
              }}
            >
              <div
                className="flex items-center px-3 py-2"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  属性
                </span>
              </div>
              <div
                className="h-[calc(100%-33px)]"
                style={{ color: "var(--text-secondary)" }}
              >
                <InspectorPanel />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom: Timeline */}
      <div
        className="h-48 shrink-0"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div
          className="flex items-center justify-between px-3 py-1"
          style={{
            borderBottom: "1px solid var(--border)",
            backgroundColor: "var(--bg-secondary)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              时间轴
            </span>
          </div>
          <button
            onClick={toggleFlowTab}
            className="flow-tab-btn flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors"
            style={{
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-secondary)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="12"
              height="12"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
              <circle cx="8" cy="6" r="1.5" fill="currentColor" />
              <circle cx="14" cy="12" r="1.5" fill="currentColor" />
              <circle cx="10" cy="18" r="1.5" fill="currentColor" />
            </svg>
            AI 工作流
          </button>
        </div>
        <div className="h-[calc(100%-28px)]">
          <Timeline />
        </div>
      </div>

      {/* Floating overlays */}
      <ChatBox />
      <FlowTab />
      <ExportDialog open={showExportDialog} onClose={() => setExportDialog(false)} />
    </div>
  );
}

export default App;
