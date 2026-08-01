import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { Toolbar } from "./components/editor/Toolbar";
import { ThemeToggle } from "./components/ThemeToggle";
import { MediaPanel } from "./components/editor/MediaPanel";
import { Preview } from "./components/editor/Preview";
import { Timeline } from "./components/editor/Timeline";
import { ChatBox } from "./components/editor/ChatBox";
import { ExportDialog } from "./components/editor/ExportDialog";
import { InspectorPanel } from "./components/editor/InspectorPanel";
import { SettingsDialog } from "./components/settings/SettingsDialog";
import { OnboardingTour } from "./components/onboarding/OnboardingTour";
import { useEditorStore } from "./stores/editor-store";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import Dashboard from "./pages/Dashboard";
import { getProjectRecord, saveProjectRecord, type PersistedEditorState } from "./lib/storage";
import { useProjectStore } from "./stores/project-store";
import { useSettingsStore } from "./stores/settings-store";

function EditorWorkspace() {
  const {
    showMediaPanel, showInspector,
    showExportDialog, setExportDialog,
  } = useEditorStore();
  const [showSettings, setShowSettings] = useState(false);
  useKeyboardShortcuts();

  return (
    <div
      className="flex h-full flex-col"
      style={{
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      <Toolbar trailing={<ThemeToggle />} onOpenSettings={() => setShowSettings(true)} />
      <div className="flex flex-1 overflow-hidden">
        {showMediaPanel && (
          <>
            <div className="w-56 shrink-0 overflow-hidden animate-panel-in" style={{ borderRight: "1px solid var(--border)" }}>
              <MediaPanel />
            </div>
            <div className="resize-handle w-px cursor-col-resize transition-colors" style={{ backgroundColor: "var(--border)" }} />
          </>
        )}
        <div className="flex-1 overflow-hidden">
          <Preview />
        </div>
        {showInspector && (
          <>
            <div className="resize-handle w-px cursor-col-resize transition-colors" style={{ backgroundColor: "var(--border)" }} />
            <div
              className="w-56 shrink-0 overflow-hidden animate-panel-in"
              style={{ borderLeft: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
            >
              <div className="flex items-center px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  属性
                </span>
              </div>
              <div className="h-[calc(100%-33px)]" style={{ color: "var(--text-secondary)" }}>
                <InspectorPanel />
              </div>
            </div>
          </>
        )}
      </div>
      <div className="h-48 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <div
          className="flex items-center justify-between px-3 py-1"
          style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>
              时间轴
            </span>
          </div>
        </div>
        <div className="h-[calc(100%-28px)]">
          <Timeline />
        </div>
      </div>
      <ChatBox />
      <ExportDialog open={showExportDialog} onClose={() => setExportDialog(false)} />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <OnboardingTour />
    </div>
  );
}

function EditorRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const language = useSettingsStore((s) => s.language);
  const text =
    language === "en"
      ? {
          loading: "Loading project...",
          loadFailed: "Failed to load project",
          back: "Back to Dashboard",
        }
      : {
          loading: "加载项目中…",
          loadFailed: "项目加载失败",
          back: "返回项目列表",
        };
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<number>(Date.now());
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const setProject = useProjectStore((s) => s.setProject);
  const project = useProjectStore((s) => s.project);
  const editorSnapshot = useEditorStore(
    useShallow((s) => ({
      videoSrc: s.videoSrc,
      clips: s.clips,
      transitions: s.transitions,
      markers: s.markers,
      beatMarkers: s.beatMarkers,
      duration: s.duration,
      sourceDuration: s.sourceDuration,
      trimStart: s.trimStart,
      trimEnd: s.trimEnd,
      currentTime: s.currentTime,
      selectedClipId: s.selectedClipId,
    }))
  );

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!projectId) {
        navigate("/", { replace: true });
        return;
      }
      setLoading(true);
      setLoadError(null);
      hydratedRef.current = false;
      try {
        const record = await getProjectRecord(projectId);
        if (!record) {
          if (active) navigate("/", { replace: true });
          return;
        }
        if (!active) return;
        setCreatedAt(record.createdAt);
        setProject(record.project);
        const editor = useEditorStore.getState();
        const targetVideoSrc = record.editor.videoSrc;
        const matchedVideo = targetVideoSrc
          ? record.project.mediaItems.find((m) => m.url === targetVideoSrc)
          : record.project.mediaItems.find((m) => m.type === "video");
        editor.setVideoFile(matchedVideo?.file ?? null, targetVideoSrc ?? matchedVideo?.url ?? null);
        useEditorStore.setState({
          clips: record.editor.clips,
          transitions: record.editor.transitions,
          markers: record.editor.markers,
          beatMarkers: record.editor.beatMarkers,
          duration: record.editor.duration,
          sourceDuration: record.editor.sourceDuration,
          trimStart: record.editor.trimStart,
          trimEnd: record.editor.trimEnd,
          currentTime: record.editor.currentTime,
          selectedClipId: record.editor.selectedClipId,
          isPlaying: false,
          showExportDialog: false,
        });
        hydratedRef.current = true;
        await saveProjectRecord({ ...record, lastOpened: Date.now() });
      } catch (error) {
        if (!active) return;
        console.error("[EditorRoute] load project failed", { projectId, error });
        setLoadError(error instanceof Error ? error.message : "加载项目失败");
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [navigate, projectId, setProject]);

  useEffect(() => {
    if (!projectId || !hydratedRef.current || loading) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const payloadEditor: PersistedEditorState = {
        videoSrc: editorSnapshot.videoSrc,
        clips: editorSnapshot.clips,
        transitions: editorSnapshot.transitions,
        markers: editorSnapshot.markers,
        beatMarkers: editorSnapshot.beatMarkers,
        duration: editorSnapshot.duration,
        sourceDuration: editorSnapshot.sourceDuration,
        trimStart: editorSnapshot.trimStart,
        trimEnd: editorSnapshot.trimEnd,
        currentTime: editorSnapshot.currentTime,
        selectedClipId: editorSnapshot.selectedClipId,
      };
      void saveProjectRecord({
        id: projectId,
        name: project.name,
        createdAt,
        lastOpened: Date.now(),
        project,
        editor: payloadEditor,
      });
    }, 5000);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [createdAt, editorSnapshot, loading, project, projectId]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-fg-muted">{text.loading}</div>;
  }
  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="text-sm text-red-400">{text.loadFailed}: {loadError}</div>
        <button
          type="button"
          onClick={() => navigate("/", { replace: true })}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg"
        >
          {text.back}
        </button>
      </div>
    );
  }
  return <EditorWorkspace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/editor" element={<EditorWorkspace />} />
        <Route path="/editor/:projectId" element={<EditorRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
