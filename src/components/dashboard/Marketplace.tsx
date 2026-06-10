import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  filterPresets,
  musicPresets,
  textStylePresets,
  transitionPresets,
  type TextStylePresetItem,
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

export function Marketplace() {
  const navigate = useNavigate();
  const language = useSettingsStore((s) => s.language);
  const text = language === "en"
    ? {
        title: "Marketplace (Lite)",
        sub: "Create a template project in one click",
        filter: "Filter Presets",
        transition: "Transition Presets",
        textStyle: "Text Style Presets",
        music: "Music Presets",
        create: "Create",
        createPreloaded: "Create + Preload",
        hintMusic:
          "Project created. Open editor and import this music from the Marketplace tab.",
        templatePrefix: "Template",
      }
    : {
        title: "素材市场（简版）",
        sub: "一键创建模板项目",
        filter: "滤镜预设",
        transition: "转场预设",
        textStyle: "字幕样式预设",
        music: "音乐预设",
        create: "创建",
        createPreloaded: "创建并预置",
        hintMusic: "已创建项目，进入编辑器后可在“市场”标签一键导入该音乐。",
        templatePrefix: "模板",
      };
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hint, setHint] = useState<string>("");

  const createBlankProject = async (name: string) => {
    const record = await createProjectRecord(name);
    navigate(`/editor/${record.id}`);
  };

  const createTextTemplateProject = async (preset: TextStylePresetItem) => {
    const record = await createProjectRecord(`${text.templatePrefix}-${preset.label}`);
    const clip = buildTextTemplateClip(preset);
    const next: StoredProjectRecord = {
      ...record,
      editor: {
        ...record.editor,
        clips: [clip],
        selectedClipId: clip.id,
        currentTime: 0,
      },
      lastOpened: Date.now(),
    };
    await saveProjectRecord(next);
    navigate(`/editor/${record.id}`);
  };

  return (
    <section className="mt-6 rounded-xl border border-border bg-bg-2 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-fg">{text.title}</div>
        <div className="text-[11px] text-fg-muted">{text.sub}</div>
      </div>
      {hint && <div className="mb-2 text-[11px] text-fg-muted">{hint}</div>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-bg-1 p-3">
          <div className="mb-2 text-xs text-fg-muted">{text.filter}</div>
          <div className="space-y-1">
            {filterPresets.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busyId !== null}
                onClick={async () => {
                  setBusyId(p.id);
                  setHint("");
                  try {
                    await createBlankProject(`${text.templatePrefix}-${p.label}`);
                  } finally {
                    setBusyId(null);
                  }
                }}
                className="flex w-full items-center justify-between rounded border border-border px-2 py-1 text-[11px] hover:bg-hover disabled:opacity-50"
              >
                <span>{p.label}</span>
                <span className="text-fg-muted">{text.create}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-1 p-3">
          <div className="mb-2 text-xs text-fg-muted">{text.transition}</div>
          <div className="space-y-1">
            {transitionPresets.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busyId !== null}
                onClick={async () => {
                  setBusyId(p.id);
                  setHint("");
                  try {
                    await createBlankProject(`${text.templatePrefix}-${p.label}`);
                  } finally {
                    setBusyId(null);
                  }
                }}
                className="flex w-full items-center justify-between rounded border border-border px-2 py-1 text-[11px] hover:bg-hover disabled:opacity-50"
              >
                <span>{p.label}</span>
                <span className="text-fg-muted">{text.create}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-1 p-3">
          <div className="mb-2 text-xs text-fg-muted">{text.textStyle}</div>
          <div className="space-y-1">
            {textStylePresets.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busyId !== null}
                onClick={async () => {
                  setBusyId(p.id);
                  setHint("");
                  try {
                    await createTextTemplateProject(p);
                  } finally {
                    setBusyId(null);
                  }
                }}
                className="flex w-full items-center justify-between rounded border border-border px-2 py-1 text-[11px] hover:bg-hover disabled:opacity-50"
              >
                <span>{p.label}</span>
                <span className="text-fg-muted">{text.createPreloaded}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-bg-1 p-3">
          <div className="mb-2 text-xs text-fg-muted">{text.music}</div>
          <div className="space-y-1">
            {musicPresets.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busyId !== null}
                onClick={async () => {
                  setBusyId(p.id);
                  try {
                    await createBlankProject(`${text.templatePrefix}-${p.label}`);
                    setHint(text.hintMusic);
                  } finally {
                    setBusyId(null);
                  }
                }}
                className="flex w-full items-center justify-between rounded border border-border px-2 py-1 text-[11px] hover:bg-hover disabled:opacity-50"
              >
                <span>{p.label}</span>
                <span className="text-fg-muted">{text.create}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

