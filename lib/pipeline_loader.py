from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import jsonschema
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DEFS_DIR = REPO_ROOT / "pipeline_defs"
MANIFEST_SCHEMA_PATH = REPO_ROOT / "schemas" / "pipelines" / "pipeline_manifest.schema.json"


def load_pipeline(name: str, defs_dir: Path | None = None) -> dict[str, Any]:
    defs_dir = defs_dir or DEFAULT_DEFS_DIR
    manifest_path = defs_dir / f"{name}.yaml"
    if not manifest_path.exists():
        raise FileNotFoundError(f"No pipeline manifest at {manifest_path}")

    with open(manifest_path) as fh:
        manifest = yaml.safe_load(fh)

    with open(MANIFEST_SCHEMA_PATH) as fh:
        schema = json.load(fh)
    jsonschema.validate(manifest, schema)

    return manifest


def get_stage_order(manifest: dict[str, Any]) -> list[str]:
    return [stage["name"] for stage in manifest["stages"]]


def get_stage(manifest: dict[str, Any], stage_name: str) -> dict[str, Any]:
    for stage in manifest["stages"]:
        if stage["name"] == stage_name:
            return stage
    raise KeyError(f"No stage named {stage_name!r} in pipeline {manifest['name']!r}")


def get_stage_skill(manifest: dict[str, Any], stage_name: str) -> str:
    return get_stage(manifest, stage_name)["skill"]


def get_required_tools(manifest: dict[str, Any], stage_name: str) -> list[str]:
    return get_stage(manifest, stage_name).get("required_tools", [])


def get_stage_review_focus(manifest: dict[str, Any], stage_name: str) -> str | None:
    return get_stage(manifest, stage_name).get("review_focus")
