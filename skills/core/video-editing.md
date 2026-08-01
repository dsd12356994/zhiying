# Real video clips (`composer/src/scenes/VideoClip.tsx`)

The `video_clip` cut type is the first (and so far only) cut that plays actual footage rather than generating a scene procedurally. It's a thin wrapper around Remotion's `OffthreadVideo`:

```ts
{
  type: "video_clip",
  durationInFrames: 90,
  src: "footage/ocean.mp4",   // resolved via staticFile() -- must live under composer/public/
  trimStart: 4.5,              // seconds into the SOURCE file to start playback from
  fit: "cover",                // "cover" | "contain" | "fill", default "cover"
  volume: 1,                   // 0-1, default 1
}
```

## Trim semantics

`trimStart` is authored in seconds because that's what a human (or an agent writing a scene plan) naturally thinks in; the component converts it to frames (`Math.round(trimStart * fps)`) and passes it as `OffthreadVideo`'s `startFrom` prop. There's no `trimEnd` field -- the cut's own `durationInFrames` (the same field every other cut type already has) controls how long it plays, exactly like it does for every other cut. Don't add a separate end-trim field; it would just be a second way to express the same thing.

## Sourcing footage

`pexels_stock_footage` (`tools/video/stock_footage.py`) needs `PEXELS_API_KEY`, which isn't configured in this repo yet. Until it is, use `placeholder_footage` (`tools/video/placeholder_footage.py`) -- ffmpeg-synthesized, zero setup, always available, same `not_good_for: ["final delivery"]` contract as `placeholder_music`. It generates an *animated* test pattern (`testsrc2`, not a still frame) specifically so that trimming it at different `trimStart` values is visibly verifiable -- if you're testing trim logic and the source is a static image, you can't actually tell whether the trim did anything.

## Timing convention (30fps)

No fixed range the way the procedural cut types have one -- a `video_clip`'s natural length depends entirely on the footage and what's being cut to. Use the surrounding scene plan's pacing (and the source clip's own content) as the guide, not a formula.

## Transitioning between two clips (`composer/src/effects/shaders/VideoTransition.tsx`)

`video_transition` applies `shader_transition`'s radial-wipe treatment (same GLSL, `skills/core/three-particles.md`) between two real clips instead of two flat colors:

```ts
{
  type: "video_transition",
  durationInFrames: 45,
  fromSrc: "footage/scene-a.mp4",
  fromTrimStart: 8.0,   // where scene-a should be when the transition starts
  toSrc: "footage/scene-b.mp4",
  toTrimStart: 0,        // where scene-b should be when the transition ends
}
```

Use it *between* two `video_clip` cuts, picking `fromTrimStart`/`toTrimStart` to match where those clips actually left off/pick up, so the transition reads as continuous rather than each side jumping to frame 0. Don't use it as an opener -- like `shader_transition`, it needs real content on both sides.

### The texture-loading gotcha that cost real debugging time

Getting a video frame into a Three.js texture has two APIs, and the obvious one is a trap:

- `useOffthreadVideoTexture` (`@remotion/three`) is **deprecated**, and empirically doesn't actually work for this: the console shows the texture resolving, but the captured render frame stays on the fallback color every time. Root cause (confirmed by reading `remotion.dev/docs/videos/as-threejs-texture`, not guessed): `<ThreeCanvas>` sets `frameloop="never"` during rendering and repaints via a `useEffect` on frame change; video-frame extraction is an async `BroadcastChannel` round-trip that resolves *after* that effect already ran, so the canvas is captured with the stale texture.
- The current approach: `<Video src={...} onVideoFrame={...} muted headless />` from `@remotion/media`, drawing each frame into an `OffscreenCanvas` -> `CanvasTexture`, **and calling `advance(performance.now())`** (from `useThree()`, only when `useRemotionEnvironment().isRendering` is true -- use `invalidate()` in interactive preview) inside `onVideoFrame`. `advance()` forces the one extra synchronous repaint that makes the just-drawn frame actually show up in the capture. Skip it and you're back to a stale-frame render that *looks* fine in the browser console and is wrong in the output.
- `trimBefore`/`trimAfter` on `<Video>` are in frames, same convention as `OffthreadVideo`'s `startFrom`/`endAt` -- confirmed the same way `video_clip`'s trim was (burned-in `testsrc2` timecode matching `trimStart + local_frame/fps` exactly).
