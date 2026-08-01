from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from jsonschema import ValidationError
from pydantic import BaseModel

from lib.checkpoint import DEFAULT_PIPELINE_DIR, get_completed_stages, read_checkpoint, write_checkpoint
from lib.pipeline_loader import get_stage_order, load_pipeline
from lib.quality_gates import validate_artifact
from tools.tool_registry import ToolRegistry

REPO_ROOT = Path(__file__).resolve().parent.parent
COMPOSER_DIR = REPO_ROOT / "composer"
GENERATED_DIR = REPO_ROOT / "generated"
STATIC_DIR = Path(__file__).parent / "static"

# Dashboard is a viewer + trigger for the mechanical stages only. scene_plan
# has no endpoint here on purpose -- it's authored conversationally by the
# agent (see AGENT_GUIDE.md and skills/pipelines/cinematic-trailer/
# scene-plan-director.md); this file must not grow an LLM call to replace
# that without the user deciding to change that architecture.
PIPELINE_NAME = "cinematic-trailer"

app = FastAPI(title="zhiying dashboard")
GENERATED_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=GENERATED_DIR), name="media")


def _load_config() -> dict[str, Any]:
    with open(REPO_ROOT / "config.yaml") as fh:
        return yaml.safe_load(fh)


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "project"


def _require_checkpoint(project_id: str, stage: str) -> dict[str, Any]:
    checkpoint = read_checkpoint(project_id, stage)
    if checkpoint is None or checkpoint.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"stage {stage!r} isn't completed yet for project {project_id!r}.",
        )
    return checkpoint


class BriefRequest(BaseModel):
    topic: str
    duration_seconds: float
    signature_moment: str
    tone: str | None = None


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/projects")
def list_projects() -> list[dict[str, Any]]:
    manifest = load_pipeline(PIPELINE_NAME)
    stage_order = get_stage_order(manifest)
    projects: list[dict[str, Any]] = []
    if DEFAULT_PIPELINE_DIR.exists():
        for project_dir in sorted(DEFAULT_PIPELINE_DIR.iterdir()):
            if not project_dir.is_dir():
                continue
            project_id = project_dir.name
            completed = get_completed_stages(project_id)
            projects.append(
                {
                    "project_id": project_id,
                    "completed_stages": completed,
                    "total_stages": len(stage_order),
                    "delivered": "deliver" in completed,
                }
            )
    return projects


@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> dict[str, Any]:
    manifest = load_pipeline(PIPELINE_NAME)
    stages = []
    for stage_name in get_stage_order(manifest):
        checkpoint = read_checkpoint(project_id, stage_name)
        stages.append({"stage": stage_name, "checkpoint": checkpoint})
    return {"project_id": project_id, "pipeline": PIPELINE_NAME, "stages": stages}


@app.post("/api/projects")
def create_project(brief: BriefRequest) -> dict[str, str]:
    brief_artifact = brief.model_dump(exclude_none=True)
    try:
        validate_artifact("brief", brief_artifact)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    project_id = _slugify(brief.topic)
    if (DEFAULT_PIPELINE_DIR / project_id).exists():
        suffix = 2
        while (DEFAULT_PIPELINE_DIR / f"{project_id}-{suffix}").exists():
            suffix += 1
        project_id = f"{project_id}-{suffix}"

    write_checkpoint(
        project_id=project_id,
        pipeline=PIPELINE_NAME,
        stage="brief",
        status="completed",
        artifact=brief_artifact,
    )
    return {"project_id": project_id}


@app.post("/api/projects/{project_id}/assets")
def run_assets(project_id: str) -> dict[str, Any]:
    _require_checkpoint(project_id, "scene_plan")
    scene_plan = read_checkpoint(project_id, "scene_plan")["artifact"]

    registry = ToolRegistry()
    registry.discover()
    music_tool = registry.get("placeholder_music")

    fps = scene_plan.get("fps", 30)
    total_seconds = sum(c["durationInFrames"] for c in scene_plan["cuts"]) / fps

    assets_dir = REPO_ROOT / "generated" / "assets" / project_id
    result = music_tool.execute(duration_seconds=total_seconds, output_path=assets_dir / "score.wav")
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error or "placeholder_music failed")

    assets_manifest = {
        "narration_audio_path": None,
        "music_audio_path": str(result.output_path),
        "footage_paths": [],
    }
    validate_artifact("assets_manifest", assets_manifest)
    write_checkpoint(
        project_id=project_id,
        pipeline=PIPELINE_NAME,
        stage="assets",
        status="completed",
        artifact=assets_manifest,
    )
    return {"stage": "assets", "artifact": assets_manifest}


@app.post("/api/projects/{project_id}/compose")
def run_compose(project_id: str) -> dict[str, Any]:
    scene_plan = _require_checkpoint(project_id, "scene_plan")["artifact"]
    assets_manifest = _require_checkpoint(project_id, "assets")["artifact"]

    project_dir = DEFAULT_PIPELINE_DIR / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    props_path = project_dir / "props.json"
    with open(props_path, "w") as fh:
        json.dump(scene_plan, fh, indent=2)

    silent_path = project_dir / "render-silent.mp4"
    render_result = subprocess.run(
        [
            "npx", "remotion", "render", "src/index.tsx", "CinematicTrailer",
            str(silent_path), f"--props={props_path}", "--overwrite",
        ],
        cwd=COMPOSER_DIR,
        capture_output=True,
        text=True,
    )
    if render_result.returncode != 0:
        raise HTTPException(status_code=500, detail=render_result.stderr[-2000:])

    final_path = project_dir / "render.mp4"
    audio_path = assets_manifest.get("music_audio_path") or assets_manifest.get("narration_audio_path")
    if audio_path:
        mux_result = subprocess.run(
            [
                "ffmpeg", "-y", "-v", "error",
                "-i", str(silent_path), "-i", audio_path,
                "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest",
                str(final_path),
            ],
            capture_output=True,
            text=True,
        )
        if mux_result.returncode != 0:
            raise HTTPException(status_code=500, detail=mux_result.stderr[-2000:])
    else:
        shutil.copy(silent_path, final_path)

    fps = scene_plan.get("fps", 30)
    total_frames = sum(c["durationInFrames"] for c in scene_plan["cuts"])

    render_artifact = {
        "output_path": str(final_path),
        "props_path": str(props_path),
        "duration_seconds": total_frames / fps,
    }
    validate_artifact("render", render_artifact)
    write_checkpoint(
        project_id=project_id,
        pipeline=PIPELINE_NAME,
        stage="compose",
        status="completed",
        artifact=render_artifact,
    )
    return {"stage": "compose", "artifact": render_artifact}


@app.post("/api/projects/{project_id}/deliver")
def run_deliver(project_id: str) -> dict[str, Any]:
    render_artifact = _require_checkpoint(project_id, "compose")["artifact"]

    config = _load_config()
    output_dir = REPO_ROOT / config["output"]["dir"]
    output_dir.mkdir(parents=True, exist_ok=True)
    final_path = output_dir / f"{project_id}.mp4"
    shutil.copy(render_artifact["output_path"], final_path)

    final_delivery = {"final_path": str(final_path), "notes": "Delivered via dashboard."}
    validate_artifact("final_delivery", final_delivery)
    write_checkpoint(
        project_id=project_id,
        pipeline=PIPELINE_NAME,
        stage="deliver",
        status="completed",
        artifact=final_delivery,
    )
    return {"stage": "deliver", "artifact": final_delivery}
