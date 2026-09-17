from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

from tools.base_tool import BaseTool, ToolResult, ToolRuntime, ToolTier


def _resolve_bin(name: str) -> str:
    """Resolves a CLI name to a full path. On Windows the executable is
    npx.cmd, and subprocess without shell=True cannot find the bare name
    (live-test bug 2026-09-16: FileNotFoundError WinError 2)."""
    return shutil.which(name) or shutil.which(f"{name}.cmd") or name


# Composition id -> (default props, canvas) for the render targets this repo
# ships. The agent picks one and passes props; remotion does the rest.
COMPOSITIONS = {
    "CinematicTrailer": {"width": 1920, "height": 1080},
    "Spotlight": {"width": 720, "height": 1280},
    "LottieSmokeTest": {"width": 800, "height": 800},
}

# codec presets: name -> extra CLI args. "alpha" is the overlay path
# (motion-graphics drop-on-top-of-footage -- see skills/core/
# motion-graphics-overlay.md; both formats verified live 2026-09-16).
CODEC_PRESETS: dict[str, list[str]] = {
    "h264": ["--codec=h264"],
    "prores4444-alpha": [
        "--codec=prores", "--prores-profile=4444",
        "--image-format=png", "--pixel-format=yuva444p10le",
    ],
    "vp9-webm": ["--codec=vp9", "--image-format=png"],
}


class RemotionRenderTool(BaseTool):
    """Renders a composer composition from JSON props — the last mile of
    "any AI -> validated spec -> finished video". Wraps the Remotion CLI
    instead of a bespoke node script so every Remotion flag stays
    available to the agent (concurrency, codecs, frame ranges)."""

    name = "remotion_render"
    capability = "video_render"
    provider = "remotion"
    tier = ToolTier.LOCAL
    runtime = ToolRuntime.SUBPROCESS
    description = (
        "Render a Remotion composition (CinematicTrailer | Spotlight | "
        "LottieSmokeTest) from a props dict, h264 or alpha-preserving codecs."
    )
    best_for = [
        "turning an authored props spec into an mp4/mov",
        "transparent overlay clips (prores4444-alpha)",
    ]
    not_good_for = ["timeline editing -- that's the NLE/OTIO stage, not this"]
    dependencies = ["cmd:npx"]

    def execute(
        self,
        composition: str,
        props: dict[str, Any],
        output_path: Path,
        codec: str = "h264",
        composer_dir: Path | None = None,
        extra_args: list[str] | None = None,
    ) -> ToolResult:
        self.check_dependencies()
        if composition not in COMPOSITIONS:
            return ToolResult(
                success=False,
                error=f"unknown composition {composition!r}; known: {sorted(COMPOSITIONS)}",
            )
        if codec not in CODEC_PRESETS:
            return ToolResult(success=False, error=f"unknown codec {codec!r}; known: {sorted(CODEC_PRESETS)}")

        composer_dir = Path(composer_dir) if composer_dir else (
            Path(__file__).resolve().parents[2] / "composer"
        )
        if not (composer_dir / "package.json").exists():
            return ToolResult(success=False, error=f"composer not found at {composer_dir}")

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        props_path = output_path.with_suffix(".props.json")
        with open(props_path, "w", encoding="utf-8") as fh:
            json.dump(props, fh, ensure_ascii=False, indent=2)

        cmd = [
            _resolve_bin("npx"), "remotion", "render", "src/index.tsx", composition, str(output_path),
            f"--props={props_path}", *CODEC_PRESETS[codec],
        ]
        if extra_args:
            cmd += extra_args

        proc = subprocess.run(
            cmd, cwd=str(composer_dir), capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=3600,
        )
        if proc.returncode != 0 or not output_path.exists():
            return ToolResult(
                success=False,
                error=f"remotion render failed (exit {proc.returncode}): {proc.stderr[-1500:]}",
                metadata={"cmd": " ".join(cmd)},
            )

        return ToolResult(
            success=True,
            output_path=output_path,
            metadata={
                "composition": composition,
                "codec": codec,
                "props_path": str(props_path),
                "size_bytes": output_path.stat().st_size,
                "cmd": " ".join(cmd),
            },
        )

    def estimate_cost(self, **kwargs: Any) -> float:
        return 0.0  # local CPU/GPU time
