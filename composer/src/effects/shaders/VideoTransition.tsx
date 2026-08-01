import { useThree } from "@react-three/fiber";
import { Video } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useRemotionEnvironment,
  useVideoConfig,
} from "remotion";
import { CanvasTexture } from "three";
import type { Cut } from "../../schema";

type VideoTransitionProps = Extract<Cut, { type: "video_transition" }>;

// Same fullscreen-quad-via-perspective-camera setup as ShaderTransition.tsx,
// deliberately not the orthographic-camera approach that silently failed to
// render in M2 (see skills/core/three-particles.md).
const FOV_DEGREES = 50;
const CAMERA_DISTANCE = 10;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uProgress;
  uniform sampler2D uFromTex;
  uniform sampler2D uToTex;
  uniform float uAspect;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 centered = (vUv - 0.5) * vec2(uAspect, 1.0);
    float dist = length(centered);
    float n = (hash(vUv * 40.0) - 0.5) * 0.12;
    float radius = uProgress * 1.3;
    float edge = smoothstep(radius - 0.08, radius + 0.08, dist + n);
    vec3 fromColor = texture2D(uFromTex, vUv).rgb;
    vec3 toColor = texture2D(uToTex, vUv).rgb;
    gl_FragColor = vec4(mix(toColor, fromColor, edge), 1.0);
  }
`;

// Second attempt at getting video frames into a Three.js texture. The first
// (useOffthreadVideoTexture, deprecated) LOOKED like it worked -- console
// logs showed the texture resolving -- but the actual captured screenshot
// stayed on the fallback color every time. Root cause, confirmed by reading
// remotion.dev/docs/videos/as-threejs-texture directly rather than
// continuing to guess: <ThreeCanvas> sets frameloop="never" during
// rendering and repaints via a `useEffect` keyed on frame change. Video
// frame extraction is async (a BroadcastChannel round-trip) and resolves
// *after* that effect already ran, so the canvas paints with the stale
// texture before the new frame is even drawn. The fix the docs prescribe:
// call `advance(performance.now())` (from useThree(), during rendering
// only -- `invalidate()` during interactive preview) inside onVideoFrame,
// forcing one more synchronous repaint right when the frame is ready.
const VideoTextureLoader: React.FC<{
  src: string;
  trimBeforeFrames: number;
  onTexture: (texture: CanvasTexture) => void;
}> = ({ src, trimBeforeFrames, onTexture }) => {
  const { width, height } = useVideoConfig();
  const { advance, invalidate } = useThree();
  const { isRendering } = useRemotionEnvironment();

  const [canvasStuff] = useState(() => {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
    const texture = new CanvasTexture(canvas as unknown as HTMLCanvasElement);
    return { canvas, context, texture };
  });

  useEffect(() => {
    onTexture(canvasStuff.texture);
  }, [canvasStuff.texture, onTexture]);

  const onVideoFrame = useCallback(
    (frame: CanvasImageSource) => {
      canvasStuff.context.drawImage(frame, 0, 0, width, height);
      canvasStuff.texture.needsUpdate = true;
      if (isRendering) {
        advance(performance.now());
      } else {
        invalidate();
      }
    },
    [canvasStuff, width, height, isRendering, advance, invalidate],
  );

  return (
    <Video
      src={staticFile(src)}
      onVideoFrame={onVideoFrame}
      trimBefore={trimBeforeFrames}
      muted
      headless
    />
  );
};

export const VideoTransition: React.FC<VideoTransitionProps> = ({
  fromSrc,
  fromTrimStart,
  toSrc,
  toTrimStart,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });

  const [fromTexture, setFromTexture] = useState<CanvasTexture | null>(null);
  const [toTexture, setToTexture] = useState<CanvasTexture | null>(null);

  const visibleHeight = 2 * CAMERA_DISTANCE * Math.tan(((FOV_DEGREES / 2) * Math.PI) / 180);
  const visibleWidth = visibleHeight * (width / height);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: progress },
      uFromTex: { value: fromTexture },
      uToTex: { value: toTexture },
      uAspect: { value: width / height },
    }),
    [progress, fromTexture, toTexture, width, height],
  );

  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        linear
        camera={{ position: [0, 0, CAMERA_DISTANCE], fov: FOV_DEGREES }}
      >
        <VideoTextureLoader
          src={fromSrc}
          trimBeforeFrames={Math.round(fromTrimStart * fps)}
          onTexture={setFromTexture}
        />
        <VideoTextureLoader
          src={toSrc}
          trimBeforeFrames={Math.round(toTrimStart * fps)}
          onTexture={setToTexture}
        />
        {fromTexture && toTexture ? (
          <mesh>
            <planeGeometry args={[visibleWidth, visibleHeight]} />
            <shaderMaterial
              vertexShader={vertexShader}
              fragmentShader={fragmentShader}
              uniforms={uniforms}
            />
          </mesh>
        ) : null}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
