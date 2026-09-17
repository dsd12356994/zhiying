# Stage: compose director (spotlight-video)

Goal: turn the validated `spotlight_script` into a real rendered mp4, and
**look at it** before claiming success.

## Procedure

1. Load the `spotlight_script` checkpoint (props for one cut).
2. Wrap it into composition props:
   ```json
   {"fps": 30, "width": 720, "height": 1280, "transparent": false,
    "cuts": [ {…props…, "durationInFrames": 210} ]}
   ```
   Use the `Spotlight` composition. (For overlay use instead of a
   standalone video, set `transparent: true` and render with
   `codec="prores4444-alpha"` — see skills/core/motion-graphics-overlay.md.)
3. Call `remotion_render` (composition `Spotlight`, codec `h264`). Its
   props file is written next to the output as `<name>.props.json` — the
   exact input is therefore always reproducible.
4. **Visual QC is mandatory.** Extract a frame and actually inspect it:
   - local VLM: `cangjie_demo/content_preprocessor/vlm.py`'s
     `QwenVLProvider` reads a frame and reports clipping/overlap/blank
     areas (this is how the template itself was verified — see the
     commit history);
   - or hand the frame to the human.
   An exit code of 0 only means Remotion finished, not that the card
   looks right. A frame review that finds nothing is the evidence.
5. Checkpoint `render` with `output_path`, `props_path`, `duration_seconds`.

## Known traps

- Only `--pixel-format=yuva444p10le` + `--image-format=png` keeps alpha;
  plain ProRes silently loses it.
- Long titles overflow the browser bar — the template ellipsizes, but a
  40-character project name still reads badly; ask the author stage to
  shorten instead of accepting it.
- Text sizes scale from canvas width (`s = width/720`), so changing the
  canvas to 1080x1920 keeps proportions — don't hand-edit sizes.
