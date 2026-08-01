# Assets Director

Produce the `assets_manifest` artifact (`schemas/artifacts/assets_manifest.schema.json`): `{ narration_audio_path, music_audio_path, footage_paths }`. Not every field is required — a pure-typography/particle trailer may need none of them.

## Deciding what to generate

- **Narration**: only if the brief actually calls for a voiceover line (most cinematic-trailer briefs don't — they're visual, not narrated). If yes, call `macos_say_tts` (`tools/audio/local_tts.py`) via the registry: zero-setup, local, good enough for timing/pacing decisions. Swap for a real provider before final delivery if voice quality matters — that's a paid-tier tool this repo doesn't have yet (see `AGENT_GUIDE.md` on provider scoring once more than one option exists for a capability).
- **Music**: `placeholder_music` (`tools/audio/placeholder_music.py`) gives a duration-correct synthesized pad, always available, zero setup. It is explicitly not a creative deliverable (its own `not_good_for` says so) — treat it as filling the slot so `compose` can be tested, not as the final score.
- **Footage**: only relevant if a cut type ends up needing real video texture (none of the current four cut types do — `three_text_intro`/`particle_burst`/`shader_transition` are procedural, `text_card` is text-only). `pexels_stock_footage` needs `PEXELS_API_KEY`, which isn't configured in this repo yet; check with `tool.check_dependencies()` before attempting, and don't block the pipeline on it — leave `footage_paths: []` and note in the checkpoint that footage was skipped.

## How to call a tool

```python
from tools.tool_registry import ToolRegistry

registry = ToolRegistry()
registry.discover()
tool = registry.get("macos_say_tts")
result = tool.execute(text="...", output_path=Path("generated/assets/<project_id>/narration.wav"))
```

Write outputs under `generated/assets/<project_id>/` (per `config.yaml`'s `paths.assets_dir`). Audio doesn't need to go anywhere near `composer/public/` -- `compose` mixes `music_audio_path`/`narration_audio_path` in with a post-render `ffmpeg` mux, not by threading it through a Remotion `staticFile()` reference (see `compose-director.md`).
