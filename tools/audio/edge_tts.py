from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from tools.base_tool import BaseTool, ToolResult, ToolRuntime, ToolTier

# Voices verified against the edge-tts catalog (2026-09-19). zh-HK = 粵語
# (written Chinese read in Cantonese — the natural pick for HK course
# material), zh-CN = Mandarin. Custom "name-local" variants exist too.
RECOMMENDED_VOICES = {
    "zh-CN-YunxiNeural": "Mandarin male, calm — default for review/course audio",
    "zh-CN-XiaoxiaoNeural": "Mandarin female, warm",
    "zh-HK-HiuMaanNeural": "Cantonese female — for 繁體/HK material",
    "zh-HK-WanLungNeural": "Cantonese male",
}


class EdgeTtsTool(BaseTool):
    """Free neural TTS via Microsoft's Edge read-aloud service (edge-tts
    package). Fills the Windows gap: the pre-existing macos_say_tts tool is
    macOS-only, so before this tool the repo had no working TTS on Windows.

    Needs the network (it talks to Microsoft's endpoint) but no API key.
    If fully-offline synthesis is ever required, that's a different tool
    (piper/CosyVoice) — don't fake it here.
    """

    name = "edge_tts"
    capability = "text_to_speech"
    provider = "microsoft-edge"
    tier = ToolTier.FREE_API
    runtime = ToolRuntime.PYTHON
    description = (
        "Synthesize speech from text with Microsoft Edge neural voices "
        "(zh-CN/zh-HK/en and more). Free, keyless, needs network."
    )
    best_for = [
        "narration / review audio / subtitles-read-aloud in zh or en",
        "anything on Windows where macos_say_tts can't run",
    ]
    not_good_for = [
        "fully offline environments (needs the Microsoft endpoint)",
        "voice cloning / custom timbre — that's a paid service elsewhere",
    ]
    dependencies = []

    def execute(
        self,
        text: str,
        output_path: Path,
        voice: str = "zh-CN-YunxiNeural",
        rate: str = "+0%",
        pitch: str = "+0Hz",
    ) -> ToolResult:
        try:
            import edge_tts
        except ImportError as exc:
            return ToolResult(
                success=False, error=f"edge-tts not installed: {exc} (pip install edge-tts)"
            )
        if not text.strip():
            return ToolResult(success=False, error="empty text")

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        async def _run() -> None:
            communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
            await communicate.save(str(output_path))

        try:
            asyncio.run(_run())
        except Exception as exc:
            return ToolResult(success=False, error=f"edge-tts synthesis failed: {exc}")

        if not output_path.exists() or output_path.stat().st_size == 0:
            return ToolResult(success=False, error="edge-tts produced no output")

        return ToolResult(
            success=True,
            output_path=output_path,
            metadata={
                "voice": voice,
                "chars": len(text),
                "size_bytes": output_path.stat().st_size,
            },
        )

    def estimate_cost(self, **kwargs: Any) -> float:
        return 0.0  # free service
