import { Undo2, Redo2, Scissors, Plus, Layout, MessageSquare, Download, Clock3 } from "lucide-react";
import { useEditorStore } from "../../stores/editor-store";

export function Toolbar({ trailing }: { trailing?: React.ReactNode }) {
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
        <span className="text-xs text-fg-muted">未命名项目</span>
      </div>

      {/* Center */}
      <div className="flex items-center gap-1">
        <ToolButton icon={<Undo2 size={15} />} tooltip="撤销 (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
        <ToolButton icon={<Redo2 size={15} />} tooltip="重做 (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} />
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolButton icon={<Scissors size={15} />} tooltip="分割 (Ctrl+B)" onClick={handleSplit} />
        <ToolButton icon={<Plus size={15} />} tooltip="添加素材" />
        <ToolButton icon={<Download size={15} />} tooltip="导出视频" onClick={toggleExportDialog} />
        <ToolButton
          icon={<Clock3 size={15} />}
          tooltip={`时间格式 (${timeDisplayMode === "clock" ? "mm:ss" : "秒数.sss"}) · Shift+T`}
          onClick={toggleTimeDisplayMode}
        />
        <span className="ml-2 text-[10px] text-fg-muted">
          标记: M / Shift+M
        </span>
        <span className="ml-2 text-[10px] text-fg-muted">
          导航: ←/→ · Shift+←/→ · Home/End
        </span>
        <span className="ml-2 text-[10px] text-fg-muted">
          播放: J/K/L (1x/2x/4x) · Shift+J/L 直达4x
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        <ToolButton icon={<Layout size={15} />} tooltip="面板" onClick={toggleMediaPanel} />
        <ToolButton icon={<MessageSquare size={15} />} tooltip="AI 助手" onClick={toggleChatBox} />
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
