import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sliders, Zap, Type, Music, Plus, Loader } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  filterPresets,
  musicPresets,
  textStylePresets,
  transitionPresets,
  type FilterPresetItem,
  type MusicPresetItem,
  type TextStylePresetItem,
  type TransitionPresetItem,
} from "../../lib/assets/presets";
import { createProjectRecord, saveProjectRecord, type StoredProjectRecord } from "../../lib/storage";
import { useSettingsStore } from "../../stores/settings-store";

function buildTextTemplateClip(preset: TextStylePresetItem) {
  const id = `clip-${crypto.randomUUID()}`;
  const start = 1;
  const end = 4;
  return {
    id,
    type: "text" as const,
    src: "",
    start,
    end,
    sourceStart: start,
    sourceEnd: end,
    trackIndex: 2,
    name: "字幕",
    content: preset.content,
    fontSize: preset.fontSize,
    fontFamily: preset.fontFamily,
    color: preset.color,
    stroke: preset.stroke,
    shadow: preset.shadow,
    position: { x: 0.5, y: 0.82 },
    animation: preset.animation,
  };
}

type Category = "filter" | "transition" | "textStyle" | "music" | "knowledge";

const KNOWLEDGE_TEMPLATES = [
  { id: "insurance_knowledge", emoji: "🛡️", name: { zh: "保险知识科普", en: "Insurance Knowledge" }, desc: { zh: "重疾险、医疗险等专业知识分享视频模板", en: "Health & life insurance knowledge video template" }, grad: "linear-gradient(135deg,#2563eb,#1e40af)" },
  { id: "immigration_tips", emoji: "✈️", name: { zh: "移民知识分享", en: "Immigration Tips" }, desc: { zh: "移民政策、生活指南等知识分享视频模板", en: "Immigration policy and lifestyle tips video template" }, grad: "linear-gradient(135deg,#059669,#064e3b)" },
  { id: "financial_planning", emoji: "📊", name: { zh: "理财规划建议", en: "Financial Planning" }, desc: { zh: "养老规划、投资理财等专业建议视频模板", en: "Retirement and investment planning video template" }, grad: "linear-gradient(135deg,#7c3aed,#4c1d95)" },
];

const CATEGORIES: { id: Category; icon: LucideIcon; label: { en: string; zh: string }; color: string }[] = [
  { id: "filter",     icon: Sliders,   label: { en: "Filters",    zh: "滤镜"   }, color: "#0066ff" },
  { id: "transition", icon: Zap,       label: { en: "Transitions", zh: "转场"   }, color: "#8b5cf6" },
  { id: "textStyle",  icon: Type,      label: { en: "Text Styles", zh: "字幕样式" }, color: "#f59e0b" },
  { id: "music",      icon: Music,     label: { en: "Music",       zh: "音乐"   }, color: "#10b981" },
  { id: "knowledge",  icon: Zap,       label: { en: "Knowledge Video", zh: "知识视频" }, color: "#2563eb" },
];

// ─── Knowledge Video Template Card ────────────────────────────────

function KnowledgeTemplateCard({
  template,
  isEn,
  loading,
  disabled,
  onCreate,
}: {
  template: typeof KNOWLEDGE_TEMPLATES[number];
  isEn: boolean;
  loading: boolean;
  disabled: boolean;
  onCreate: () => void;
}) {
  const createLabel = isEn ? "Create Project" : "创建项目";

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl transition-shadow hover:shadow-md"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      <div className="relative flex h-28 items-center justify-center" style={{ background: template.grad }}>
        <span className="text-3xl">{template.emoji}</span>
        <span className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>9:16</span>
        <span className="absolute left-2 bottom-2 rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>60-90s</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          {isEn ? template.name.en : template.name.zh}
        </div>
        <div className="line-clamp-2 text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {isEn ? template.desc.en : template.desc.zh}
        </div>
        <button
          type="button" disabled={disabled} onClick={onCreate}
          className="mt-auto flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
          style={{ backgroundColor: "#2563eb" }}
        >
          {loading ? <Loader size={11} className="animate-spin" /> : <Plus size={11} />}
          {createLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Shared spinner ───────────────────────────────────────────────

function Spinner() {
  return (
    <div
      className="h-3 w-3 animate-spin rounded-full"
      style={{ border: "2px solid #fff", borderTopColor: "transparent" }}
    />
  );
}

// ─── Filter Card ─────────────────────────────────────────────────

function FilterCard({
  preset, createLabel, loading, disabled, onCreate,
}: {
  preset: FilterPresetItem;
  createLabel: string;
  loading: boolean;
  disabled: boolean;
  onCreate: () => void;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl transition-shadow hover:shadow-md"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      <div
        className="h-24 w-full"
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          filter: preset.previewCss,
        }}
      />
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {preset.label}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onCreate}
          className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ backgroundColor: "#0066ff", color: "#fff" }}
          title={createLabel}
        >
          {loading ? <Spinner /> : <Plus size={12} />}
        </button>
      </div>
    </div>
  );
}

