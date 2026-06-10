import { useMemo, useState } from "react";
import { useSettingsStore } from "../../stores/settings-store";

const ONBOARDING_KEY = "zhiying.onboarding.done.v1";

type FocusRect = { top: string; left: string; width: string; height: string };
interface TourStep {
  title: string;
  description: string;
  focus: FocusRect;
}

const STEPS_ZH: TourStep[] = [
  {
    title: "导入素材",
    description: "先在左侧素材库导入视频/音频，然后拖到时间轴。",
    focus: { top: "64px", left: "8px", width: "220px", height: "68%" },
  },
  {
    title: "时间轴编辑",
    description: "在底部时间轴拖拽、裁剪、分割片段，完成主要编辑。",
    focus: { top: "72%", left: "8px", width: "95%", height: "24%" },
  },
  {
    title: "AI 与导出",
    description: "右上工具栏可打开 AI 助手与导出弹窗，快速完成成片。",
    focus: { top: "4px", left: "62%", width: "36%", height: "42px" },
  },
];
const STEPS_EN: TourStep[] = [
  {
    title: "Import Media",
    description: "Import video/audio in the left media panel, then drag to timeline.",
    focus: { top: "64px", left: "8px", width: "220px", height: "68%" },
  },
  {
    title: "Edit on Timeline",
    description: "Trim, split and move clips in the bottom timeline.",
    focus: { top: "72%", left: "8px", width: "95%", height: "24%" },
  },
  {
    title: "AI & Export",
    description: "Use toolbar to open AI assistant and export dialog quickly.",
    focus: { top: "4px", left: "62%", width: "36%", height: "42px" },
  },
];

function hasDoneOnboarding() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDING_KEY) === "1";
}

function markOnboardingDone() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_KEY, "1");
}

export function resetOnboardingDone() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ONBOARDING_KEY);
}

export function OnboardingTour() {
  const language = useSettingsStore((s) => s.language);
  const [visible, setVisible] = useState(() => !hasDoneOnboarding());
  const [step, setStep] = useState(0);
  const steps = language === "en" ? STEPS_EN : STEPS_ZH;

  const current = useMemo(() => steps[Math.max(0, Math.min(step, steps.length - 1))], [step, steps]);
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/35" />
      <div
        className="absolute rounded-xl border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
        style={current.focus}
      />
      <div className="pointer-events-auto absolute bottom-6 right-6 w-[360px] rounded-xl border border-border bg-bg-elev p-4 shadow-2xl animate-modal-pop">
        <div className="mb-1 text-sm font-semibold text-fg">{current.title}</div>
        <div className="mb-3 text-xs text-fg-2">{current.description}</div>
        <div className="mb-3 text-[11px] text-fg-muted">
          {step + 1} / {steps.length}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              markOnboardingDone();
              setVisible(false);
            }}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg"
          >
            {language === "en" ? "Skip" : "跳过"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (step >= steps.length - 1) {
                markOnboardingDone();
                setVisible(false);
                return;
              }
              setStep((s) => s + 1);
            }}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg hover:opacity-90"
          >
            {step >= steps.length - 1
              ? language === "en"
                ? "Done"
                : "完成"
              : language === "en"
                ? "Next"
                : "下一步"}
          </button>
        </div>
      </div>
    </div>
  );
}

