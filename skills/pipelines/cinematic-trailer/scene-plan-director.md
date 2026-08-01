# Scene Plan Director

Turn the `brief` artifact into a `scene_plan` artifact: `{ fps, width, height, cuts: [...] }`, matching `schemas/artifacts/scene_plan.schema.json` for the stage contract and `composer/src/schema.ts`'s zod `cutSchema` for the actual per-cut fields (the Python-side schema deliberately doesn't duplicate those — see the schema file's own description).

## The five cut types (`composer/src/effects/`, `composer/src/scenes/`)

| type | good for | avoid when |
|---|---|---|
| `three_text_intro` | opening title/logo moment, needs weight | more than once per video — it's the opener, not a recurring beat |
| `particle_burst` | the signature moment, a transition that should feel like a release of energy | back-to-back with `shader_transition` — two "transition" cuts in a row reads as indecisive, not intentional |
| `shader_transition` | a mood/scene shift (e.g. dark → brand color) | using it as an opener — it needs something before and after to transition *between* |
| `text_card` | copy that needs to be read (taglines, stats, CTAs) | using it for everything — it's the cheapest-looking cut, don't let the plan lean on it |
| `video_clip` | real footage (b-roll, product shots, anything the other four can't fake) | source has no real content to show yet -- see `skills/core/video-editing.md` for the placeholder-footage-until-Pexels-is-configured story |

## Rules -- run the real gate, don't eyeball this

The `success_criteria` in the manifest are enforced by `lib/quality_gates.py::run_scene_plan_gates()`, not just documented. Call it before checkpointing:

```python
from lib.quality_gates import run_scene_plan_gates

report = run_scene_plan_gates(scene_plan, expected_duration_seconds=brief["duration_seconds"])
if not report.passed:
    ...  # fix the plan; report.findings has one message per problem, severity "fail" or "warning"
```

It checks: cuts' `durationInFrames` sum to `brief.duration_seconds * fps` within one second; no two consecutive cuts share a `type`; at least one cut is `three_text_intro`, `particle_burst`, or `shader_transition` (a plan that's all `text_card` isn't using this pipeline for what it's for); and per-cut pacing against the timing conventions below (warnings, not hard failures). A `"fail"` finding means don't proceed to `assets` until it's fixed.

## Timing conventions (30fps)

- `three_text_intro`: 60–90 frames. Shorter reads as a flash, not an entrance.
- `particle_burst`: 40–60 frames. It's a beat, not a scene — let it land and move on.
- `shader_transition`: 30–45 frames. Long enough to register as intentional, short enough to stay a transition.
- `text_card`: 45–75 frames depending on copy length (roughly 3 frames/character as a floor, so it's actually readable).
- `video_clip`: no fixed range -- driven by the footage and what's being cut to, not a formula. See `skills/core/video-editing.md`.

## Color

Pick colors that read as your brand/mood, not the defaults from the M2 demo fixture (`#05050a` / `#7dd3fc` / `#141225`) — those were chosen to prove the effects render correctly, not as a design system. If the brief doesn't specify a palette, ask, or make one deliberate choice and say what it is in your checkpoint notes.
