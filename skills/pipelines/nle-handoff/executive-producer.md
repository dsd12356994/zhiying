# Stage: executive producer (nle-handoff)

You are deciding **what this production is** before anything is cut. For
this pipeline the brief is small and concrete — but every field must be
real, not placeholder.

## What the brief must contain (schemas/artifacts/brief.schema.json)

- `topic` — what the footage is and what the human editor needs out of it.
- `duration_seconds` — the *source* duration (ffprobe it; this is the
  contract the timeline gates check against later — a wrong number here
  fails the timeline stage, not this one, so get it right now).
- `signature_moment` — for this pipeline: **the handoff intent**. Which
  NLE the user works in, and what the human is expected to do after the
  timeline lands (finish creative edits, color, export for a platform).
  Repurpose the field honestly — it forces naming the *point* of the
  handoff instead of producing files nobody asked for.

## Rules

1. Point at a real media file the user supplied (or one already in the
   project dir). Never invent or download footage for this pipeline —
   its whole value is editing *the user's* material.
2. Probe the source: `ffprobe` duration, streams, audio presence. If
   there is no audio, say so — auto-editor's default `audio:` edit rule
   will keep everything, and the rough-cut stage needs to switch to
   `motion:` or a combined rule.
3. Ask the user anything material that's ambiguous (which NLE, how
   aggressive the rough cut should be). This stage has
   `human_approval_default: true` — don't checkpoint until the human
   confirmed the intent.
4. Checkpoint as `brief` (validated against its schema) before moving on.
