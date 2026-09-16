# Skill: NLE timeline export (auto-editor)

**Applies to:** any pipeline stage that has real footage and wants a rough
cut, or any `deliver` stage whose consumer is a human editor working in a
real NLE (DaVinci Resolve, Premiere, Final Cut Pro, Shotcut, Kdenlive).

**Tool:** `tools/video/auto_edit.py::AutoEditorTool` (capability
`rough_cut`, provider `auto-editor`). Wraps the
[auto-editor](https://github.com/WyattBlue/auto-editor) CLI (Unlicense).
Context and survey: `zhiying/docs/research/ai-video-editing-landscape.md`.

## When to use

- Long talking-head/raw footage where dead air should go before creative
  editing starts (`mode="render"`, then feed the cut to later stages).
- The deliverable should be "an editable timeline in my NLE", not a baked
  video: `mode="timeline"` writes a timeline file the user opens and keeps
  editing — cut decisions travel, media stays where it is.
- **Not** for creative decisions: it detects silence/motion, it does not
  pick takes, pace a story, or judge content. `scene_plan` stays the
  creative authority; this is first-pass assembly only.

## How to call

```python
from tools.tool_registry import ToolRegistry
reg = ToolRegistry(); reg.discover()
tool = reg.get("auto_editor")  # or get_by_capability("rough_cut")

# 1) Rough-cut render (dead air removed)
tool.execute(
    input_path=raw_take, output_dir=stage_out,
    mode="render", edit="audio:threshold=4%", margin="0.2sec",
)

# 2) Timeline handoff to the user's NLE
tool.execute(
    input_path=raw_take, output_dir=stage_out,
    mode="timeline", export="resolve",  # premiere|resolve|final-cut-pro|shotcut|kdenlive
)
```

Edit rules compose: `"audio:threshold=4% or motion:threshold=3"`. Streams
can differ: `"audio:stream=0:motion:stream=1"`.

## Ground rules

1. **Source media is immutable.** Outputs go to the stage's output dir
   only. Never write next to the input (the tool enforces an explicit
   `output_dir`; don't try to bypass it).
2. **Always state what was cut.** When checkpointing a stage that used
   this tool, record the edit rule and margin in the checkpoint `notes` —
   a cut the user can't audit is a cut they can't trust.
3. **Timeline export is a decision artifact, not a render.** The XML/MLT
   file references the source media by path; moving/renaming media after
   export breaks relink. Record media paths in the checkpoint artifact.
4. Dependencies: `auto-editor` on PATH (`pip install auto-editor`),
   ffmpeg present for some input formats. `check_dependencies()` gates it.
5. Roadmap position: this is the short-term piece of the NLE strategy
   (survey §4). Mid-term, timeline decisions should be authored as OTIO
   objects instead of auto-editor's one-shot rules; treat this tool as the
   proven seam, not the end state.
