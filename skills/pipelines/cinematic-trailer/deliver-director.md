# Deliver Director

Produce `final_delivery` (`schemas/artifacts/final_delivery.schema.json`): `{ final_path, notes }`.

## Before checkpointing this stage

A real pre-delivery quality gate (slideshow-risk scoring, scene-variation checks, schema-validated review) is **M5 work and doesn't exist yet** — don't skip the review step, just do it manually for now:

- Does the rendered video match what `scene_plan` said it would be? Pull a still from each cut's midpoint (`npx remotion still ... --frame=N`) and actually look at it — M2 caught two real bugs this way that a clean exit code would have missed.
- Does it match the brief's `signature_moment`? If the particle burst or shader transition was supposed to be the emotional beat and it reads as flat, that's a `scene_plan` problem to send back, not something to ship anyway.

## Delivery

Copy (don't move — keep the working copy in `generated/pipelines/<project_id>/`) the render to the configured `output.dir` from `config.yaml`, named meaningfully (not the raw project_id if the brief gives you something better to call it). Set `final_path` to that copy's location.

Once M5 lands, this stage's `review_focus` gate runs *before* this step, not after — update this doc's checklist to point at the real gate functions instead of the manual list above.
