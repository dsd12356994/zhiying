import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import type { Cut } from "../../schema";
import { seededRandom } from "./deterministicRandom";
import { hexToThreeColor } from "./hexColor";

type ParticleBurstProps = Extract<Cut, { type: "particle_burst" }>;

const vertexShader = `
  attribute vec3 aDirection;
  attribute float aSpeed;
  uniform float uProgress;
  uniform float uMaxDistance;
  varying float vOpacity;

  void main() {
    float eased = 1.0 - pow(1.0 - uProgress, 3.0);
    vec3 pos = position + aDirection * aSpeed * eased * uMaxDistance;
    vOpacity = smoothstep(0.0, 0.12, uProgress) * (1.0 - smoothstep(0.65, 1.0, uProgress));
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (260.0 / -mvPosition.z) * mix(1.6, 0.5, uProgress);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  varying float vOpacity;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    float alpha = smoothstep(0.5, 0.0, d) * vOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// Per-particle direction/speed are seeded by index (deterministicRandom, not
// Math.random()) so setup is identical no matter which frame renders first.
const useParticleAttributes = (particleCount: number) =>
  useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const directions = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const theta = seededRandom(i * 3 + 1) * Math.PI * 2;
      const phi = Math.acos(2 * seededRandom(i * 3 + 2) - 1);
      directions[i * 3 + 0] = Math.sin(phi) * Math.cos(theta);
      directions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
      directions[i * 3 + 2] = Math.cos(phi) * 0.6;
      speeds[i] = 0.5 + seededRandom(i * 3 + 3) * 0.7;
    }

    return { positions, directions, speeds };
  }, [particleCount]);

const Particles: React.FC<{ particleCount: number; color: string; progress: number }> = ({
  particleCount,
  color,
  progress,
}) => {
  const { positions, directions, speeds } = useParticleAttributes(particleCount);
  const colorVec = useMemo(() => hexToThreeColor(color), [color]);

  // A fresh uniforms object each render (keyed on the frame-derived values
  // below) is simplest and still fully deterministic -- R3F just reassigns
  // material.uniforms on every prop change.
  const uniforms = useMemo(
    () => ({
      uProgress: { value: progress },
      uMaxDistance: { value: 6 },
      uColor: { value: colorVec },
    }),
    [progress, colorVec],
  );

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aDirection" args={[directions, 3]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
      />
    </points>
  );
};

export const ParticleBurst: React.FC<ParticleBurstProps> = ({
  particleCount,
  color,
  background,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 0, 6], fov: 50 }}>
        <Particles particleCount={particleCount} color={color} progress={progress} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
