# Stage: deliver director (spotlight-video)

Goal: hand over the episode in the form the user will actually publish
from, plus the audit trail.

## Procedure

1. Load the `render` checkpoint; verify the mp4 still exists and plays
   (ffprobe duration + a frame).
2. Assemble the delivery:
   - the mp4 (720x1280, h264) — upload-ready for 抖音/Shorts/Reels;
   - `*.props.json` — the exact authored spec, so the episode can be
     re-rendered or edited later without re-asking the model;
   - a one-screen note: which LLM/model authored it (from the
     `spotlight_script` checkpoint), the takeaway sentence, and the star
     count with its provenance (verified number vs. unknown).
3. **剪映 route** (optional, `jianying_draft`): if the user wants to add
   their own b-roll/audio, render the card with `transparent: true` +
   `codec="prores4444-alpha"` and pass it as an `overlays` entry on top of
   their footage instead of delivering a standalone video.
4. Series continuity: if this is episode N of a series, tell the user which
   episodes exist and that `index`/`total` in the props must be bumped for
   the next one — the progress bar and badge are generated from those two
   numbers, nothing is stored centrally.
5. Checkpoint `final_delivery` (`final_path` + `notes`). This stage has
   `human_approval_default: true` — the user confirms the episode reads
   correctly (facts, wording, look) before it counts as done.
