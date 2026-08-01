# Deliver Director

Produce `final_delivery` (`schemas/artifacts/final_delivery.schema.json`): `{ final_path, notes }`.

## Before checkpointing this stage

The structural/repetition/pacing gate (`lib/quality_gates.py::run_scene_plan_gates()`) already ran at `scene_plan` — if it didn't pass then, it shouldn't have gotten this far. That gate is deliberately scoped to what's checkable from the JSON alone (types, timing, schema shape); it can't tell you whether the render actually *looks* right, so still do this by hand:

- Does the rendered video match what `scene_plan` said it would be? Pull a still from each cut's midpoint (`npx remotion still ... --frame=N`) and actually look at it — M2 caught two real bugs this way (color-management darkening, a camera-framing bug) that a clean exit code and a passing schema check both missed.
- Does it match the brief's `signature_moment`? If the particle burst or shader transition was supposed to be the emotional beat and it reads as flat, that's a `scene_plan` problem to send back, not something to ship anyway.

## Delivery

Copy (don't move — keep the working copy in `generated/pipelines/<project_id>/`) the render to the configured `output.dir` from `config.yaml`, named meaningfully (not the raw project_id if the brief gives you something better to call it). Set `final_path` to that copy's location.
