from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from tools.base_tool import BaseTool, ToolResult, ToolRuntime, ToolTier

# ─────────────────────────────────────────────────────────────────────────────
# UNTESTED — see skills/core/resolve-control.md's banner. This module was
# written against the Resolve Scripting API docs and davinci-resolve-mcp's
# README on a machine WITHOUT Resolve installed (2026-09-16). The first run
# on a real Resolve must follow that skill's verification checklist and fix
# whatever differs. It is shipped dependency-gated and clearly marked rather
# than not shipped at all, so the pipeline can reference it the day a
# Resolve machine exists.
# ─────────────────────────────────────────────────────────────────────────────

# Where a default Windows Resolve install exposes its scripting module
# (MODULE dir must be on PYTHONPATH for `import DaVinciResolveScript`).
_DEFAULT_MODULE_DIR = (
    Path(r"C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\MODULE")
)


def _load_resolve_api():
    """Imports DaVinciResolveScript, adding the default Windows MODULE dir
    to sys.path if needed. Raises ImportError with actionable text."""
    try:
        import DaVinciResolveScript  # noqa: F401

        return DaVinciResolveScript
    except ImportError:
        pass
    if _DEFAULT_MODULE_DIR.is_dir() and str(_DEFAULT_MODULE_DIR) not in sys.path:
        sys.path.insert(0, str(_DEFAULT_MODULE_DIR))
    try:
        import DaVinciResolveScript

        return DaVinciResolveScript
    except ImportError as exc:
        raise ImportError(
            "DaVinciResolveScript not importable — Resolve installed? "
            "(Studio needed for external control; free version scripts "
            "must run from inside Resolve. "
            "See skills/core/resolve-control.md.)"
        ) from exc


class ResolveControlTool(BaseTool):
    """Thin live-control layer over a RUNNING DaVinci Resolve (Route B in
    skills/core/resolve-control.md — prefer davinci-resolve-mcp, Route A,
    when available). Minimal surface: connect, import one of our FCPXML
    timelines, queue a render, poll jobs. Destructive operations are NOT
    implemented on purpose: adopt the MCP's plan->confirm model before
    adding any."""

    name = "resolve_control"
    capability = "nle_live_control"
    provider = "davinci-resolve-scripting"
    tier = ToolTier.LOCAL
    runtime = ToolRuntime.PYTHON
    description = (
        "Drive a running DaVinci Resolve: create project, import an "
        "otio_timeline-produced FCPXML, queue renders, poll job status."
    )
    best_for = ["live NLE control once Resolve is running on this machine"]
    not_good_for = [
        "headless/CI boxes (Resolve cannot run headless)",
        "destructive project management (deliberately not implemented)",
    ]
    dependencies = []

    def execute(
        self,
        action: str,
        fcpxml_path: Path | None = None,
        project_name: str = "zhiying_handoff",
        render_preset: str | None = None,
        output_dir: Path | None = None,
    ) -> ToolResult:
        try:
            dvr = _load_resolve_api()
        except ImportError as exc:
            return ToolResult(success=False, error=str(exc))

        resolve = dvr.scriptapp("external")
        if resolve is None:
            return ToolResult(
                success=False,
                error="could not attach to a running Resolve (is it open? "
                "Studio + external scripting enabled in Preferences?)",
            )

        if action == "connect":
            return ToolResult(
                success=True,
                metadata={
                    "resolve_version": resolve.GetVersionString(),
                    "api": "DaVinciResolveScript:external",
                },
            )

        pm = resolve.GetProjectManager()

        if action == "import_timeline":
            if fcpxml_path is None or not Path(fcpxml_path).exists():
                return ToolResult(success=False, error=f"fcpxml not found: {fcpxml_path}")
            project = pm.CreateProject(project_name)
            if project is None:
                project = pm.LoadProject(project_name)
            if project is None:
                return ToolResult(success=False, error=f"could not create/load project {project_name!r}")
            media_pool = project.GetMediaPool()
            imported = media_pool.ImportMedia([str(Path(fcpxml_path).resolve())])
            timeline = project.GetCurrentTimeline()
            if timeline is None:
                return ToolResult(
                    success=False,
                    error="ImportMedia returned no timeline — FCPXML rejected?",
                    metadata={"imported": imported},
                )
            return ToolResult(
                success=True,
                metadata={
                    "project": project.GetName(),
                    "timeline": timeline.GetName(),
                    "duration_frames": timeline.GetEndFrame() - timeline.GetStartFrame(),
                },
            )

        if action == "render":
            project = pm.GetCurrentProject()
            if project is None:
                return ToolResult(success=False, error="no current project open in Resolve")
            if render_preset:
                if not project.LoadRenderPreset(render_preset):
                    return ToolResult(success=False, error=f"preset not found: {render_preset}")
            settings: dict[str, Any] = {}
            if output_dir is not None:
                settings["TargetDir"] = str(Path(output_dir).resolve())
                Path(output_dir).mkdir(parents=True, exist_ok=True)
            if settings:
                project.SetRenderSettings(settings)
            job_id = project.AddRenderJob()
            return ToolResult(success=True, metadata={"job_id": job_id})

        if action == "render_status":
            project = pm.GetCurrentProject()
            if project is None:
                return ToolResult(success=False, error="no current project open in Resolve")
            return ToolResult(success=True, metadata={"jobs": project.GetRenderJobList()})

        return ToolResult(
            success=False,
            error=f"unknown action {action!r}; valid: connect, import_timeline, render, render_status",
        )

    def estimate_cost(self, **kwargs: Any) -> float:
        return 0.0  # local software, rendering is CPU/GPU time not money
