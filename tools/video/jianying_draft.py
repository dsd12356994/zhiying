from __future__ import annotations

import json
import os
import subprocess
from fractions import Fraction
from pathlib import Path
from typing import Any

from tools.base_tool import BaseTool, ToolResult, ToolRuntime, ToolTier
from tools.video.otio_timeline import _rational_seconds

_US = 1_000_000  # pyJianYingDraft's time unit is microseconds (SEC, time_util)

# Windows 剪映专业版 default draft root (the machine this was built on has
# JianyingPro installed there; verified live 2026-09-16). Override with the
# JIANYING_DRAFT_FOLDER env var for CapCut/international or custom roots.
_DEFAULT_DRAFT_ROOT = Path(
    os.environ.get("LOCALAPPDATA", "")
) / "JianyingPro" / "User Data" / "Projects" / "com.lveditor.draft"


def _has_video_stream(media_path: Path) -> bool:
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
         "stream=index", "-of", "csv=p=0", str(media_path)],
        capture_output=True, text=True,
    )
    return bool(proc.stdout.strip())


class JianyingDraftTool(BaseTool):
    """Direct 剪映/CapCut draft generation: the China-ecosystem leg of the
    NLE strategy (docs/research/ai-video-editing-landscape.md §2.1/§4 #6).

    Uses the upstream pyJianYingDraft library (pip install pyJianYingDraft)
    -- the standalone origin of the same engine CapCutAPI wraps in a server.
    We deliberately use the library directly: zhiying's agent calls tools
    in-process (AGENT_GUIDE), an HTTP hop would add a failure mode and a
    second process to babysit for zero capability gain.

    Same segment contract as otio_timeline (rational seconds), so the
    timeline stage can fan out to .otio/.fcpxml/.edl AND a 剪映 draft from
    one decision list. Segment times are converted exact-rational ->
    microseconds (剪映's own unit), never through float seconds.
    """

    name = "jianying_draft"
    capability = "nle_draft_export"
    provider = "pyjianyingdraft"
    tier = ToolTier.LOCAL
    runtime = ToolRuntime.PYTHON
    description = (
        "Generate a 剪映/CapCut draft folder from cut segments -- the "
        "user opens 剪映 and the timeline is just there, editable."
    )
    best_for = [
        "China-ecosystem delivery (剪映专业版 installed)",
        "handing the agent's cut decisions to a 剪映 user unchanged",
    ]
    not_good_for = [
        "environments without 剪映 (use the OTIO/FCPXML exports instead)",
        "effects/color beyond what the draft schema carries",
    ]
    dependencies = ["cmd:ffprobe"]

    def execute(
        self,
        segments: list[dict[str, Any]],
        media_path: Path,
        draft_name: str,
        width: int = 1920,
        height: int = 1080,
        fps: int = 30,
        draft_folder: Path | None = None,
        texts: list[dict[str, Any]] | None = None,
        subtitle_srt: Path | None = None,
        effect: str | None = None,
        transition: str | None = None,
        fade: str | None = None,
        overlays: list[dict[str, Any]] | None = None,
    ) -> ToolResult:
        """segments: same shape as otio_timeline's (source_start/duration in
        rational seconds). draft_folder defaults to the local 剪映 draft
        root (override with JIANYING_DRAFT_FOLDER). Existing drafts with
        the same name are replaced.

        Enrichments (all optional, all on timeline coordinates):
          texts: [{"text", "start", "duration", "size"?, "color"? (rgb
            0-255 tuple)}] -- title cards / captions as text segments.
          subtitle_srt: path to an .srt file -- imported verbatim as a
            subtitle text track (import_srt handles timing/line-breaking).
          effect: name of a pyJianYingDraft VideoSceneEffectType (1097
            available) applied over the whole timeline.
          transition: name of a TransitionType applied between adjacent
            video clips (video tracks only, 2+ clips).
          fade: "0.5s"-style in/out fade applied to every video clip.
          overlays: [{"path", "start", "duration"}] -- transparent motion-
            graphics clips (ProRes 4444 from the composer) placed on a
            second video track above the main cut; 剪映 composites their
            alpha natively.
        """
        try:
            import pyJianYingDraft as jy
        except ImportError as exc:
            return ToolResult(
                success=False,
                error=f"pyJianYingDraft not installed: {exc} (pip install pyJianYingDraft)",
            )

        self.check_dependencies()
        media_path = Path(media_path)
        if not media_path.exists():
            return ToolResult(success=False, error=f"media not found: {media_path}")

        root = Path(draft_folder) if draft_folder else (
            Path(os.environ["JIANYING_DRAFT_FOLDER"])
            if os.environ.get("JIANYING_DRAFT_FOLDER")
            else _DEFAULT_DRAFT_ROOT
        )
        root.mkdir(parents=True, exist_ok=True)  # DraftFolder() requires it to exist

        # Exact rational seconds -> integer microseconds (剪映's unit).
        us = lambda v: int(round(_rational_seconds(v) * _US))  # noqa: E731

        try:
            folder = jy.DraftFolder(str(root))
            script = folder.create_draft(
                draft_name, width, height, fps, allow_replace=True
            )

            video = _has_video_stream(media_path)
            # Tracks are NOT auto-created by add_segment (live test
            # 2026-09-16: it raises "轨道不存在" for the segment's class) --
            # append one explicitly first, as a TrackSpec.
            script.append_track(
                jy.TrackSpec(
                    jy.TrackType.video if video else jy.TrackType.audio
                )
            )
            if video:
                material = jy.VideoMaterial(str(media_path))
                make_segment = lambda target, source: jy.VideoSegment(  # noqa: E731
                    material, target_timerange=target, source_timerange=source
                )
            else:
                material = jy.AudioMaterial(str(media_path))
                make_segment = lambda target, source: jy.AudioSegment(  # noqa: E731
                    material, target_timerange=target, source_timerange=source
                )

            timeline_cursor = Fraction(0)
            video_clips: list[Any] = []
            transition_dur = "0.3s"  # add_transition default feel; expose later if needed
            for seg in segments:
                dur = _rational_seconds(seg["duration"])
                src = _rational_seconds(seg["source_start"])
                clip = make_segment(
                    jy.trange(us(timeline_cursor), us(dur)),
                    jy.trange(us(src), us(dur)),
                )
                if video:
                    if fade:
                        clip.add_fade(fade, fade)
                    if transition and video_clips:
                        clip.add_transition(
                            jy.TransitionType[transition], duration=transition_dur
                        )
                script.add_segment(clip)
                video_clips.append(clip)
                timeline_cursor += dur

            # -- enrichments ------------------------------------------------
            applied: dict[str, Any] = {}
            if effect:
                # Effect tracks must also be appended explicitly (same
                # live-test lesson as media tracks).
                script.append_track(jy.TrackSpec(jy.TrackType.effect))
                total_us = us(timeline_cursor)
                script.add_effect(
                    jy.VideoSceneEffectType[effect],
                    jy.trange(0, total_us) if total_us > 0 else jy.trange(0, _US),
                )
                applied["effect"] = effect
            if texts:
                script.append_track(jy.TrackSpec(jy.TrackType.text))
                for t in texts:
                    color = t.get("color", (255, 255, 255))
                    style = jy.TextStyle(
                        size=t.get("size", 8.0),
                        color=tuple(c / 255.0 for c in color),  # type: ignore[arg-type]
                    )
                    text_seg = jy.TextSegment(
                        t["text"],
                        jy.trange(us(_rational_seconds(t["start"])), us(_rational_seconds(t["duration"]))),
                        style=style,
                    )
                    script.add_segment(text_seg)
                applied["texts"] = len(texts)
            if subtitle_srt:
                subtitle_srt = Path(subtitle_srt)
                if not subtitle_srt.exists():
                    return ToolResult(success=False, error=f"srt not found: {subtitle_srt}")
                script.import_srt(str(subtitle_srt), "zhiying_subtitles")
                applied["subtitles"] = str(subtitle_srt)
            if transition:
                applied["transition"] = transition
            if fade:
                applied["fade"] = fade
            if overlays:
                # Motion-graphics overlay layer (skills/core/
                # motion-graphics-overlay.md): transparent ProRes 4444
                # clips rendered by the composer land on a SECOND video
                # track above the main cut; 剪映 composites their alpha
                # natively -- no keying needed. The track needs a distinct
                # name (live test: same-type tracks without names raise).
                script.append_track(jy.TrackSpec(jy.TrackType.video, name="overlays"))
                added_overlays: list[str] = []
                for ov in overlays:
                    ov_path = Path(ov["path"])
                    if not ov_path.exists():
                        return ToolResult(success=False, error=f"overlay not found: {ov_path}")
                    ov_mat = jy.VideoMaterial(str(ov_path))
                    ov_seg = jy.VideoSegment(
                        ov_mat,
                        target_timerange=jy.trange(
                            us(_rational_seconds(ov["start"])),
                            us(_rational_seconds(ov["duration"])),
                        ),
                    )
                    script.add_segment(ov_seg, track="overlays")
                    added_overlays.append(str(ov_path))
                applied["overlays"] = added_overlays

            script.save()
        except Exception as exc:
            return ToolResult(success=False, error=f"jianying draft generation failed: {exc}")

        draft_path = root / draft_name
        content_path = draft_path / "draft_content.json"
        if not content_path.exists():
            return ToolResult(
                success=False,
                error=f"draft saved but {content_path} missing -- not a valid 剪映 draft",
            )
        with open(content_path, encoding="utf-8") as fh:
            content = json.load(fh)
        n_tracks = len(content.get("tracks", []))
        n_segs = sum(len(t.get("segments", [])) for t in content.get("tracks", []))
        # With texts/subtitles the total exceeds the media clip count, so
        # only a SHORTFALL is a failure (a clip silently dropped).
        if n_segs < len(segments):
            return ToolResult(
                success=False,
                error=f"draft has {n_segs} segments, fewer than the {len(segments)} media clips requested",
            )

        return ToolResult(
            success=True,
            output_path=draft_path,
            metadata={
                "draft_path": str(draft_path),
                "track_kind": "video" if video else "audio",
                "tracks": n_tracks,
                "segments": n_segs,
                "duration_us": us(timeline_cursor),
                "applied": applied,
            },
        )

    def estimate_cost(self, **kwargs: Any) -> float:
        return 0.0  # fully local