// ─── Transition Card ─────────────────────────────────────────────

const TRANSITION_BG: Record<string, string> = {
  crossDissolve: "linear-gradient(90deg, #0066ff 0%, rgba(0,102,255,0.1) 50%, #0066ff 100%)",
  fade:          "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  slide:         "linear-gradient(90deg, #8b5cf6 0%, rgba(139,92,246,0.15) 50%, #8b5cf6 100%)",
  wipe:          "linear-gradient(105deg, #8b5cf6 0%, #8b5cf6 45%, rgba(139,92,246,0.15) 55%, transparent 100%)",
};

function TransitionCard({
  preset, createLabel, loading, disabled, onCreate,
}: {
  preset: TransitionPresetItem;
  createLabel: string;
  loading: boolean;
  disabled: boolean;
  onCreate: () => void;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl transition-shadow hover:shadow-md"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      <div
        className="h-24 w-full"
        style={{ background: TRANSITION_BG[preset.type] ?? "linear-gradient(135deg, #8b5cf6 0%, #0066ff 100%)" }}
      />
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {preset.label}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onCreate}
          className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ backgroundColor: "#8b5cf6", color: "#fff" }}
          title={createLabel}
        >
          {loading ? <Spinner /> : <Plus size={12} />}
        </button>
      </div>
    </div>
  );
}

// ─── Text Style Card ─────────────────────────────────────────────

function TextStyleCard({
  preset, createLabel, loading, disabled, onCreate,
}: {
  preset: TextStylePresetItem;
  createLabel: string;
  loading: boolean;
  disabled: boolean;
  onCreate: () => void;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl transition-shadow hover:shadow-md"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      <div
        className="flex h-24 w-full items-center justify-center overflow-hidden"
        style={{ backgroundColor: "#0d0d0d" }}
      >
        <span
          style={{
            color: preset.color,
            fontFamily: preset.fontFamily,
            fontSize: Math.min(preset.fontSize * 0.22, 26) + "px",
            fontWeight: "bold",
            textShadow: preset.shadow
              ? `${preset.shadow.offsetX}px ${preset.shadow.offsetY}px ${preset.shadow.blur}px ${preset.shadow.color}`
              : undefined,
            WebkitTextStroke: preset.stroke
              ? `${Math.max(0.8, preset.stroke.width * 0.3)}px ${preset.stroke.color}`
              : undefined,
          }}
        >
          {preset.content.slice(0, 6)}
        </span>
      </div>
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {preset.label}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onCreate}
          className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ backgroundColor: "#f59e0b", color: "#fff" }}
          title={createLabel}
        >
          {loading ? <Spinner /> : <Plus size={12} />}
        </button>
      </div>
    </div>
  );
}

// ─── Music Card ──────────────────────────────────────────────────

const WAVEFORM_HEIGHTS = [4, 14, 9, 20, 7, 16, 11, 18, 6, 15, 10, 19, 8, 17, 12];

function MusicCard({
  preset, createLabel, loading, disabled, onCreate,
}: {
  preset: MusicPresetItem;
  createLabel: string;
  loading: boolean;
  disabled: boolean;
  onCreate: () => void;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl transition-shadow hover:shadow-md"
      style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      <div
        className="flex h-24 w-full items-center justify-center"
        style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)" }}
      >
        <svg width="84" height="36" viewBox="0 0 84 36">
          {WAVEFORM_HEIGHTS.map((h, i) => (
            <rect
              key={i}
              x={i * 5.5 + 2}
              y={(36 - h) / 2}
              width={3.5}
              height={h}
              rx={1.75}
              fill="rgba(255,255,255,0.75)"
            />
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>
          {preset.label}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onCreate}
          className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ backgroundColor: "#10b981", color: "#fff" }}
          title={createLabel}
        >
          {loading ? <Spinner /> : <Plus size={12} />}
        </button>
      </div>
    </div>
  );
}

// ─── Marketplace ─────────────────────────────────────────────────

