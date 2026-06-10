import { useState } from "react";
import { FiltersPanel } from "./FiltersPanel";
import { TransitionPanel } from "./TransitionPanel";
import { TextEditor } from "./TextEditor";
import { SpeedEditor } from "./SpeedEditor";
import { KeyframeEditor } from "./KeyframeEditor";
import { MarketplacePanel } from "./MarketplacePanel";
import { useSettingsStore } from "../../stores/settings-store";

export function InspectorPanel() {
  const language = useSettingsStore((s) => s.language);
  const text =
    language === "en"
      ? {
          filters: "Filters",
          transitions: "Transitions",
          text: "Text",
          speed: "Speed",
          keyframes: "Keyframes",
          market: "Market",
        }
      : {
          filters: "滤镜",
          transitions: "转场",
          text: "字幕",
          speed: "速度",
          keyframes: "关键帧",
          market: "市场",
        };
  const [tab, setTab] = useState<
    "filters" | "transitions" | "text" | "speed" | "keyframes" | "market"
  >("filters");
  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-border px-2 py-1">
        <button
          type="button"
          className={`rounded px-2 py-1 text-[11px] ${tab === "filters" ? "bg-bg-2 text-fg" : "text-fg-muted hover:bg-hover"}`}
          onClick={() => setTab("filters")}
        >
          {text.filters}
        </button>
        <button
          type="button"
          className={`ml-1 rounded px-2 py-1 text-[11px] ${tab === "transitions" ? "bg-bg-2 text-fg" : "text-fg-muted hover:bg-hover"}`}
          onClick={() => setTab("transitions")}
        >
          {text.transitions}
        </button>
        <button
          type="button"
          className={`ml-1 rounded px-2 py-1 text-[11px] ${tab === "text" ? "bg-bg-2 text-fg" : "text-fg-muted hover:bg-hover"}`}
          onClick={() => setTab("text")}
        >
          {text.text}
        </button>
        <button
          type="button"
          className={`ml-1 rounded px-2 py-1 text-[11px] ${tab === "speed" ? "bg-bg-2 text-fg" : "text-fg-muted hover:bg-hover"}`}
          onClick={() => setTab("speed")}
        >
          {text.speed}
        </button>
        <button
          type="button"
          className={`ml-1 rounded px-2 py-1 text-[11px] ${tab === "keyframes" ? "bg-bg-2 text-fg" : "text-fg-muted hover:bg-hover"}`}
          onClick={() => setTab("keyframes")}
        >
          {text.keyframes}
        </button>
        <button
          type="button"
          className={`ml-1 rounded px-2 py-1 text-[11px] ${tab === "market" ? "bg-bg-2 text-fg" : "text-fg-muted hover:bg-hover"}`}
          onClick={() => setTab("market")}
        >
          {text.market}
        </button>
      </div>
      <div className="h-[calc(100%-34px)]">
        {tab === "filters" ? (
          <FiltersPanel />
        ) : tab === "transitions" ? (
          <TransitionPanel />
        ) : tab === "text" ? (
          <TextEditor />
        ) : tab === "speed" ? (
          <SpeedEditor />
        ) : tab === "market" ? (
          <MarketplacePanel />
        ) : (
          <KeyframeEditor />
        )}
      </div>
    </div>
  );
}
