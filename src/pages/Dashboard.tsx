import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Film, Plus, Trash2, FolderOpen, Settings } from "lucide-react";
import {
  createProjectRecord,
  deleteProjectRecord,
  listProjectSummaries,
  type StoredProjectSummary,
} from "../lib/storage";
import { Marketplace } from "../components/dashboard/Marketplace";
import { useSettingsStore } from "../stores/settings-store";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(
    2,
    "0"
  )}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const language = useSettingsStore((s) => s.language);
  const text = language === "en"
    ? {
        appSub: "Project Dashboard",
        create: "New Project",
        settings: "Settings (coming soon)",
        loading: "Loading projects...",
        emptyTitle: "No Projects Yet",
        emptyDesc: "Create a project to start editing.",
        open: "Open",
        remove: "Delete project",
        lastEdited: "Last edited",
        removeConfirm: "Delete this project? This action cannot be undone.",
        createTitle: "Create Project",
        createPlaceholder: "Enter project name",
        cancel: "Cancel",
        creating: "Creating...",
        createAndOpen: "Create & Open",
        untitled: "Untitled Project",
        quickEnter: "Open Editor Directly",
      }
    : {
        appSub: "项目管理",
        create: "新建项目",
        settings: "设置（下一步实现）",
        loading: "正在加载项目列表…",
        emptyTitle: "还没有项目",
        emptyDesc: "创建一个新项目，开始剪辑。",
        open: "打开项目",
        remove: "删除项目",
        lastEdited: "最后编辑",
        removeConfirm: "确定删除该项目吗？此操作不可撤销。",
        createTitle: "新建项目",
        createPlaceholder: "输入项目名称",
        cancel: "取消",
        creating: "创建中...",
        createAndOpen: "创建并进入",
        untitled: "未命名项目",
        quickEnter: "直接进入编辑器",
      };
  const [projects, setProjects] = useState<StoredProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [projectName, setProjectName] = useState(text.untitled);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listProjectSummaries();
      setProjects(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const empty = useMemo(() => !loading && projects.length === 0, [loading, projects.length]);

  const createProject = useCallback(async () => {
    if (busy) return;
    const name = projectName.trim() || text.untitled;
    setBusy(true);
    try {
      const record = await createProjectRecord(name);
      setShowCreate(false);
      navigate(`/editor/${record.id}`);
    } finally {
      setBusy(false);
    }
  }, [busy, navigate, projectName, text.untitled]);

  const removeProject = useCallback(async (id: string) => {
    const yes = window.confirm(text.removeConfirm);
    if (!yes) return;
    await deleteProjectRecord(id);
    await refresh();
  }, [refresh, text.removeConfirm]);

  return (
    <div className="min-h-screen bg-bg-1 text-fg">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-accent/15 p-2 text-accent">
            <Film size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold">智映</div>
            <div className="text-xs text-fg-muted">{text.appSub}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/editor")}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg"
          >
            {text.quickEnter}
          </button>
          <button
            type="button"
            onClick={() => {
              setProjectName(text.untitled);
              setShowCreate(true);
            }}
            className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:opacity-90"
          >
            <Plus size={14} />
            {text.create}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1.5 text-xs text-fg-muted hover:text-fg"
            title={text.settings}
          >
            <Settings size={14} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-8">
        {loading && <div className="text-sm text-fg-muted">{text.loading}</div>}

        {empty && (
          <div className="mt-14 rounded-xl border border-dashed border-border bg-bg-2 p-12 text-center">
            <div className="mx-auto mb-3 w-fit rounded-full bg-bg-3 p-3 text-fg-muted">
              <FolderOpen size={20} />
            </div>
            <div className="mb-2 text-base font-medium">{text.emptyTitle}</div>
            <div className="mb-5 text-sm text-fg-muted">{text.emptyDesc}</div>
            <button
              type="button"
              onClick={() => {
                setProjectName(text.untitled);
                setShowCreate(true);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
            >
              <Plus size={14} />
              {text.create}
            </button>
            <button
              type="button"
              onClick={() => navigate("/editor")}
              className="ml-2 inline-flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm text-fg-muted hover:text-fg"
            >
              {text.quickEnter}
            </button>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-bg-2 p-3">
                <button
                  type="button"
                  onClick={() => navigate(`/editor/${p.id}`)}
                  className="mb-2 block h-32 w-full overflow-hidden rounded-md border border-border bg-bg-3 text-left"
                >
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-fg-muted">
                      <Film size={20} />
                    </div>
                  )}
                </button>
                <div className="mb-1 truncate text-sm font-medium">{p.name}</div>
                <div className="mb-3 text-[11px] text-fg-muted">
                  {text.lastEdited}: {formatTime(p.lastOpened)}
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => navigate(`/editor/${p.id}`)}
                    className="text-xs text-accent hover:underline"
                  >
                    {text.open}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeProject(p.id)}
                    className="rounded p-1 text-fg-muted hover:bg-red-500/10 hover:text-red-400"
                    title={text.remove}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && <Marketplace />}
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
          <div className="w-[420px] rounded-xl border border-border bg-bg-elev p-4 shadow-xl animate-modal-pop">
            <div className="mb-3 text-sm font-medium">{text.createTitle}</div>
            <input
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-2 px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder={text.createPlaceholder}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg"
              >
                {text.cancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createProject()}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
              >
                {busy ? text.creating : text.createAndOpen}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
