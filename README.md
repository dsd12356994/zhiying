# zhiying

Headless, agent-driven video production pipeline. You describe a video in plain language; a coding agent (Claude Code or equivalent) reads this repo's pipeline manifests and skills, calls tools itself, and produces a finished render — no server, no chat-bot layer, no manual timeline editing.

Composition/rendering runs on [Remotion](https://remotion.dev), upgraded with a real 3D/particle/shader effects layer (`composer/src/effects/`) so output quality isn't capped at CSS transforms.

Start here: [`AGENT_GUIDE.md`](AGENT_GUIDE.md) → [`skills/INDEX.md`](skills/INDEX.md).

## Status

Scaffolding in progress. See `AGENT_GUIDE.md` for the current architecture; pipelines and tools are being built out milestone by milestone (composer foundation → effects layer → tool layer → pipeline layer → quality gates).
