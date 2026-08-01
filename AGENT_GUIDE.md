# Agent Guide

This repository has **no standalone orchestrator process**. There is no webhook, no job queue. The coding agent operating this repo (Claude Code or equivalent) *is* the production director — you read this file, then the pipeline manifest, then the relevant stage-director skill, then you call tools yourself and checkpoint your own progress. (There is an optional local dashboard, `dashboard/`, for testing -- see below. It's a viewer, not a second orchestrator.)

## How to run a production

1. Read `skills/INDEX.md` first — it routes you to the right skill layer for whatever you're about to do.
2. Pick (or ask the user to confirm) a pipeline manifest from `pipeline_defs/`. Load it with `lib/pipeline_loader.py::load_pipeline(name)`.
3. For each stage in the manifest's `stages` list, in order:
   - Read that stage's `skill` path under `skills/pipelines/<pipeline>/<stage-name>-director.md` (or `executive-producer.md` for the first stage) before doing any work in that stage.
   - Gather `required_artifacts_in` from prior stage checkpoints (`lib/checkpoint.py::read_checkpoint(project_id, stage)`).
   - If the stage needs a tool, query `tools/tool_registry.py::ToolRegistry` by capability and call `tool.execute(...)` yourself. Validate the result against the stage's artifact schema via `lib/quality_gates.py::validate_artifact(produces, artifact)` before checkpointing.
   - Do whatever the stage's `review_focus` asks before moving on. `scene_plan` has an automated gate (`lib/quality_gates.py::run_scene_plan_gates()` — structural/repetition/pacing checks; a `"fail"` finding blocks moving to `assets`). Other stages don't have a scriptable equivalent yet (visual review of a render isn't something a JSON check can do) — read the output back by hand, don't just trust a zero exit code.
   - Write a checkpoint via `lib/checkpoint.py::write_checkpoint(project_id, pipeline, stage, status, artifact=...)`. Never skip a `checkpoint_required: true` stage.
4. On resume (new conversation, same project), call `lib/checkpoint.py::get_next_stage(manifest, project_id)` to find where to continue — don't restart from scratch.

## Ground rules

- Python code in `tools/` and `lib/` is infrastructure and persistence only. It does not decide *what* to do next — you do, by reading manifests and skills.
- Every composition rendered through `composer/` must be a pure function of `frame` (Remotion renders frames independently, possibly in parallel). Never drive `composer/src/effects/three/*` with R3F's `useFrame()` or any clock/delta-time accumulation — use `useCurrentFrame()` and inject time as a uniform. See `skills/core/three-particles.md` for two real bugs this caused.
- No WhatsApp/messaging layer exists in this repo by design — this is a headless, conversation-driven pipeline. Don't add a webhook/server layer without the user explicitly asking for one.
- `lib/scoring.py` (provider ranking when multiple tools share a capability) doesn't exist yet — every capability currently has exactly one provider, so there's nothing to rank. Build it when a second provider for the same capability actually gets added, not before.

## Current pipelines

- `cinematic-trailer` (`pipeline_defs/cinematic-trailer.yaml`, `skills/pipelines/cinematic-trailer/`) — the only one that exists. 15–30s cinematic/trailer style, built to exercise the `composer/src/effects/` layer.

## Local dashboard (`dashboard/`)

`uv run uvicorn dashboard.server:app --reload`, then open `localhost:8000`. Lists projects, shows each stage's checkpoint, plays the render inline, and has buttons for the `assets`/`compose`/`deliver` stages -- each just calls the same `lib`/`tools` functions described above, nothing new. It deliberately has **no button for `scene_plan`**: authoring it is a creative call and stays conversational (that stage's checkpoint has to already exist, written by you, before the dashboard's `assets` button does anything). Don't extend this to call an LLM to auto-generate `scene_plan` without the user explicitly deciding to change that.
