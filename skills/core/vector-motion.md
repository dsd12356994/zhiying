# Lottie / Rive scenes (`composer/src/effects/vector/`)

## Lottie (`LottieScene.tsx`)

Thin wrapper around `@remotion/lottie`'s `<Lottie animationData={...}>`. It takes a parsed JS object (import the `.json` directly — `tsconfig.json` has `resolveJsonModule: true`), not a URL, and it's already frame-synced internally, so no extra determinism work is needed here (unlike the `effects/three/` components).

Hand-authoring a Lottie/Bodymovin JSON fixture (see `fixtures/pulse.lottie.json`) works, but every animated keyframe (`"a": 1`) except the last one **must** include `i`/`o` bezier easing objects, e.g. for linear interpolation:

```json
{ "t": 0, "s": [0], "o": { "x": [0], "y": [0] }, "i": { "x": [1], "y": [1] } }
```

Omit them and lottie-web doesn't error — it just silently fails to animate the property, freezing it at the first keyframe's value. This is the same failure mode as an actual determinism bug (looks "frozen" when you sample frames), so don't assume a frozen-looking Lottie property means a Remotion-side issue before checking this first.

## Rive (`RiveScene.tsx`)

Wraps `@remotion/rive`'s `RemotionRiveCanvas`. Code-complete and typechecked but **not smoke-tested** — it needs a real `.riv` binary asset authored in the Rive editor (a GUI tool), which can't be hand-written the way the Lottie JSON fixture was. Wire up a real `.riv` file via `staticFile()` once one exists (from a future asset-generation pipeline stage, or supplied directly by the user) before trusting this path.
