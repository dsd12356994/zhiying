# Skill: Live DaVinci Resolve control (UNTESTED — needs a Resolve machine)

> **Status: written but NOT live-tested.** No Resolve installation exists
> on the machine this was authored on (2026-09-16). Everything below is
> based on the Resolve Scripting API docs and davinci-resolve-mcp's
> README (see docs/research/ai-video-editing-landscape.md §3.1). The first
> agent to run this skill on a Resolve machine MUST verify each claim,
> fix what's wrong, and delete this banner. Until then, "drive Resolve"
> for zhiying means the tested path: `otio_timeline` FCPXML export +
> manual import.

## Goal

Let the agent operate a *running* DaVinci Resolve like a human editor:
create projects, import the timelines we already produce as FCPXML,
queue renders, read back status — from the same agent-driven pipeline
that today ends at exported files.

## Two routes, in order of preference

### Route A (preferred): davinci-resolve-mcp

[samuelgursky/davinci-resolve-mcp](https://github.com/samuelgursky/davinci-resolve-mcp)
(2.8k★, MIT, actively maintained) is the reference implementation — 341
tools claiming full coverage of the Resolve Scripting API, plus offline
.drp/.drt/.drx project-file editing that doesn't need Resolve running.

- Install: `npx davinci-resolve-mcp` (Node ≥18, Resolve running).
- Read its README's tool-grouping and **plan → review → confirm** model
  before driving anything destructive. Adopt that discipline verbatim:
  the agent composes an operation plan, shows it, and only a confirm
  applies it.
- Requires Resolve Studio for external control (free version needs its
  in-app bridge — see the MCP's own docs; that bridge can break on
  Blackmagic updates).

### Route B (fallback / no MCP): direct Scripting API

`tools/video/resolve_control.py` (in this repo, dependency-gated,
**untested**) wraps the minimal surface zhiying needs:

1. **Connect** — Resolve must be *running* (it cannot run headless; plan
   infrastructure accordingly, e.g. a Windows VM with auto-login).
   External Python control needs Studio; free-version scripts must run
   from Resolve's own scripting menu.
2. **import_timeline** — `ProjectManager.CreateProject` →
   `MediaPool.ImportMedia([fcpxml])` — importing a timeline file creates
   the timeline in the project. Feed it the FCPXML our `otio_timeline`
   tool already produces (that path is live-tested end to end).
3. **render** — `LoadRenderPreset` / `SetRenderPreset` →
   `AddRenderJob` → poll `GetRenderJobStatus`. Never block the agent
   loop on a render: poll checkpoints instead.

## Safety rules (from davinci-resolve-mcp's model — adopt as-is)

1. **Source media is immutable.** Resolve operations get their own
   project/bin; never modify media files on disk.
2. **Destructive ops are plan → confirm.** Anything that deletes a
   project/timeline/render job must be composed, displayed, and
   explicitly confirmed by the user or the pipeline's
   `human_approval_default` gate — never fired inline.
3. **Honest capability boundary.** Like davinci-resolve-mcp says of
   itself: this is a first-pass assistant editor, not a judge of cuts.
   Creative review stays with scene_plan/humans.
4. **Version drift is real.** Resolve point releases break API surface;
   when this skill is first live-tested, record the exact Resolve
   version in this file and re-verify on upgrades (the MCP repo's
   api-coverage/live-test doc pattern is the model).

## When you DO get a Resolve machine: verification checklist

Run these in order, fix what breaks, then remove the banner:

1. Resolve running, Studio licensed (or in-app script executed for free).
2. `resolve_control` connect → returns real version string.
3. Generate an FCPXML via `otio_timeline` from any test clip →
   import_timeline → assert `GetCurrentTimeline()` duration matches.
4. render to a scratch dir → valid non-empty mp4 via ffprobe.
5. Record: Resolve version, OS, free/Studio, quirks found.
