import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Film,
  Plus,
  Trash2,
  FolderOpen,
  Settings,
  Search,
  Clock,
  Layers,
  Sparkles,
  ChevronDown,
  X,
  Loader,
} from "lucide-react";
import {
  createProjectRecord,
  saveProjectRecord,
  deleteProjectRecord,
  listProjectSummaries,
  type StoredProjectSummary,
} from "../lib/storage";
import { Marketplace } from "../components/dashboard/Marketplace";
import { SettingsDialog } from "../components/settings/SettingsDialog";
import { useSettingsStore } from "../stores/settings-store";
import { executeTool } from "../lib/tools/toolRegistry";
import { askLLM } from "../lib/agent/llmAgent";
import { useEditorStore } from "../stores/editor-store";

function formatRelativeTime(ts: number, lang: string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (lang === "en") {
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

type SortMode = "lastOpened" | "name" | "createdAt";

// ─── Project Card ────────────────────────────────────────────────

function ProjectCard({
  project,
  lang,
  openLabel,
  deleteLabel,
  onOpen,
  onDelete,
}: {
  project: StoredProjectSummary;
  lang: string;
  openLabel: string;
  deleteLabel: string;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col overflow-hidden rounded-xl transition-shadow hover:shadow-md"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      {/* Thumbnail */}
      <div
        className="relative w-full cursor-pointer"
        style={{ aspectRatio: "16/9", backgroundColor: "var(--bg-tertiary)" }}
        onClick={onOpen}
      >
        {project.thumbnail ? (
          <img src={project.thumbnail} alt={project.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <Film size={24} />
          </div>
        )}
        {/* Hover overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 transition-opacity duration-150"
          style={{ opacity: hovered ? 1 : 0, backgroundColor: "rgba(0,0,0,0.55)" }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {openLabel}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded-lg p-1.5 transition-colors hover:bg-red-500/20 hover:text-red-400"
            style={{ color: "rgba(255,255,255,0.7)" }}
            title={deleteLabel}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {/* Info */}
      <div className="flex flex-col px-3 py-2.5">
        <div className="truncate text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          {project.name}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <Clock size={9} />
          {formatRelativeTime(project.lastOpened, lang)}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const language = useSettingsStore((s) => s.language);
  const isEn = language === "en";

  const t = isEn
    ? {
        brand: "Zhiying",
        brandSub: "AI Video Editor",
        newProject: "New Project",
        settings: "Settings",
        projectsTab: "Projects",
        templatesTab: "Templates",
        searchPlaceholder: "Search projects...",
        sortLastOpened: "Last Opened",
        sortName: "Name",
        sortCreated: "Created",
        quickStartTitle: "Start Creating",
        blankProject: "Blank Project",
        blankProjectDesc: "Start from scratch, total freedom",
        browseTemplates: "Templates",
        browseTemplatesDesc: "Launch from a ready-made preset",
        continueRecent: "Continue Recent",
        quickEditorTitle: "Quick Editor",
        quickEditorDesc: "Jump into the editor instantly",
        recentProjects: "Recent Projects",
        noProjects: "No Projects Yet",
        noProjectsDesc: "Create your first project to get started.",
        noSearchResults: "No results for",
        clearSearch: "Clear search",
        openProject: "Open",
        deleteProject: "Delete",
        deleteConfirm: "Delete this project? This cannot be undone.",
        createDialogTitle: "New Project",
        createPlaceholder: "Project name",
        cancel: "Cancel",
        creating: "Creating...",
        createAndOpen: "Create & Open",
        untitled: "Untitled Project",
        heroTitle: "AI Avatar Video Creator",
        heroSub: "Enter a topic, upload your photo, and AI generates a professional video",
        topicPlaceholder: "What's your topic? e.g., Life insurance vs critical illness...",
        topicLabel: "Topic",
        toneLabel: "Tone",
        tones: { friendly: "Friendly", professional: "Professional", simple: "Simple" },
        photoLabel: "Avatar Image",
        photoHint: "Upload a clear front-facing photo for AI avatar",
        photoUpload: "Click to upload photo",
        descLabel: "Describe Appearance",
        descPlaceholder: "e.g., 35-year-old male advisor, glasses, navy suit, warm smile...",
        descHint: "Describe your appearance instead of uploading a photo",
        modePhoto: "Upload Photo",
        modeDesc: "Describe",
        generateBtn: "Generate Video",
        generating: "Generating...",
      }
    : {
        brand: "智映",
        brandSub: "AI 视频剪辑",
        newProject: "新建项目",
        settings: "设置",
        projectsTab: "项目",
        templatesTab: "模板市场",
        searchPlaceholder: "搜索项目…",
        sortLastOpened: "最近打开",
        sortName: "名称",
        sortCreated: "创建时间",
        quickStartTitle: "开始创作",
        blankProject: "空白项目",
        blankProjectDesc: "从头开始，自由发挥",
        browseTemplates: "套用模板",
        browseTemplatesDesc: "选择预设模板快速启动",
        continueRecent: "继续上次",
        quickEditorTitle: "快速进入",
        quickEditorDesc: "无需项目，直接进入编辑器",
        recentProjects: "最近项目",
        noProjects: "还没有项目",
        noProjectsDesc: "新建一个项目，开始你的创作之旅。",
        noSearchResults: "未找到",
        clearSearch: "清空搜索",
        openProject: "打开",
        deleteProject: "删除",
        deleteConfirm: "确定删除该项目吗？此操作不可撤销。",
        createDialogTitle: "新建项目",
        createPlaceholder: "输入项目名称",
        cancel: "取消",
        creating: "创建中…",
        createAndOpen: "创建并打开",
        untitled: "未命名项目",
        // Quick-create hero
        heroTitle: "AI 数字人视频创作",
        heroSub: "输入话题，上传照片，AI 自动生成专业口播视频",
        topicPlaceholder: "今天讲什么？例如：理财风险要注意什么...",
        topicLabel: "视频话题",
        toneLabel: "语气风格",
        tones: { friendly: "亲切易懂", professional: "专业严谨", simple: "简单直白" },
        photoLabel: "数字人形象",
        photoHint: "上传清晰正面照，用于生成数字人头像",
        photoUpload: "点击上传照片",
        descLabel: "文字描述形象",
        descPlaceholder: "例如：35岁男性保险顾问，戴眼镜，深蓝色西装，亲切微笑...",
        descHint: "不传照片时可用文字描述，系统自动生成专业形象",
        modePhoto: "上传照片",
        modeDesc: "文字描述",
        generateBtn: "一键生成视频",
        generating: "生成中...",
      };

  const [projects, setProjects] = useState<StoredProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"projects" | "templates">("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("lastOpened");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);

  // Quick-create hero form
  const [quickTopic, setQuickTopic] = useState("");
  const [quickTone, setQuickTone] = useState<string>("friendly");
  const [quickPhoto, setQuickPhoto] = useState<string>("");
  const [quickPhotoPreview, setQuickPhotoPreview] = useState<string>("");
  const [usePhotoMode, setUsePhotoMode] = useState<"photo" | "describe">("photo");
  const [avatarDesc, setAvatarDesc] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);

  // Workflow progress
  const [showProgress, setShowProgress] = useState(false);
  const [workflowSteps, setWorkflowSteps] = useState<Array<{ label: string; status: "pending" | "running" | "done" | "error"; detail?: string }>>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string>("");
  const [finalTitle, setFinalTitle] = useState<string>("");
  const [projectRecordId, setProjectRecordId] = useState<string>("");

  const WORKFLOW = [
    { key: "search",  label: { zh: "搜索权威资料", en: "Searching knowledge base" } },
    { key: "script",  label: { zh: "生成口播脚本", en: "Generating script" } },
    { key: "storyboard", label: { zh: "生成分镜脚本", en: "Creating storyboard" } },
    { key: "videogen",   label: { zh: "AI 生成视频画面", en: "AI generating video scenes" } },
    { key: "speech",  label: { zh: "AI 语音合成", en: "Synthesizing voice" } },
    { key: "compose", label: { zh: "合成字幕和品牌", en: "Composing final video" } },
    { key: "polish",  label: { zh: "AI 自动精修优化", en: "AI auto-polishing" } },
    { key: "done",    label: { zh: "✅ 完成！", en: "Done!" } },
  ];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listProjectSummaries();
      setProjects(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredProjects = useMemo(() => {
    let list = [...projects];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "createdAt") return b.createdAt - a.createdAt;
      return b.lastOpened - a.lastOpened;
    });
    return list;
  }, [projects, searchQuery, sortMode]);

  const recentProject = useMemo(
    () => projects.reduce<StoredProjectSummary | null>(
      (acc, p) => (!acc || p.lastOpened > acc.lastOpened ? p : acc), null
    ),
    [projects]
  );

  const openCreateDialog = useCallback(() => {
    setProjectName(t.untitled);
    setShowCreate(true);
  }, [t.untitled]);

  const createProject = useCallback(async () => {
    if (busy) return;
    const name = projectName.trim() || t.untitled;
    setBusy(true);
    try {
      const record = await createProjectRecord(name);
      setShowCreate(false);
      navigate(`/editor/${record.id}`);
    } finally {
      setBusy(false);
    }
  }, [busy, navigate, projectName, t.untitled]);

  const removeProject = useCallback(async (id: string) => {
    if (!window.confirm(t.deleteConfirm)) return;
    await deleteProjectRecord(id);
    await refresh();
  }, [refresh, t.deleteConfirm]);

  const handleQuickCreate = useCallback(async () => {
    if (!quickTopic.trim() || quickBusy) return;
    setQuickBusy(true);
    setFinalVideoUrl("");
    setFinalTitle("");
    setProjectRecordId("");
    // Init progress
    setWorkflowSteps(WORKFLOW.map((s) => ({ label: language === "en" ? s.label.en : s.label.zh, status: "pending" as const, detail: "" })));
    setShowProgress(true);

    const updateStep = (key: string, status: "running" | "done" | "error", detail = "") => {
      setWorkflowSteps((prev) => prev.map((s, i) => {
        const wk = WORKFLOW[i];
        if (wk?.key === key) return { ...s, status, detail };
        return s;
      }));
    };

    try {
      // Step 1: Search
      updateStep("search", "running");
      const searchResult = await executeTool("searchWeb", { query: quickTopic.trim(), maxResults: 5 });
      updateStep("search", "done", searchResult.ok ? `找到 ${(searchResult.data as Record<string,unknown>)?.results?.length ?? 0} 条资料` : searchResult.message);

      // Step 2: Script
      updateStep("script", "running");
      const researchSummary = searchResult.ok ? (searchResult.data as Record<string,unknown>)?.summary as string ?? "" : "";
      const scriptResult = await executeTool("generateScript", { topic: quickTopic.trim(), research: researchSummary || undefined, tone: quickTone });
      if (!scriptResult.ok) { updateStep("script", "error", scriptResult.message); return; }
      const scriptData = scriptResult.data as Record<string, unknown> | undefined;
      const scriptText = scriptData?.script as string ?? "";
      const scriptTitle = scriptData?.title as string ?? quickTopic.trim();
      setFinalTitle(scriptTitle);
      updateStep("script", "done", `${scriptData?.charCount ?? 0} 字·约${scriptData?.estimatedDuration ?? 0}秒`);

      // Step 3: Storyboard — split script into visual scenes for text-to-video
      updateStep("storyboard", "running");
      const storyboardResult = await executeTool("generateStoryboard", { script: scriptText, topic: scriptTitle });
      if (!storyboardResult.ok) { updateStep("storyboard", "error", storyboardResult.message); return; }
      const storyboardData = storyboardResult.data as Record<string, unknown> | undefined;
      const scenes = storyboardData?.scenes as Array<{ index: number; text: string; prompt: string; duration: number }> | undefined;
      if (!scenes?.length) { updateStep("storyboard", "error", "分镜生成失败"); return; }
      updateStep("storyboard", "done", `${scenes.length} 个镜头`);

      // Step 4: Text-to-video — parallel generation (NarratoAI: duration from text length)
      const scenesToGen = scenes.slice(0, 3);
      updateStep("videogen", "running", `并行生成 ${scenesToGen.length} 个场景（约 1-3 分钟）...`);
      const clipResults = await Promise.allSettled(
        scenesToGen.map((scene) =>
          executeTool("generateVideoClip", { prompt: scene.prompt, duration: scene.duration })
        )
      );
      // Map results back to scene metadata — keep duration from storyboard (text-length-based)
      const sceneClips: Array<{ videoUrl: string; duration: number; text: string }> = [];
      for (let ci = 0; ci < clipResults.length; ci++) {
        const r = clipResults[ci]!;
        if (r.status === "fulfilled" && r.value.ok) {
          const url = (r.value.data as Record<string, unknown>)?.videoUrl as string | undefined;
          if (url) sceneClips.push({ videoUrl: url, duration: scenesToGen[ci]!.duration, text: scenesToGen[ci]!.text });
        }
      }
      if (!sceneClips.length) { updateStep("videogen", "error", "视频生成失败，请检查 设置→AI配置→视频生成API"); return; }
      const totalVideoDuration = sceneClips.reduce((s, c) => s + c.duration, 0);
      updateStep("videogen", "done", `已生成 ${sceneClips.length} 个场景，总时长 ${totalVideoDuration} 秒`);

      // Inject all clips into editor store with per-scene durations (audio-primary approach)
      const firstClipUrl = sceneClips[0]!.videoUrl;
      useEditorStore.getState().initializeClips(sceneClips[0]!.duration, firstClipUrl);
      let offset = sceneClips[0]!.duration;
      for (let i = 1; i < sceneClips.length; i++) {
        const sc = sceneClips[i]!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useEditorStore.getState().addClip({
          type: "video", src: sc.videoUrl, name: `场景${i + 1}`,
          start: offset, end: offset + sc.duration,
          sourceStart: 0, sourceEnd: sc.duration,
          trackIndex: 0, skipAudioExtract: true,
        } as any);
        offset += sc.duration;
      }

      // Step 5: Speech synthesis
      updateStep("speech", "running");
      const voice = quickTone === "professional" ? "yunxi" : quickTone === "simple" ? "yunjian" : "xiaoxiao";
      const speechResult = await executeTool("synthesizeSpeech", { text: scriptText, voice });
      updateStep("speech", "done", speechResult.ok ? `Edge TTS √` : "跳过");

      // Step 6: Compose — subtitle timing derived from text length (NarratoAI 2.5 chars/sec rule)
      updateStep("compose", "running");
      const CHARS_PER_SEC = 2.5;
      let subOffset = 0;
      const subtitles = sceneClips.map((sc) => {
        const speechSec = sc.text.length / CHARS_PER_SEC;
        const displayEnd = Math.min(subOffset + speechSec, subOffset + sc.duration - 0.5);
        const sub = { text: sc.text.slice(0, 22), start: subOffset + 0.5, end: displayEnd };
        subOffset += sc.duration;
        return sub;
      }).filter((s) => s.text.length > 0 && s.end > s.start);
      const composeResult = await executeTool("composeVideo", {
        avatarVideoUrl: firstClipUrl,
        subtitles,
        // No introText — it overlaps visually with scene subtitles
        branding: { watermarkText: quickTopic.trim().slice(0, 10), outroText: "关注我·每天分享保险干货" },
      });
      updateStep("compose", "done", composeResult.ok ? `字幕+品牌已合成（${totalVideoDuration}秒视频）` : "跳过合成");

      // Step 7: Auto-Polish — LLM designs transitions and highlight subtitles for ACTUAL video duration
      updateStep("polish", "running");
      // Build scene cut points from actual per-scene durations
      const cutPoints: number[] = [];
      let cumDur = 0;
      for (const sc of sceneClips) { cumDur += sc.duration; cutPoints.push(cumDur); }
      const cutPointStr = cutPoints.slice(0, -1).map((t) => `${t}秒`).join("、");
      const polishPrompt = `你是专业视频剪辑师。视频信息：
标题：${scriptTitle}
视频总时长：${totalVideoDuration}秒（${sceneClips.length}个场景）
场景列表：${(() => { let t2 = 0; return sceneClips.map((sc, i) => { const s = t2; t2 += sc.duration; return `场景${i+1}（${s}-${t2}秒，${sc.duration}秒）：${sc.text.slice(0, 35)}`; }).join("；"); })()}

请输出视频精修方案（严格JSON，不要其他文字）：
{
  "transitions": [{"at": 秒数, "type": "fade|crossDissolve|slide"}],
  "highlightSubtitles": [{"text": "金句文字（不超过15字）", "at": 秒数}]
}
要求：
1. 转场只在场景切换点（${cutPointStr || "无切换点"}）添加，每个切换点最多一个转场
2. 金句字幕选最核心1-2句，时间必须在0到${totalVideoDuration}秒之间
3. 只输出transitions和highlightSubtitles两个字段`;

      try {
        const polishResult = await askLLM(polishPrompt, {});
        const polishText = polishResult.message || "";
        const jsonMatch = polishText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const plan = JSON.parse(jsonMatch[0]) as {
            transitions?: Array<{ at: number; type: string; reason: string }>;
            highlightSubtitles?: Array<{ text: string; at: number; reason: string }>;
            optimizations?: string[];
          };

          // Apply transitions at scene cut points
          if (plan.transitions?.length) {
            let transCount = 0;
            for (const t of plan.transitions.slice(0, sceneClips.length - 1)) {
              const validType = (["fade", "crossDissolve", "slide"] as const).includes(t.type as "fade") ? t.type as "fade" | "crossDissolve" | "slide" : "crossDissolve";
              const r = await executeTool("addTransition", { type: validType, duration: 0.6 });
              if (r.ok) transCount++;
            }
            if (transCount > 0) updateStep("polish", "running", `已添加 ${transCount} 个转场`);
          }

          // Apply highlight subtitles — clamped to actual video duration
          if (plan.highlightSubtitles?.length) {
            let subCount = 0;
            for (const hs of plan.highlightSubtitles.slice(0, 2)) {
              const atSec = typeof hs.at === "number" ? hs.at : 0;
              const st = Math.max(0, Math.min(atSec, totalVideoDuration - 2));
              const en = Math.min(st + 2.5, totalVideoDuration);
              if (en > st && hs.text?.length > 0) {
                const r = await executeTool("addText", { content: hs.text, start: st, end: en, fontSize: 40, color: "#FFD700" });
                if (r.ok) subCount++;
              }
            }
            if (subCount > 0) updateStep("polish", "running", `已添加 ${subCount} 个亮点字幕`);
          }
        }
      } catch {
        // If polish fails, skip gracefully
      }
      updateStep("polish", "done", "转场衔接、亮点字幕、节奏优化已完成");

      // Done!
      updateStep("done", "done", "");
      setFinalVideoUrl(firstClipUrl);

      // Save project — capture editor state (clips + agent-applied transitions/text) for the editor
      const record = await createProjectRecord(scriptTitle, firstClipUrl);
      const es = useEditorStore.getState();
      await saveProjectRecord({
        ...record,
        editor: {
          videoSrc: firstClipUrl,
          clips: es.clips,
          transitions: es.transitions,
          markers: es.markers,
          beatMarkers: es.beatMarkers,
          duration: es.duration,
          sourceDuration: es.sourceDuration,
          trimStart: es.trimStart,
          trimEnd: es.trimEnd,
          currentTime: 0,
          selectedClipId: null,
        },
      });
      setProjectRecordId(record.id);
      void refresh(); // refresh project list so new project appears
    } catch (e) {
      const msg = e instanceof Error ? e.message : "未知错误";
      const currentRunning = workflowSteps.find((s) => s.status === "running");
      if (currentRunning) {
        const idx = workflowSteps.indexOf(currentRunning);
        const wk = WORKFLOW[idx];
        if (wk) updateStep(wk.key, "error", msg);
      }
    } finally {
      setQuickBusy(false);
    }
  }, [quickTopic, quickTone, quickPhoto, usePhotoMode, avatarDesc, quickBusy, language, workflowSteps]);

  const sortOptions: [SortMode, string][] = [
    ["lastOpened", t.sortLastOpened],
    ["name", t.sortName],
    ["createdAt", t.sortCreated],
  ];
  const currentSortLabel = sortOptions.find(([mode]) => mode === sortMode)?.[1] ?? "";

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* ─── Header ─── */}
      <header
        className="flex flex-none items-center justify-between px-6 py-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%)" }}
          >
            <Film size={16} color="#fff" />
          </div>
          <div>
            <div
              className="text-sm font-bold leading-none"
              style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
            >
              {t.brand}
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
              {t.brandSub}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="rounded-lg p-2 transition-colors hover:bg-hover"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
            title={t.settings}
          >
            <Settings size={14} />
          </button>
          <button
            type="button"
            onClick={openCreateDialog}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
          >
            <Plus size={14} />
            {t.newProject}
          </button>
        </div>
      </header>

      {/* ─── Hero: Quick-create ─── */}
      <div
        className="flex flex-none flex-col items-center px-6 py-8"
        style={{ borderBottom: "1px solid var(--border)", background: "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)" }}
      >
        <div className="mb-1 text-lg font-bold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {t.heroTitle}
        </div>
        <div className="mb-6 text-xs" style={{ color: "var(--text-muted)" }}>
          {t.heroSub}
        </div>

        <div className="flex w-full max-w-2xl items-end gap-3">
          {/* Avatar mode toggle + input */}
          <div className="shrink-0">
            <div className="mb-1 text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>{t.photoLabel}</div>
            <div className="flex gap-0.5 mb-1.5">
              <button onClick={() => setUsePhotoMode("photo")} className={`rounded-l-md px-2 py-1 text-[9px] transition-colors ${usePhotoMode === "photo" ? "bg-accent text-accent-fg" : ""}`} style={usePhotoMode !== "photo" ? { border: "1px solid var(--border)", color: "var(--text-muted)" } : {}}>{t.modePhoto}</button>
              <button onClick={() => setUsePhotoMode("describe")} className={`rounded-r-md px-2 py-1 text-[9px] transition-colors ${usePhotoMode === "describe" ? "bg-accent text-accent-fg" : ""}`} style={usePhotoMode !== "describe" ? { border: "1px solid var(--border)", color: "var(--text-muted)" } : {}}>{t.modeDesc}</button>
            </div>
            {usePhotoMode === "photo" ? (
              <label
                className="relative flex h-20 w-20 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors hover:border-accent"
                style={{ borderColor: quickPhotoPreview ? "var(--accent)" : "var(--border)", backgroundColor: "var(--bg-primary)" }}
              >
                {quickPhotoPreview ? (
                  <img src={quickPhotoPreview} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Plus size={18} style={{ color: "var(--text-muted)" }} />
                    <div className="mt-0.5 text-[8px] leading-tight" style={{ color: "var(--text-muted)" }}>{t.photoUpload}</div>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setQuickPhotoPreview(URL.createObjectURL(file));
                  const reader = new FileReader();
                  reader.onloadend = () => setQuickPhoto(reader.result as string);
                  reader.readAsDataURL(file);
                }} />
              </label>
            ) : (
              <textarea
                value={avatarDesc}
                onChange={(e) => setAvatarDesc(e.target.value)}
                placeholder={t.descPlaceholder}
                rows={3}
                className="w-36 resize-none rounded-lg border px-2 py-1.5 text-[10px] outline-none transition-colors focus:border-accent"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
              />
            )}
            <div className="mt-1 text-[9px] text-fg-muted" style={{ maxWidth: usePhotoMode === "photo" ? 80 : 144 }}>
              {usePhotoMode === "photo" ? t.photoHint : t.descHint}
            </div>
          </div>

          {/* Topic input */}
          <div className="flex-1">
            <div className="mb-1 text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>{t.topicLabel}</div>
            <textarea
              value={quickTopic}
              onChange={(e) => setQuickTopic(e.target.value)}
              placeholder={t.topicPlaceholder}
              rows={2}
              className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (quickTopic.trim()) handleQuickCreate(); }
              }}
            />
          </div>

          {/* Tone + Generate */}
          <div className="flex shrink-0 flex-col gap-1.5">
            <div className="mb-1 text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>{t.toneLabel}</div>
            <select
              value={quickTone}
              onChange={(e) => setQuickTone(e.target.value)}
              className="rounded-lg border px-2 py-2 text-xs outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
            >
              <option value="friendly">{t.tones.friendly}</option>
              <option value="professional">{t.tones.professional}</option>
              <option value="simple">{t.tones.simple}</option>
            </select>
            <button
              type="button"
              disabled={!quickTopic.trim() || quickBusy}
              onClick={() => void handleQuickCreate()}
              className="flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {quickBusy ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {quickBusy ? t.generating : t.generateBtn}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Tab bar + controls ─── */}
      <div
        className="flex flex-none items-center justify-between px-6"
        style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--bg-primary)" }}
      >
        <div className="flex">
          {(["projects", "templates"] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label =
              tab === "projects"
                ? `${t.projectsTab}${!loading && projects.length > 0 ? ` (${projects.length})` : ""}`
                : t.templatesTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="relative px-4 py-3 text-xs font-medium transition-colors"
                style={{
                  color: isActive ? "var(--accent)" : "var(--text-muted)",
                  borderBottom: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
                  marginBottom: "-1px",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {activeTab === "projects" && (
          <div className="flex items-center gap-2 py-2">
            {/* Search */}
            <div className="relative flex items-center">
              <Search
                size={12}
                className="pointer-events-none absolute left-2.5"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="h-7 rounded-lg py-1 pl-8 pr-7 text-xs outline-none"
                style={{
                  width: 180,
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSortMenu((s) => !s)}
                className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors"
                style={{
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg-secondary)",
                }}
              >
                <span>{currentSortLabel}</span>
                <ChevronDown size={11} />
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                  <div
                    className="absolute right-0 top-full z-50 mt-1 min-w-[130px] rounded-xl py-1 shadow-xl"
                    style={{ backgroundColor: "var(--bg-elev)", border: "1px solid var(--border)" }}
                  >
                    {sortOptions.map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => { setSortMode(mode); setShowSortMenu(false); }}
                        className="flex w-full items-center px-3 py-2 text-xs transition-colors hover:bg-hover"
                        style={{ color: sortMode === mode ? "var(--accent)" : "var(--text-primary)" }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Scrollable content ─── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 pb-12 pt-7">

          {activeTab === "projects" && (
            <>
              {/* Quick Start */}
              <section className="mb-9">
                <div
                  className="mb-3 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t.quickStartTitle}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* Blank project */}
                  <button
                    type="button"
                    onClick={openCreateDialog}
                    className="flex flex-col gap-3 rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)",
                        color: "var(--accent)",
                      }}
                    >
                      <Plus size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {t.blankProject}
                      </div>
                      <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {t.blankProjectDesc}
                      </div>
                    </div>
                  </button>

                  {/* Browse templates */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("templates")}
                    className="flex flex-col gap-3 rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: "color-mix(in srgb, #8b5cf6 15%, transparent)",
                        color: "#8b5cf6",
                      }}
                    >
                      <Layers size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {t.browseTemplates}
                      </div>
                      <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {t.browseTemplatesDesc}
                      </div>
                    </div>
                  </button>

                  {/* Continue recent OR quick editor */}
                  {recentProject ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/editor/${recentProject.id}`)}
                      className="flex flex-col gap-3 rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
                    >
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: "color-mix(in srgb, #10b981 15%, transparent)",
                          color: "#10b981",
                        }}
                      >
                        <Clock size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {t.continueRecent}
                        </div>
                        <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {recentProject.name}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate("/editor")}
                      className="flex flex-col gap-3 rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
                    >
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: "color-mix(in srgb, #f59e0b 15%, transparent)",
                          color: "#f59e0b",
                        }}
                      >
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {t.quickEditorTitle}
                        </div>
                        <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {t.quickEditorDesc}
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              </section>

              {/* Recent projects */}
              <section>
                <div
                  className="mb-3 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t.recentProjects}
                </div>

                {loading && (
                  <div className="flex items-center gap-2 py-4 text-xs" style={{ color: "var(--text-muted)" }}>
                    <div
                      className="h-3.5 w-3.5 animate-spin rounded-full"
                      style={{ border: "2px solid var(--accent)", borderTopColor: "transparent" }}
                    />
                    {isEn ? "Loading..." : "加载中…"}
                  </div>
                )}

                {!loading && filteredProjects.length === 0 && (
                  <div
                    className="rounded-2xl py-16 text-center"
                    style={{ border: "1px dashed var(--border)", backgroundColor: "var(--bg-secondary)" }}
                  >
                    {searchQuery ? (
                      <>
                        <div className="mb-1.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {t.noSearchResults} "{searchQuery}"
                        </div>
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="text-xs underline"
                          style={{ color: "var(--accent)" }}
                        >
                          {t.clearSearch}
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}
                        >
                          <FolderOpen size={22} />
                        </div>
                        <div className="mb-1.5 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {t.noProjects}
                        </div>
                        <div className="mb-5 text-xs" style={{ color: "var(--text-muted)" }}>
                          {t.noProjectsDesc}
                        </div>
                        <button
                          type="button"
                          onClick={openCreateDialog}
                          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                          style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
                        >
                          <Plus size={13} />
                          {t.newProject}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {!loading && filteredProjects.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {filteredProjects.map((p) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        lang={language}
                        openLabel={t.openProject}
                        deleteLabel={t.deleteProject}
                        onOpen={() => navigate(`/editor/${p.id}`)}
                        onDelete={() => void removeProject(p.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === "templates" && <Marketplace />}
        </div>
      </main>

      {/* ─── Create project modal ─── */}
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />

      {/* Workflow Progress Modal */}
      {showProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div
            className="mx-4 flex w-full max-w-lg flex-col rounded-2xl p-6 shadow-2xl animate-modal-pop"
            style={{ backgroundColor: "var(--bg-elev)", border: "1px solid var(--border)" }}
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {finalVideoUrl ? "✅ 视频生成完成！" : "🎬 AI 正在生成视频..."}
              </span>
              <button onClick={() => setShowProgress(false)} className="rounded-md p-1 text-fg-muted hover:bg-hover">
                <X size={16} />
              </button>
            </div>

            {/* Steps */}
            <div className="space-y-2 mb-5">
              {workflowSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: step.status === "running" ? "color-mix(in srgb, var(--accent) 8%, var(--bg-secondary))" : "var(--bg-secondary)" }}>
                  <span className="text-base">
                    {step.status === "done" ? "✅" : step.status === "running" ? "⏳" : step.status === "error" ? "❌" : "⏸️"}
                  </span>
                  <div className="flex-1">
                    <div className="text-xs font-medium" style={{ color: step.status === "running" ? "var(--accent)" : "var(--text-primary)" }}>
                      {step.label}
                    </div>
                    {step.detail && (
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{step.detail}</div>
                    )}
                  </div>
                  {step.status === "running" && <Loader size={12} className="animate-spin" style={{ color: "var(--accent)" }} />}
                </div>
              ))}
            </div>

            {/* Video preview */}
            {finalVideoUrl && (
              <div className="mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <video
                  src={finalVideoUrl}
                  controls
                  className="w-full"
                  style={{ maxHeight: 400, backgroundColor: "#000" }}
                  poster={`data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="711"><rect fill="%231a1a2e" width="400" height="711"/><text fill="%23ffffff55" x="200" y="355" text-anchor="middle" font-size="14">${encodeURIComponent(finalTitle)}</text></svg>`}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between gap-2">
              <div>
                {finalVideoUrl && projectRecordId && (
                  <button
                    onClick={() => {
                      setShowProgress(false);
                      navigate(`/editor/${projectRecordId}`);
                    }}
                    className="rounded-lg px-4 py-2 text-xs font-medium transition-colors hover:bg-hover"
                    style={{ border: "1px solid var(--accent)", color: "var(--accent)" }}
                  >
                    🎬 在编辑器中精修
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {finalVideoUrl && (
                  <>
                    <button
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = finalVideoUrl;
                        a.download = `${finalTitle || "video"}.mp4`;
                        a.click();
                      }}
                      className="rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "var(--accent)" }}
                    >
                      下载视频
                    </button>
                    <button
                      onClick={() => navigator.clipboard?.writeText(finalVideoUrl)}
                      className="rounded-lg px-4 py-2 text-xs font-medium transition-colors hover:bg-hover"
                      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    >
                      复制链接
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowProgress(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium transition-colors hover:bg-hover"
                  style={{ color: "var(--text-muted)" }}
                >
                  {finalVideoUrl ? "关闭" : "后台生成"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div
            className="w-[400px] rounded-2xl p-6 shadow-2xl"
            style={{ backgroundColor: "var(--bg-elev)", border: "1px solid var(--border)" }}
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {t.createDialogTitle}
              </span>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md p-1 transition-colors hover:bg-hover"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={16} />
              </button>
            </div>
            <input
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void createProject(); }}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
              placeholder={t.createPlaceholder}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg px-3 py-2 text-xs transition-colors hover:text-fg"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void createProject()}
                className="rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-fg)" }}
              >
                {busy ? t.creating : t.createAndOpen}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
