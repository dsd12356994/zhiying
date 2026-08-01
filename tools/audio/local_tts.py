from __future__ import annotations

import subprocess
from pathlib import Path

from tools.base_tool import BaseTool, ToolResult, ToolRuntime, ToolTier


class MacSayTTSTool(BaseTool):
    name = "macos_say_tts"
    capability = "text_to_speech"
    provider = "macos_say"
    tier = ToolTier.LOCAL
    runtime = ToolRuntime.SUBPROCESS
    description = (
        "Zero-setup local TTS using macOS's built-in `say` command. Good for "
        "smoke-testing pipeline timing; not broadcast quality -- swap for a "
        "real provider (ElevenLabs etc) once voice quality actually matters."
    )
    best_for = ["local smoke tests", "placeholder narration timing"]
    not_good_for = ["final delivery audio", "non-macOS environments"]
    dependencies = ["cmd:say", "cmd:ffmpeg"]

    def execute(
        self,
        text: str,
        output_path: Path,
        voice: str = "Samantha",
        rate: int = 190,
    ) -> ToolResult:
        self.check_dependencies()
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        aiff_path = output_path.with_suffix(".aiff")
        subprocess.run(
            ["say", "-v", voice, "-r", str(rate), "-o", str(aiff_path), text],
            check=True,
        )
        subprocess.run(
            ["ffmpeg", "-y", "-v", "error", "-i", str(aiff_path), str(output_path)],
            check=True,
        )
        aiff_path.unlink()

        return ToolResult(
            success=True,
            output_path=output_path,
            metadata={"voice": voice, "rate": rate, "text_length": len(text)},
        )
