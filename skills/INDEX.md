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

- `skills/pipelines/cinematic-trailer/` — flagship style, 15–30s, 3D/particle/shader-heavy. (Being built in M4.)

## Current core/creative skills

- `skills/core/three-particles.md` — frame-purity rules, the color-management gotcha, and the fullscreen-quad shader pattern for `composer/src/effects/three/` and `effects/shaders/`.
- `skills/core/vector-motion.md` — Lottie/Rive wrapper usage (`effects/vector/`), including the Bodymovin easing gotcha that looks like a determinism bug but isn't.

*(creative/ and remaining core/ guides populated as M3–M5 land.)*
