import { useState } from "react";
import { FiltersPanel } from "./FiltersPanel";
import { TransitionPanel } from "./TransitionPanel";
import { TextEditor } from "./TextEditor";
import { SpeedEditor } from "./SpeedEditor";
import { KeyframeEditor } from "./KeyframeEditor";

export function InspectorPanel() {
  const [tab, setTab] = useState<
    "filters" | "transitions" | "text" | "speed" | "keyframes"
  >("filters");
  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-border px-2 py-1">
        <button
          type="button"
          className={`rounded px-2 py-1 text-[11px] ${tab === "filters" ? "bg-bg-2 text-fg" : "text-fg-muted hover:bg-hover"}`}
          onClick={() => setTab("filters")}
        >
          滤镜
        </button>
        <button
          type="button"
          className={`ml-1 rounded px-2 py-1 text-[11px] ${tab === "transitions" ? "bg-bg-2 text-fg" : "text-fg-muted hover:bg-hover"}`}
          onClick={() => setTab("transitions")}
        >
          转场
        </button>
        <button
          type="button"
          className={`ml-1 rounded px-2 py-1 text-[11px] ${tab === "text" ? "bg-bg-2 text-fg" : "text-fg-muted hover:bg-hover"}`}
          onClick={() => setTab("text")}
        >
          字幕
        </button>
        <button
          type="button"
          className={`ml-1 rounded px-2 py-1 text-[11px] ${tab === "speed" ? "bg-bg-2 text-fg" : "text-fg-muted hover:bg-hover"}`}
          onClick={() => setTab("speed")}
        >
          速度
        </button>
        <button
          type="button"
          className={`ml-1 rounded px-2 py-1 text-[11px] ${tab === "keyframes" ? "bg-bg-2 text-fg" : "text-fg-muted hover:bg-hover"}`}
          onClick={() => setTab("keyframes")}
        >
          关键帧
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
        ) : (
          <KeyframeEditor />
        )}
      </div>
    </div>
  );
}
