from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from fractions import Fraction
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from tools.base_tool import BaseTool, ToolResult, ToolRuntime, ToolTier

# Export formats -> OTIO adapter names. Verified live against
# opentimelineio 0.18.1 + OpenTimelineIO-Plugins 0.18.1 (2026-09-16).
_EXPORT_ADAPTERS: dict[str, str] = {
    "otio": "otio_json",  # the IR itself; round-trips losslessly
    "fcpxml": "fcp_xml",  # Resolve / FCP / Premiere import
    "edl": "cmx_3600",    # universal fallback
}

_RATIONAL_RE = re.compile(r"^(-?\d+(?:\.\d+)?)(?:/(\d+(?:\.\d+)?))?s?$")


def _rational_seconds(value: str | float | int) -> Fraction:
    """Parses FCPXML rational time strings ("84/30s", "0s") or plain
    numbers into an exact Fraction of seconds -- no float drift (the same
    discipline fcp-mcp documents for its FCPXML work; see
    docs/research/ai-video-editing-landscape.md §3.4)."""
    if isinstance(value, (int, float)):
        return Fraction(str(value))
    match = _RATIONAL_RE.match(str(value).strip())
    if not match:
        raise ValueError(f"unparseable time value: {value!r}")
    num = Fraction(match.group(1))
    den = Fraction(match.group(2)) if match.group(2) else Fraction(1)
    if den == 0:
        raise ValueError(f"zero denominator in time value: {value!r}")
    return num / den


def segments_from_auto_editor_fcpxml(fcpxml_path: Path) -> tuple[Path, list[dict[str, Any]]]:
    """Extracts (media_path, segments) from an auto-editor FCPXML timeline
    export. This is the bridge from the rough_cut stage to the OTIO IR:
    auto-editor's asset-clips ARE the cut decision list, in exact rational
    time -- we keep them exact instead of re-deriving floats from the cut
    render (which would compound quantization at every stage)."""
    tree = ET.parse(fcpxml_path)
    root = tree.getroot()

    # asset id -> absolute media path (from media-rep src="file:///...")
    media_by_asset: dict[str, Path] = {}
    for asset in root.iter("asset"):
        rep = asset.find("media-rep")
        if rep is None:
            continue
        src = rep.get("src", "")
        if src.startswith("file://"):
            raw = unquote(urlparse(src).path)
            # file:///C:/... on Windows parses to "/C:/..." -- strip the
            # leading slash before the drive letter (live-test bug
            # 2026-09-16: gate reported media missing for an existing file).
            if re.match(r"^/[A-Za-z]:/", raw):
                raw = raw[1:]
            media_by_asset[asset.get("id", "")] = Path(raw)

    if not media_by_asset:
        raise ValueError(f"no media-rep entries found in {fcpxml_path}")

    segments: list[dict[str, Any]] = []
    for clip in root.iter("asset-clip"):
        ref = clip.get("ref", "")
        if ref not in media_by_asset:
            raise ValueError(f"asset-clip references unknown asset {ref!r}")
        start = _rational_seconds(clip.get("start", "0s"))
        duration = _rational_seconds(clip.get("duration", "0s"))
        segments.append(
            {
                "source_start": start,
                "duration": duration,
                "media": str(media_by_asset[ref]),
            }
        )

    if not segments:
        raise ValueError(f"no asset-clip elements found in {fcpxml_path}")

    media = Path(segments[0]["media"])
    return media, segments


