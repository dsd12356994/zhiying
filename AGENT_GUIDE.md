# Agent Guide

This repository has **no standalone orchestrator process**. There is no server, no webhook, no job queue. The coding agent operating this repo (Claude Code or equivalent) *is* the production director — you read this file, then the pipeline manifest, then the relevant stage-director skill, then you call tools yourself and checkpoint your own progress.

## How to run a production

1. Read `skills/INDEX.md` first — it routes you to the right skill layer for whatever you're about to do.
2. Pick (or ask the user to confirm) a pipeline manifest from `pipeline_defs/`. Load it with `lib/pipeline_loader.py::load_pipeline(name)`.
3. For each stage in the manifest's `stages` list, in order:
   - Read that stage's `skill` path under `skills/pipelines/<pipeline>/<stage>-director.md` before doing any work in that stage.
   - Gather `required_artifacts_in` from prior stage outputs.
   - Call tools via `tools/tool_registry.py::ToolRegistry` — query by capability, pick a provider (see `lib/scoring.py` for how to rank candidates when more than one tool matches), execute, validate the result against the stage's artifact schema in `schemas/artifacts/`.
   - Run any quality gate listed in the stage's `review_focus` (see `lib/` quality-check functions) before moving on. Never skip a `checkpoint_required: true` stage.
   - Write a checkpoint via `lib/checkpoint.py::write_checkpoint(...)`.
4. On resume (new conversation, same project), call `lib/checkpoint.py::get_next_stage(project_id)` to find where to continue — don't restart from scratch.

## Ground rules

- Python code in `tools/` and `lib/` is infrastructure and persistence only. It does not decide *what* to do next — you do, by reading manifests and skills.
- Every composition rendered through `composer/` must be a pure function of `frame` (Remotion renders frames independently, possibly in parallel). Never drive `composer/src/effects/three/*` with R3F's `useFrame()` or any clock/delta-time accumulation — use `useCurrentFrame()` and inject time as a uniform.
- No WhatsApp/messaging layer exists in this repo by design — this is a headless, conversation-driven pipeline. Don't add a webhook/server layer without the user explicitly asking for one.
- Budget and provider choices should go through `lib/scoring.py`'s ranking rather than hardcoding a provider.

*(This file will grow as pipelines are added in M4 — currently only `cinematic-trailer` exists.)*
