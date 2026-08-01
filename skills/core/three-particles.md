# 3D / GPU particle scenes (`composer/src/effects/three/`)

Built on `@remotion/three`'s `<ThreeCanvas>`, not a third-party particle library (wawa-vfx / Three-VFX were evaluated but are designed for real-time `useFrame()`-driven apps; adapting them to Remotion's per-frame-independent rendering model is the same amount of work as writing the effect directly against Three.js, so that's what `ParticleBurst.tsx` and `TextIntro3D.tsx` do).

## The one rule that matters: frame-purity

Remotion may render frames out of order or in parallel across workers. Every visual property must be a pure function of `frame` / `progress` (`frame / durationInFrames`). Concretely:

- Never use R3F's `useFrame()` — it's a continuous real-time clock loop and Remotion disables it anyway.
- Never accumulate state across renders (no `useState` counters, no velocity integration). Compute position/opacity/scale directly from `progress` each render.
- Random-looking per-particle variation (direction, speed, size) must come from `deterministicRandom.ts`'s `seededRandom(index)` — a hash function, not `Math.random()`. Same index always produces the same value, so particle setup is identical no matter which frame renders first.
- Colors passed into a raw `THREE.ShaderMaterial` must go through `hexColor.ts`'s `hexToThreeColor()`, not `new THREE.Color(hexString)`. See "Color management gotcha" below — this one cost real debugging time.
- Verify a new effect is actually frame-pure by rendering the same frame twice (`npx remotion still ... --frame=N`, twice, to different files) and diffing (`cmp`/`md5`). Byte-identical or it's not pure.

## Color management gotcha

`new THREE.Color("#hex")` runs the value through three.js's automatic sRGB→linear decode (`ColorManagement` is on by default). That's correct for materials three.js re-encodes on output (`MeshStandardMaterial` etc — this is why `TextIntro3D.tsx`'s lit mesh uses plain hex strings directly and looks right). A raw `ShaderMaterial` writes `gl_FragColor` straight to the framebuffer with **no** re-encoding, so that automatic decode just makes everything render far too dark — a `#141225` background rendered as roughly `(2,2,5)` instead of `(20,18,37)`. Always use `hexToThreeColor()` when feeding a color into a hand-written GLSL shader's uniforms.

## Fullscreen-quad shaders (`effects/shaders/ShaderTransition.tsx`)

Don't reach for `orthographic` on `<ThreeCanvas>` for a fullscreen quad — explicit `left/right/top/bottom` bounds passed via the `camera` prop were tried and the plane silently failed to appear (R3F didn't apply the bounds the way expected, and it wasn't worth the time to find out why). The working pattern: a normal perspective camera at a fixed distance, with a plane sized to exactly fill that camera's frustum at that distance:

```ts
const visibleHeight = 2 * DISTANCE * Math.tan((FOV_DEGREES / 2) * Math.PI / 180);
const visibleWidth = visibleHeight * (width / height);
```

Reuses the exact camera setup already proven correct by `ParticleBurst`/`TextIntro3D`, rather than debugging a second unproven code path.

## SSR requirement

`composer/remotion.config.ts` sets `Config.setChromiumOpenGlRenderer("angle")` — required for any of this to render headlessly at all. Don't remove it.
