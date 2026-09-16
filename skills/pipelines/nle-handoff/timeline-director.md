# Stage: timeline director (nle-handoff)

Goal: turn the rough cut's decision list into the **OpenTimelineIO IR**
and multi-NLE exports. This is the mid-term roadmap piece
(docs/research/ai-video-editing-landscape.md §4 item 4) made real.

## Procedure

1. Load the `rough_cut` checkpoint; read its `fcpxml_path`.
2. Parse it with `tools/video/otio_timeline.py::
   segments_from_auto_editor_fcpxml()` → (media_path, segments in exact
   rational seconds). **Do not re-measure from the rendered cut** —
   floats re-derived from a render compound quantization; the FCPXML is
   the source of truth.
3. Run `lib/quality_gates.py::run_timeline_gates(segments,
   source_duration_seconds=<brief's probed duration>,
   media_path=...)`. Fix any fail finding before proceeding — each one
   is a timeline that would break in a real NLE.
4. Run `otio_timeline` tool with `formats=("otio", "fcpxml", "edl")`
   (add more consumers only if the brief asks). Verify each file was
   written and is non-empty.
5. Checkpoint `timeline_ir` with segments (as rational strings),
   exports list, `qc_passed: true`.

## Extending beyond a rough cut

When the agent starts *authoring* edit decisions (not just converting
auto-editor's), build the segment list itself — same gates, same IR.
Effect/color intent does NOT go into OTIO (it carries edit decisions
only): record intent in the artifact's `notes`/segment `note` fields and
translate per-NLE at export time.

## Known limitation

The OTIO timeline references media by absolute path (as auto-editor's
FCPXML does). Moving/renaming media after this stage breaks relink —
the artifact schema records media_path so this is auditable.
