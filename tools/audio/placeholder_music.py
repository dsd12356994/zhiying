from __future__ import annotations

import subprocess
from pathlib import Path

from tools.base_tool import BaseTool, ToolResult, ToolRuntime, ToolTier


class PlaceholderMusicTool(BaseTool):
    name = "placeholder_music"
    capability = "music_generation"
    provider = "ffmpeg_synth"
    tier = ToolTier.LOCAL
    runtime = ToolRuntime.SUBPROCESS
    description = (
        "Generates a duration-correct synthesized ambient pad locally via "
        "ffmpeg -- a placeholder for real music generation (Suno/ElevenLabs "
        "Music/etc), not a creative deliverable."
    )
    best_for = ["filling the music slot during pipeline smoke tests"]
    not_good_for = ["final delivery", "anything requiring melody/rhythm/mood matching"]
    dependencies = ["cmd:ffmpeg"]

    def execute(
        self,
        duration_seconds: float,
        output_path: Path,
        base_freq: float = 220.0,
    ) -> ToolResult:
        self.check_dependencies()
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        fade = min(2.0, duration_seconds / 4)
        subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-f", "lavfi", "-i", f"sine=frequency={base_freq}:duration={duration_seconds}",
                "-f", "lavfi", "-i", f"sine=frequency={base_freq * 1.5}:duration={duration_seconds}",
                "-filter_complex",
                f"[0:a][1:a]amix=inputs=2:weights=1 0.6,"
                f"afade=t=in:d={fade},afade=t=out:st={duration_seconds - fade}:d={fade}",
                str(output_path),
            ],
            check=True,
        )

        return ToolResult(
            success=True,
            output_path=output_path,
            metadata={"duration_seconds": duration_seconds, "base_freq": base_freq},
        )
