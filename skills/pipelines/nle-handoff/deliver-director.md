# Stage: deliver director (nle-handoff)

Goal: hand the user a package they can open in their NLE and keep
working — plus an honest statement of what they're getting.

## Procedure

1. Load the `timeline_ir` checkpoint. Verify every listed export file
   still exists and is non-empty.
2. Assemble the delivery dir (under the project's output area):
   - `timeline.otio` — the canonical IR
   - `timeline.fcpxml` / `timeline.edl` — NLE imports
   - the rough-cut render, as a preview of what the timeline plays like
   - a short README (or checkpoint notes) telling the user: which file
     to import into which NLE, that media must stay at its recorded
     path for relink, and what the edit rule was.
3. **剪映 users**: if the brief's handoff intent names 剪映/CapCut (or the
   user's machine has JianyingPro installed — check
   `%LOCALAPPDATA%\JianyingPro\User Data\Projects\com.lveditor.draft`),
   additionally run `jianying_draft` with the SAME segments (they're in
   the timeline_ir artifact) — it writes a draft directly into the 剪映
   draft folder, so the user just opens 剪映 and the project is there,
   no import step. Record `draft_path` in the delivery notes. The tool
   replaces same-name drafts (`allow_replace`) — never point it at a
   name the user cares about. Caveat: the draft references media by
   absolute path, so media must stay put (same as the XML exports).
4. Checkpoint `final_delivery` (`final_path` = the delivery dir or its
   README; `notes` = the handoff instructions). This stage has
   `human_approval_default: true` — the user confirms the package
   actually opens in their NLE (or 剪映) before the pipeline is "done".
   If it doesn't, that's a real finding: fix or record, don't ship hopeful.

## Do not

- Bake a final video here — this pipeline's product is the *editable
  timeline*. If the user wants a rendered final, that's the compose
  stage of a different pipeline consuming the same IR.
