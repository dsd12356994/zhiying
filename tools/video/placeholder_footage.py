from __future__ import annotations

import subprocess
from pathlib import Path

from tools.base_tool import BaseTool, ToolResult, ToolRuntime, ToolTier


class PlaceholderFootageTool(BaseTool):
    name = "placeholder_footage"
    capability = "stock_footage_generation"
    provider = "ffmpeg_synth"
    tier = ToolTier.LOCAL
    runtime = ToolRuntime.SUBPROCESS
    description = (
        "Generates a duration-correct synthesized test clip locally via ffmpeg's "
        "testsrc2 pattern (animated, not a still frame) -- a placeholder for real "
        "footage (Pexels/etc), not a creative deliverable. Exists so video_clip cuts "
        "can be built and trim-tested before PEXELS_API_KEY is configured."
    )
    best_for = ["exercising video_clip trim/playback logic during pipeline smoke tests"]
    not_good_for = ["final delivery", "anything requiring real-world footage content"]
    dependencies = ["cmd:ffmpeg"]

    def execute(
        self,
        duration_seconds: float,
        output_path: Path,
        width: int = 1920,
        height: int = 1080,
        fps: int = 30,
    ) -> ToolResult:
        self.check_dependencies()
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-f", "lavfi",
                "-i", f"testsrc2=duration={duration_seconds}:size={width}x{height}:rate={fps}",
                "-pix_fmt", "yuv420p",
                str(output_path),
            ],
            check=True,
        )

        return ToolResult(
            success=True,
            output_path=output_path,
            metadata={"duration_seconds": duration_seconds, "width": width, "height": height, "fps": fps},
        )
