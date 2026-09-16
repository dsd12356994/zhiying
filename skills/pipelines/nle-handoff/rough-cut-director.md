# Stage: rough-cut director (nle-handoff)

Goal: one auditable first-pass cut of the source, plus the **exact cut
decision list** the timeline stage will consume. Read
`skills/core/nle-timeline-export.md` first — its ground rules apply.

## Procedure

1. Load the `brief` checkpoint. Confirm the source file still exists at
   the recorded path.
2. Choose the edit rule from what the brief says about the footage:
   - talking-head / voice present → `audio:threshold=4%` (default)
   - no audio or visual action matters → `motion:threshold=3`
   - both matter → combine with `or`
   Margin default `0.2sec` (keeps cuts from feeling like dropouts).
3. Run `auto_editor` **twice**, both into the stage output dir:
   - `mode="render"` → the cut media (`<stem>_cut.mp4`)
   - `mode="timeline", export="resolve"` → the FCPXML carrying exact
     rational-time cut decisions. This file is the real deliverable of
     this stage; the render is the preview.
4. Sanity-check the cut: `ffprobe` the render — duration should equal
   the sum of kept segments. If it equals the source duration, the rule
   matched nothing (wrong threshold for this audio level) — adjust, rerun.
5. Checkpoint `rough_cut` (schema requires media_path, cut_path,
   edit_rule, margin — include fcpxml_path). The edit rule and margin
   must be recorded verbatim: a cut the user can't audit is a cut they
   can't trust.

## Do not

- Re-encode or touch the source media (immutable).
- Hand-tune segments here — creative trimming belongs to the human in
  their NLE, or to a later agent stage with its own review focus.