export function Marketplace() {
  const navigate = useNavigate();
  const language = useSettingsStore((s) => s.language);
  const isEn = language === "en";
  const [activeCategory, setActiveCategory] = useState<Category>("game");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  const t = isEn
    ? {
        sectionTitle: "Template Library",
        sectionSub: "One-click project creation from preset templates",
        createLabel: "Create",
        createPreloadedLabel: "Use Template",
        templatePrefix: "Template",
        hintMusic: "Project created. Open editor and import music from the Marketplace tab.",
      }
    : {
        sectionTitle: "模板库",
        sectionSub: "从预设模板一键创建项目",
        createLabel: "创建项目",
        createPreloadedLabel: "创建并预置",
        templatePrefix: "模板",
        hintMusic: "已创建项目，进入编辑器后可在「市场」标签一键导入该音乐。",
      };

  const createBlankProject = async (name: string) => {
    const record = await createProjectRecord(name);
    navigate(`/editor/${record.id}`);
  };

  const createTextTemplateProject = async (preset: TextStylePresetItem) => {
    const record = await createProjectRecord(`${t.templatePrefix}-${preset.label}`);
    const clip = buildTextTemplateClip(preset);
    const next: StoredProjectRecord = {
      ...record,
      editor: { ...record.editor, clips: [clip], selectedClipId: clip.id, currentTime: 0 },
      lastOpened: Date.now(),
    };
    await saveProjectRecord(next);
    navigate(`/editor/${record.id}`);
  };

  return (
    <div>
      {/* Section header */}
      <div className="mb-6">
        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {t.sectionTitle}
        </div>
        <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
          {t.sectionSub}
        </div>
      </div>

      {/* Category tabs */}
      <div
        className="mb-6 flex w-fit items-center gap-1 rounded-xl p-1"
        style={{ backgroundColor: "var(--bg-secondary)" }}
      >
        {CATEGORIES.map(({ id, icon: Icon, label, color }) => {
          const isActive = activeCategory === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveCategory(id)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all"
              style={{
                backgroundColor: isActive ? "var(--bg-primary)" : "transparent",
                color: isActive ? color : "var(--text-muted)",
                boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.14)" : "none",
              }}
            >
              <Icon size={13} />
              {label[isEn ? "en" : "zh"]}
            </button>
          );
        })}
      </div>

      {/* Hint */}
      {hint && (
        <div
          className="mb-5 rounded-xl px-4 py-2.5 text-xs"
          style={{
            backgroundColor: "color-mix(in srgb, #10b981 10%, var(--bg-secondary))",
            color: "var(--text-primary)",
            border: "1px solid color-mix(in srgb, #10b981 30%, transparent)",
          }}
        >
          {hint}
        </div>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {activeCategory === "filter" &&
          filterPresets.map((p) => (
            <FilterCard
              key={p.id}
              preset={p}
              createLabel={t.createLabel}
              loading={busyId === p.id}
              disabled={busyId !== null}
              onCreate={async () => {
                setBusyId(p.id);
                setHint("");
                try { await createBlankProject(`${t.templatePrefix}-${p.label}`); }
                finally { setBusyId(null); }
              }}
            />
          ))}

        {activeCategory === "transition" &&
          transitionPresets.map((p) => (
            <TransitionCard
              key={p.id}
              preset={p}
              createLabel={t.createLabel}
              loading={busyId === p.id}
              disabled={busyId !== null}
              onCreate={async () => {
                setBusyId(p.id);
                setHint("");
                try { await createBlankProject(`${t.templatePrefix}-${p.label}`); }
                finally { setBusyId(null); }
              }}
            />
          ))}

        {activeCategory === "textStyle" &&
          textStylePresets.map((p) => (
            <TextStyleCard
              key={p.id}
              preset={p}
              createLabel={t.createPreloadedLabel}
              loading={busyId === p.id}
              disabled={busyId !== null}
              onCreate={async () => {
                setBusyId(p.id);
                setHint("");
                try { await createTextTemplateProject(p); }
                finally { setBusyId(null); }
              }}
            />
          ))}

        {activeCategory === "music" &&
          musicPresets.map((p) => (
            <MusicCard
              key={p.id}
              preset={p}
              createLabel={t.createLabel}
              loading={busyId === p.id}
              disabled={busyId !== null}
              onCreate={async () => {
                setBusyId(p.id);
                try {
                  await createBlankProject(`${t.templatePrefix}-${p.label}`);
                  setHint(t.hintMusic);
                } finally {
                  setBusyId(null);
                }
              }}
            />
          ))}

        {activeCategory === "knowledge" &&
          KNOWLEDGE_TEMPLATES.map((tpl) => (
            <KnowledgeTemplateCard
              key={tpl.id}
              template={tpl}
              isEn={isEn}
              loading={busyId === tpl.id}
              disabled={busyId !== null}
              onCreate={async () => {
                setBusyId(tpl.id);
                setHint("");
                try {
                  await createBlankProject(isEn ? tpl.name.en : tpl.name.zh);
                  setHint(isEn
                    ? `Project created. Use the AI chat (bottom-right) to start creating. Say: "Make a video about ${tpl.name.en.toLowerCase()}".`
                    : `项目已创建。使用右下角 AI 助手开始创作。输入："帮我做一个${tpl.name.zh}视频"即可。`
                  );
                } finally {
                  setBusyId(null);
                }
              }}
            />
          ))}
      </div>
    </div>
  );
}
