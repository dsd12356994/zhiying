from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import jsonschema

REPO_ROOT = Path(__file__).resolve().parent.parent
ARTIFACT_SCHEMAS_DIR = REPO_ROOT / "schemas" / "artifacts"

Severity = Literal["fail", "warning"]


@dataclass
class Finding:
    severity: Severity
    message: str


@dataclass
class GateReport:
    findings: list[Finding] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not any(f.severity == "fail" for f in self.findings)

    def add(self, severity: Severity, message: str) -> None:
        self.findings.append(Finding(severity, message))

    def extend(self, other: "GateReport") -> None:
        self.findings.extend(other.findings)


def validate_artifact(produces: str, artifact: dict[str, Any]) -> None:
    """Raises jsonschema.ValidationError if `artifact` doesn't match
    schemas/artifacts/<produces>.schema.json. One call site so stage code
    doesn't have to remember which schema file goes with which artifact name.
    This is the non-negotiable structural check; run_scene_plan_gates() below
    is the softer, judgment-call layer on top of it.
    """
    schema_path = ARTIFACT_SCHEMAS_DIR / f"{produces}.schema.json"
    if not schema_path.exists():
        raise FileNotFoundError(f"No artifact schema for {produces!r} at {schema_path}")
    with open(schema_path) as fh:
        schema = json.load(fh)
    jsonschema.validate(artifact, schema)


# Timing conventions from skills/pipelines/cinematic-trailer/scene-plan-director.md
# (30fps). Keep these two in sync if either changes.
_PACING_RANGES_FRAMES: dict[str, tuple[int, int]] = {
    "three_text_intro": (60, 90),
    "particle_burst": (40, 60),
    "shader_transition": (30, 45),
    "text_card": (45, 200),  # copy-length dependent; generous ceiling
}


def check_scene_variation(
    scene_plan: dict[str, Any], expected_total_frames: int | None = None
) -> GateReport:
    """No two consecutive cuts share a type; at least one cut isn't
    text_card; total duration matches the brief within one second.
    Mirrors the success_criteria declared in pipeline_defs/cinematic-trailer.yaml
    -- those were prose until this function existed to actually enforce them.
    """
    report = GateReport()
    cuts = scene_plan.get("cuts", [])
    types = [c["type"] for c in cuts]

    for i in range(len(types) - 1):
        if types[i] == types[i + 1]:
            report.add(
                "fail",
                f"cuts[{i}] and cuts[{i + 1}] both use type {types[i]!r} -- "
                "no two consecutive cuts may share a type.",
            )

    if types and all(t == "text_card" for t in types):
        report.add(
            "fail",
            "scene plan is text_card-only -- must include at least one "
            "three_text_intro, particle_burst, or shader_transition cut.",
        )

    if expected_total_frames is not None:
        total = sum(c["durationInFrames"] for c in cuts)
        fps = scene_plan.get("fps", 30)
        if abs(total - expected_total_frames) > fps:
            report.add(
                "fail",
                f"cuts sum to {total} frames, expected ~{expected_total_frames} "
                "(brief duration_seconds * fps, ±1s tolerance).",
            )

    return report


def check_scene_pacing(scene_plan: dict[str, Any]) -> GateReport:
    """Flags cuts whose durationInFrames falls outside the documented
    per-effect ranges. Warnings, not failures -- these are conventions, not
    hard limits, and a deliberate outlier might be the right creative call.
    """
    report = GateReport()
    for i, cut in enumerate(scene_plan.get("cuts", [])):
        cut_type = cut.get("type")
        duration = cut.get("durationInFrames")
        bounds = _PACING_RANGES_FRAMES.get(cut_type)
        if bounds is None or duration is None:
            continue
        low, high = bounds
        if duration < low:
            report.add(
                "warning",
                f"cuts[{i}] ({cut_type}) is {duration}f, under the documented "
                f"floor of {low}f -- likely reads as a flash, not a beat.",
            )
        elif duration > high:
            report.add(
                "warning",
                f"cuts[{i}] ({cut_type}) is {duration}f, over the documented "
                f"ceiling of {high}f -- check it's not overstaying its welcome.",
            )
    return report


def run_scene_plan_gates(
    scene_plan: dict[str, Any], expected_duration_seconds: float | None = None
) -> GateReport:
    """Combined pre-render gate for the scene_plan stage. Call before
    checkpointing scene_plan as completed -- a report with passed=False
    means don't proceed to assets/compose without either fixing the plan or
    recording why the finding doesn't apply (see reviewer conventions in
    skills/meta once that layer exists).
    """
    expected_total_frames = None
    if expected_duration_seconds is not None:
        expected_total_frames = round(expected_duration_seconds * scene_plan.get("fps", 30))

    report = GateReport()
    report.extend(check_scene_variation(scene_plan, expected_total_frames))
    report.extend(check_scene_pacing(scene_plan))
    return report
