# Compose Director

Turn `scene_plan` + `assets_manifest` into the `render` artifact (`schemas/artifacts/render.schema.json`): `{ output_path, props_path, duration_seconds }`.

## Steps

1. Write `scene_plan` out as a JSON props file — its shape already matches `composer/src/schema.ts`'s `CompositionProps` directly, so this is usually a literal dump, not a transform. Save it under `generated/pipelines/<project_id>/props.json` (that's `props_path`).
2. Render (this produces picture only -- no `Cut` type currently has an audio field, so there's nothing for Remotion to mix in):
   ```
   cd composer && npx remotion render src/index.tsx CinematicTrailer <output_path> --props=<props_path>
   ```
3. If `assets_manifest` has a `music_audio_path` and/or `narration_audio_path`, mux it in as a separate post-render step rather than threading it through the composer -- simpler, and doesn't require touching the effects layer:
   ```
   ffmpeg -y -i <silent_render>.mp4 -i <music_audio_path> -c:v copy -c:a aac -b:a 128k -shortest <output_path>
   ```
   (`-shortest` matters: the placeholder music tool is always given the exact scene_plan duration, but don't assume every audio source will be -- this keeps the final file's duration locked to the picture, not the audio.)
4. Verify before checkpointing `completed`, don't just trust a zero exit code:
   ```
   ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 <output_path>
   ```
   Confirm `duration` matches `scene_plan`'s total `durationInFrames / fps` (within a frame or two of rounding), and that both a video and an audio stream are present if `assets_manifest` had audio.

## If the render fails or looks wrong

Check `skills/core/three-particles.md` first — the two bugs documented there (color-management darkening, orthographic-camera framing) are exactly the kind of thing that produces a render that "succeeds" (correct exit code, valid mp4) but is visually wrong. Don't just eyeball a still — when in doubt, sample pixel values the way M2's verification did (`generated/output/` still has the debug scripts from that milestone as a reference pattern, even though the files themselves are gitignored).
