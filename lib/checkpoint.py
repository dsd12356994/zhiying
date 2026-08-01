from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import jsonschema

from lib.pipeline_loader import get_stage_order

REPO_ROOT = Path(__file__).resolve().parent.parent
CHECKPOINT_SCHEMA_PATH = REPO_ROOT / "schemas" / "checkpoints" / "checkpoint.schema.json"
DEFAULT_PIPELINE_DIR = REPO_ROOT / "generated" / "pipelines"


def _checkpoint_schema() -> dict[str, Any]:
    with open(CHECKPOINT_SCHEMA_PATH) as fh:
        return json.load(fh)


def _project_dir(project_id: str, pipeline_dir: Path | None = None) -> Path:
    base = pipeline_dir or DEFAULT_PIPELINE_DIR
    project_path = base / project_id
    project_path.mkdir(parents=True, exist_ok=True)
    return project_path


def write_checkpoint(
    project_id: str,
    pipeline: str,
    stage: str,
    status: str,
    artifact: dict[str, Any] | None = None,
    notes: str | None = None,
    pipeline_dir: Path | None = None,
) -> Path:
    checkpoint: dict[str, Any] = {
        "project_id": project_id,
        "pipeline": pipeline,
        "stage": stage,
        "status": status,
        "written_at": datetime.now(timezone.utc).isoformat(),
    }
    if artifact is not None:
        checkpoint["artifact"] = artifact
    if notes is not None:
        checkpoint["notes"] = notes

    jsonschema.validate(checkpoint, _checkpoint_schema())

    project_path = _project_dir(project_id, pipeline_dir)
    checkpoint_path = project_path / f"checkpoint_{stage}.json"
    with open(checkpoint_path, "w") as fh:
        json.dump(checkpoint, fh, indent=2)

    return checkpoint_path


def read_checkpoint(
    project_id: str, stage: str, pipeline_dir: Path | None = None
) -> dict[str, Any] | None:
    project_path = _project_dir(project_id, pipeline_dir)
    checkpoint_path = project_path / f"checkpoint_{stage}.json"
    if not checkpoint_path.exists():
        return None
    with open(checkpoint_path) as fh:
        return json.load(fh)


def get_completed_stages(project_id: str, pipeline_dir: Path | None = None) -> list[str]:
    project_path = _project_dir(project_id, pipeline_dir)
    completed = []
    for checkpoint_file in sorted(project_path.glob("checkpoint_*.json")):
        with open(checkpoint_file) as fh:
            data = json.load(fh)
        if data.get("status") == "completed":
            completed.append(data["stage"])
    return completed


def get_next_stage(
    manifest: dict[str, Any], project_id: str, pipeline_dir: Path | None = None
) -> str | None:
    """None means every stage in the manifest already has a completed checkpoint."""
    completed = set(get_completed_stages(project_id, pipeline_dir))
    for stage_name in get_stage_order(manifest):
        if stage_name not in completed:
            return stage_name
    return None
