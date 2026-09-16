from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Any

from tools.base_tool import BaseTool, ToolResult, ToolRuntime, ToolTier

# Supported NLE timeline export targets, mapped straight onto auto-editor's
# --export flag. Verified against auto-editor's CLI (docs: auto-editor.com;
# repo: WyattBlue/auto-editor, Unlicense -- see
# zhiying/docs/research/ai-video-editing-landscape.md §3.2).
_EXPORT_TARGETS = {
    "premiere": "premiere",
    "resolve": "resolve",
    "final-cut-pro": "final-cut-pro",
    "shotcut": "shotcut",
    "kdenlive": "kdenlive",
}


class AutoEditorTool(BaseTool):
    """First bridge from zhiying's agent pipeline to real NLEs.

    Wraps the auto-editor CLI (pip install auto-editor) for two jobs:
      1. rough_cut  -- render the cut video/audio (first-pass assembly)
      2. timeline   -- export an NLE timeline file the user can open and
                       keep editing in their editor of choice

    Ground rules baked in (from skills/core/nle-timeline-export.md):
      - Source media is immutable: outputs always go to <output_dir>, never
        next to the input. auto-editor itself never writes to the input, but
        we enforce a separate output_dir anyway so downstream checkpoints
        have one canonical place to look.
      - This is a "first pass" tool: silence/motion detection only, no
        semantic understanding (its own README says the same). The agent's
        scene_plan stays the creative authority.
    """

    name = "auto_editor"
    capability = "rough_cut"
    provider = "auto-editor"
    tier = ToolTier.LOCAL
    runtime = ToolRuntime.SUBPROCESS
    description = (
        "Silence/motion-detected rough cut + NLE timeline export "
        "(Premiere/Resolve/FCP/Shotcut/Kdenlive) via the auto-editor CLI."
    )
    best_for = [
        "cutting dead air / silent segments from talking-head footage",
        "first-pass assembly before creative editing",
        "handing the agent's cut decision list to a human editor as a timeline",
    ]
    not_good_for = [
        "semantic editing decisions (which take is best, story beats)",
        "effects, color, or anything beyond cut/speed decisions",
    ]
    dependencies = ["cmd:auto-editor"]

    def execute(
        self,
        input_path: Path,
        output_dir: Path,
        mode: str = "timeline",
        export: str = "resolve",
        edit: str = "audio:threshold=4%",
        margin: str = "0.2sec",
        extra_args: list[str] | None = None,
    ) -> ToolResult:
        """Run auto-editor.

        mode:   "timeline" -> write an NLE timeline file (no media re-encode)
                "render"   -> render the cut media file
        export: NLE target for mode="timeline" (see _EXPORT_TARGETS keys)
        edit:   auto-editor edit rule, e.g. "audio:threshold=4%",
                "motion:threshold=3", or combined with 'or'/'and'
        margin: padding around kept segments (keeps cuts from feeling abrupt)
        """
        self.check_dependencies()

        input_path = Path(input_path)
        output_dir = Path(output_dir)
        if not input_path.exists():
            return ToolResult(success=False, error=f"input not found: {input_path}")

        if mode not in ("timeline", "render"):
            return ToolResult(success=False, error=f"unknown mode {mode!r}")
        if mode == "timeline" and export not in _EXPORT_TARGETS:
            return ToolResult(
                success=False,
                error=f"unknown export target {export!r}; valid: {sorted(_EXPORT_TARGETS)}",
            )

        output_dir.mkdir(parents=True, exist_ok=True)
        cmd: list[str] = ["auto-editor", str(input_path), "--edit", edit, "--margin", margin]

        if mode == "timeline":
            # auto-editor's --output is a base path, NOT a directory: it
            # appends its own extension (.fcpxml / .xml / .mlt) per target.
            # Passing the bare output_dir made it write a sibling file NEXT
            # TO the dir (real bug found by live test 2026-09-16). Give it a
            # base name inside output_dir so the artifact lands where the
            # checkpoint contract says it does.
            base = output_dir / f"{input_path.stem}_{export}"
            cmd += ["--export", _EXPORT_TARGETS[export], "--output", str(base)]
        else:
            out_file = output_dir / f"{input_path.stem}_cut{input_path.suffix}"
            cmd += ["-o", str(out_file)]

        if extra_args:
            cmd += extra_args

        # Encoding must be pinned: on zh-CN Windows the default is GBK and
        # auto-editor's UTF-8 progress output crashes subprocess's reader
        # thread (UnicodeDecodeError, found by live test 2026-09-16).
        proc = subprocess.run(
            cmd, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=1800,
        )
        if proc.returncode != 0:
            return ToolResult(
                success=False,
                error=f"auto-editor exited {proc.returncode}: {proc.stderr[-2000:]}",
                metadata={"cmd": cmd},
            )

        produced = [
            str(p) for p in sorted(output_dir.iterdir()) if p.is_file()
        ] if output_dir.is_dir() else []

        # output_path must point at THIS call's artifact, not whatever else
        # lives in output_dir (live-test bug 2026-09-16: two calls sharing
        # one dir made output_path an .mp4 when timeline mode was asked for).
        if mode == "timeline":
            base_stem = f"{input_path.stem}_{export}"
            own = [p for p in produced if Path(p).stem == base_stem]
        else:
            own = [p for p in produced if Path(p).name == f"{input_path.stem}_cut{input_path.suffix}"]
        output_path = Path(own[0]) if own else None

        return ToolResult(
            success=True,
            output_path=output_path,
            metadata={
                "cmd": cmd,
                "mode": mode,
                "export": export if mode == "timeline" else None,
                "produced": produced,
            },
        )

    def estimate_cost(self, **kwargs: Any) -> float:
        return 0.0  # fully local
