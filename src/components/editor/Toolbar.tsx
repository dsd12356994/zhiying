import { Undo2, Redo2, Scissors, Plus, Layout, MessageSquare, Download, Clock3, Settings } from "lucide-react";
import { useEditorStore } from "../../stores/editor-store";
import { useSettingsStore } from "../../stores/settings-store";

export function Toolbar({
  trailing,
  onOpenSettings,
}: {
  trailing?: React.ReactNode;
  onOpenSettings?: () => void;
}) {
  const {
    toggleMediaPanel,
    toggleChatBox,
    toggleExportDialog,
    splitAtPlayhead,
    selectedClipId,
    undo,
    redo,
    canUndo,
    canRedo,
    timeDisplayMode,
    toggleTimeDisplayMode,
  } = useEditorStore();
  const language = useSettingsStore((s) => s.language);
  const text =
    language === "en"
      ? {
          untitled: "Untitled",
          undo: "Undo",
          redo: "Redo",
          split: "Split",
          addMedia: "Add Media",
          export: "Export",
          timeFormat: "Time format",
          marker: "Marker",
          navigation: "Navigation",
          playback: "Playback",
          panel: "Panels",
          ai: "AI Assistant",
          settings: "Settings",
          secFmt: "seconds.sss",
        }
      : {
          untitled: "未命名项目",
          undo: "撤销",
          redo: "重做",
          split: "分割",
          addMedia: "添加素材",
          export: "导出视频",
          timeFormat: "时间格式",
          marker: "标记",
          navigation: "导航",
          playback: "播放",
          panel: "面板",
          ai: "AI 助手",
          settings: "设置",
          secFmt: "秒数.sss",
        };

  const handleSplit = () => {
    if (selectedClipId) {
      splitAtPlayhead();
    }
  };

  return (
    <header className="flex h-10 items-center justify-between border-b border-border bg-bg px-3">
      {/* Left */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold tracking-wide text-accent">智映</span>
        <span className="text-xs text-fg-muted">{text.untitled}</span>
      </div>

      {/* Center */}
      <div className="flex items-center gap-1">
        <ToolButton icon={<Undo2 size={15} />} tooltip={`${text.undo} (Ctrl+Z)`} onClick={undo} disabled={!canUndo} />
        <ToolButton icon={<Redo2 size={15} />} tooltip={`${text.redo} (Ctrl+Shift+Z)`} onClick={redo} disabled={!canRedo} />
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolButton icon={<Scissors size={15} />} tooltip={`${text.split} (Ctrl+B)`} onClick={handleSplit} />
        <ToolButton icon={<Plus size={15} />} tooltip={text.addMedia} />
        <ToolButton icon={<Download size={15} />} tooltip={text.export} onClick={toggleExportDialog} />
        <ToolButton
          icon={<Clock3 size={15} />}
          tooltip={`${text.timeFormat} (${timeDisplayMode === "clock" ? "mm:ss" : text.secFmt}) · Shift+T`}
          onClick={toggleTimeDisplayMode}
        />
        <span className="ml-2 text-[10px] text-fg-muted">
          {text.marker}: M / Shift+M
        </span>
        <span className="ml-2 text-[10px] text-fg-muted">
          {text.navigation}: ←/→ · Shift+←/→ · Home/End
        </span>
        <span className="ml-2 text-[10px] text-fg-muted">
          {text.playback}: J/K/L (1x/2x/4x) · Shift+J/L 4x
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <ToolButton icon={<Layout size={15} />} tooltip={text.panel} onClick={toggleMediaPanel} />
        <ToolButton icon={<MessageSquare size={15} />} tooltip={text.ai} onClick={toggleChatBox} />
        <ToolButton icon={<Settings size={15} />} tooltip={text.settings} onClick={onOpenSettings} />
        {trailing}
      </div>
    </header>
  );
}

function ToolButton({
  icon, tooltip, onClick, disabled,
}: {
  icon: React.ReactNode;
  tooltip?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className="flex h-7 w-7 items-center justify-center rounded-md text-fg-2 transition-colors hover:bg-hover hover:text-fg active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {icon}
    </button>
  );
}
