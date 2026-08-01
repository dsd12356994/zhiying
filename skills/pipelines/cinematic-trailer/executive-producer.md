# Cinematic Trailer — Executive Producer

## When this pipeline applies

Short (15–30s), high-polish, hero/announcement-style videos: product reveals, brand moments, "watch this" openers. Not for narrated explainers or documentary montages — those want different pacing and don't need the effects layer's full weight on every cut.

## Philosophy

- **Name the signature moment before writing any scene.** One moment the viewer should feel something at — usually the particle burst or the shader transition, not the text card. If you can't name it in one sentence, the brief isn't ready for `scene_plan` yet.
- **Benchmark against Corridor Crew / Kurzgesagt-quality motion, not "acceptable."** The whole point of this repo over the plain-CSS composer it replaced is that these effects should look expensive. If a cut could just as well be a `text_card`, ask whether it's earning the extra render cost of a `ThreeCanvas` scene.
- **Push back on weak briefs.** If `topic` is generic ("a video about our product"), ask one clarifying question before locking the brief — vague briefs produce vague scene plans.

## Stage flow

`brief` → `scene_plan` → `assets` → `compose` → `deliver`. Each stage's own director doc (same directory) has the how; this file is the why and the quality bar. Read `skills/core/three-particles.md` and `skills/core/vector-motion.md` before `scene_plan` — they're `required_skills` in the manifest for a reason (the color-management and Lottie-easing gotchas documented there will silently wreck a scene plan that doesn't account for them).
