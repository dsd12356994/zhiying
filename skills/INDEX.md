# Skills Index

Three-layer knowledge architecture. Read in this order when starting any stage of work:

1. **Layer 1 — what tools exist**: query `tools/tool_registry.py::ToolRegistry` at runtime. Don't guess capabilities from memory.
2. **Layer 2 — how this project uses them** (this directory):
   - `skills/core/` — technique guides that apply across pipelines (Remotion rendering, GPU particle usage, shader transitions, color grading, subtitle sync).
   - `skills/creative/` — creative technique guides (b-roll planning, storytelling, typography, video editing judgment).
   - `skills/meta/` — cross-cutting behavioral rules, always active regardless of pipeline (checkpoint protocol, bespoke-composition rules, reviewer/quality-gate protocol).
   - `skills/pipelines/<name>/` — stage-director docs for a specific `pipeline_defs/<name>.yaml`. Read the stage director for your current stage before doing any work in it.
3. **Layer 3 — vendored external API docs**, loaded on demand per-tool (added as tools are built in M3; not present yet).

## Current pipelines

- `skills/pipelines/cinematic-trailer/` — flagship style, 15–30s, 3D/particle/shader-heavy. Manifest: `pipeline_defs/cinematic-trailer.yaml`. Stages: `brief` → `scene_plan` → `assets` → `compose` → `deliver`.
- `skills/pipelines/nle-handoff/` — rough cut + NLE timeline handoff. Manifest: `pipeline_defs/nle-handoff.yaml`. Stages: `brief` → `rough_cut` → `timeline` (OTIO IR) → `deliver`.

## Current core/creative skills

- `skills/core/three-particles.md` — frame-purity rules, the color-management gotcha, and the fullscreen-quad shader pattern for `composer/src/effects/three/` and `effects/shaders/`.
- `skills/core/vector-motion.md` — Lottie/Rive wrapper usage (`effects/vector/`), including the Bodymovin easing gotcha that looks like a determinism bug but isn't.
- `skills/core/video-editing.md` — real footage via `video_clip` (`composer/src/scenes/VideoClip.tsx`), trim semantics, and the placeholder-footage-until-Pexels-is-configured story.
- `skills/core/nle-timeline-export.md` — rough cuts + NLE timeline handoff (Premiere/Resolve/FCP/Shotcut/Kdenlive) via `tools/video/auto_edit.py`; source-media-immutability and audit rules. 剪映 delivery is `tools/video/jianying_draft.py` (used by the nle-handoff deliver stage).
- `skills/core/resolve-control.md` — live DaVinci Resolve control (**UNTESTED until a Resolve machine exists**; today's tested Resolve path is FCPXML export + manual import). Route A: davinci-resolve-mcp. Route B: `tools/video/resolve_control.py`.
- `skills/core/motion-graphics-overlay.md` — plain-language → transparent motion-graphics clip (stat_card + ProRes 4444 alpha render) → 剪映 overlay track or any NLE. The "say it AND show it" workflow.

*(`skills/creative/` still empty -- add guides there as pipelines actually need creative judgment codified, not speculatively.)*
