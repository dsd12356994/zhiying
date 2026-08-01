# Scene Plan Director

Turn the `brief` artifact into a `scene_plan` artifact: `{ fps, width, height, cuts: [...] }`, matching `schemas/artifacts/scene_plan.schema.json` for the stage contract and `composer/src/schema.ts`'s zod `cutSchema` for the actual per-cut fields (the Python-side schema deliberately doesn't duplicate those — see the schema file's own description).

## The four cut types (`composer/src/effects/`)

| type | good for | avoid when |
|---|---|---|
| `three_text_intro` | opening title/logo moment, needs weight | more than once per video — it's the opener, not a recurring beat |
| `particle_burst` | the signature moment, a transition that should feel like a release of energy | back-to-back with `shader_transition` — two "transition" cuts in a row reads as indecisive, not intentional |
| `shader_transition` | a mood/scene shift (e.g. dark → brand color) | using it as an opener — it needs something before and after to transition *between* |
| `text_card` | copy that needs to be read (taglines, stats, CTAs) | using it for everything — it's the cheapest-looking cut, don't let the plan lean on it |

## Rules (enforced by `success_criteria` in the manifest, check them yourself before checkpointing)

- Cuts' `durationInFrames` must sum to `brief.duration_seconds * fps` within one second.
- No two consecutive cuts share a `type`.
- At least one cut must be `three_text_intro`, `particle_burst`, or `shader_transition` — a scene plan that's all `text_card` isn't using this pipeline for what it's for.

## Timing conventions (30fps)

- `three_text_intro`: 60–90 frames. Shorter reads as a flash, not an entrance.
- `particle_burst`: 40–60 frames. It's a beat, not a scene — let it land and move on.
- `shader_transition`: 30–45 frames. Long enough to register as intentional, short enough to stay a transition.
- `text_card`: 45–75 frames depending on copy length (roughly 3 frames/character as a floor, so it's actually readable).

## Color

Pick colors that read as your brand/mood, not the defaults from the M2 demo fixture (`#05050a` / `#7dd3fc` / `#141225`) — those were chosen to prove the effects render correctly, not as a design system. If the brief doesn't specify a palette, ask, or make one deliberate choice and say what it is in your checkpoint notes.