class OtioTimelineTool(BaseTool):
    """The timeline IR tool: segment list -> OTIO timeline -> multi-NLE
    exports. Mid-term centerpiece of the NLE roadmap
    (docs/research/ai-video-editing-landscape.md §4): the agent authors
    edit decisions as segments, this tool materializes them as an
    OpenTimelineIO object tree, and adapters land them in whatever NLE the
    user prefers. Remotion-style rendering becomes just one consumer of
    the same IR, not the only destination.
    """

    name = "otio_timeline"
    capability = "timeline_ir"
    provider = "opentimelineio"
    tier = ToolTier.LOCAL
    runtime = ToolRuntime.PYTHON
    description = (
        "Build an OpenTimelineIO timeline from cut segments and export it "
        "as .otio (IR), FCPXML (Resolve/FCP/Premiere), and/or EDL."
    )
    best_for = [
        "handing the agent's edit decisions to any NLE via one IR",
        "exact rational-time timelines (no float drift)",
        "converting auto-editor rough cuts into an editable timeline",
    ]
    not_good_for = [
        "effects/color parameters -- OTIO carries edit decisions only; "
        "effect intent belongs in the stage artifact, translated per-NLE",
    ]
    dependencies = []

    def execute(
        self,
        segments: list[dict[str, Any]],
        media_path: Path,
        output_dir: Path,
        name: str = "timeline",
        formats: tuple[str, ...] = ("otio", "fcpxml", "edl"),
        timeline_fps: int = 30,
        source_duration_seconds: float | None = None,
    ) -> ToolResult:
        """segments: [{"source_start": seconds (Fraction/float/str),
        "duration": ...}, ...] -- all referencing media_path.
        formats: subset of ("otio", "fcpxml", "edl").
        source_duration_seconds: full duration of the source media. The
        fcpxml adapter needs it (it reads the reference's available_range;
        without it it dies with a bare NoneType error -- live test
        2026-09-16), so fcpxml without this parameter is rejected."""
        try:
            import opentimelineio as otio
        except ImportError as exc:
            return ToolResult(
                success=False,
                error=f"opentimelineio not installed: {exc} (pip install opentimelineio OpenTimelineIO-Plugins)",
            )

        media_path = Path(media_path)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        bad = [f for f in formats if f not in _EXPORT_ADAPTERS]
        if bad:
            return ToolResult(
                success=False, error=f"unknown formats {bad}; valid: {sorted(_EXPORT_ADAPTERS)}"
            )
        if "fcpxml" in formats and source_duration_seconds is None:
            return ToolResult(
                success=False,
                error="fcpxml export needs source_duration_seconds (ffprobe "
                "the source; the fcp_xml adapter requires the reference's "
                "available_range).",
            )

        fps_rate = Fraction(timeline_fps)
        track = otio.schema.Track(name="v1", kind=otio.schema.TrackKind.Video)
        ref = otio.schema.ExternalReference(
            target_url=media_path.resolve().as_uri()
        )
        if source_duration_seconds is not None:
            ref.available_range = otio.opentime.TimeRange(
                start_time=otio.opentime.RationalTime(0, timeline_fps),
                duration=otio.opentime.RationalTime(
                    float(Fraction(str(source_duration_seconds)) * fps_rate), timeline_fps
                ),
            )
        for i, seg in enumerate(segments):
            start = _rational_seconds(seg["source_start"])
            duration = _rational_seconds(seg["duration"])
            clip = otio.schema.Clip(name=f"{media_path.stem}_{i:03d}", media_reference=ref)
            clip.source_range = otio.opentime.TimeRange(
                start_time=otio.opentime.RationalTime(
                    float(start * fps_rate), timeline_fps
                ),
                duration=otio.opentime.RationalTime(
                    float(duration * fps_rate), timeline_fps
                ),
            )
            track.append(clip)

        timeline = otio.schema.Timeline(name=name)
        timeline.tracks.append(track)
        timeline.global_start_time = otio.opentime.RationalTime(0, timeline_fps)

        produced: list[str] = []
        for fmt in formats:
            suffix = {"otio": ".otio", "fcpxml": ".fcpxml", "edl": ".edl"}[fmt]
            dest = output_dir / f"{name}{suffix}"
            try:
                otio.adapters.write_to_file(
                    timeline, str(dest), adapter_name=_EXPORT_ADAPTERS[fmt]
                )
            except Exception as exc:  # adapter failures are data-dependent; surface cleanly
                return ToolResult(
                    success=False,
                    error=f"OTIO {fmt} export failed: {exc}",
                    metadata={"produced_so_far": produced},
                )
            produced.append(str(dest))

        return ToolResult(
            success=True,
            output_path=Path(produced[0]),
            metadata={
                "produced": produced,
                "formats": list(formats),
                "segment_count": len(segments),
                "timeline_fps": timeline_fps,
                "timeline_duration_seconds": str(
                    sum((_rational_seconds(s["duration"]) for s in segments), Fraction(0))
                ),
            },
        )

    def estimate_cost(self, **kwargs: Any) -> float:
        return 0.0  # fully local
