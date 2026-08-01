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
