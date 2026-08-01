import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Cut } from "../../schema";
import { hexToThreeColor } from "../three/hexColor";

type ShaderTransitionProps = Extract<Cut, { type: "shader_transition" }>;

// GL-transitions-style effect authored directly against @remotion/three
// rather than importing a third-party gl-transitions wrapper, so the same
// frame-purity guarantee applies (uProgress is the only time input, derived
// straight from useCurrentFrame() -- no clock, no accumulated state).
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uProgress;
  uniform vec3 uFromColor;
  uniform vec3 uToColor;
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
    vec3 color = mix(uToColor, uFromColor, edge);
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Fullscreen quad via a perspective camera at a known distance, sized to
// exactly fill that camera's frustum -- reuses the perspective-camera setup
// already proven correct in TextIntro3D/ParticleBurst. An orthographic
// camera with explicit left/right/top/bottom bounds was tried first and the
// plane never appeared (R3F didn't apply those bounds the way expected);
// rather than debug that further, this sidesteps it entirely.
const FOV_DEGREES = 50;
const CAMERA_DISTANCE = 10;

export const ShaderTransition: React.FC<ShaderTransitionProps> = ({ fromColor, toColor }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });

  const uniforms = useMemo(
    () => ({
      uProgress: { value: progress },
      uFromColor: { value: hexToThreeColor(fromColor) },
      uToColor: { value: hexToThreeColor(toColor) },
      uAspect: { value: width / height },
    }),
    [progress, fromColor, toColor, width, height],
  );

  const visibleHeight = 2 * CAMERA_DISTANCE * Math.tan(((FOV_DEGREES / 2) * Math.PI) / 180);
  const visibleWidth = visibleHeight * (width / height);

  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 0, CAMERA_DISTANCE], fov: FOV_DEGREES }}
      >
        <mesh>
          <planeGeometry args={[visibleWidth, visibleHeight]} />
          <shaderMaterial
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={uniforms}
          />
        </mesh>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
