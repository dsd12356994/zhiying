import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { Cut } from "../../schema";

type TextIntro3DProps = Extract<Cut, { type: "three_text_intro" }>;

const useFont = (): Font | null => {
  const [font, setFont] = useState<Font | null>(null);

  useEffect(() => {
    const [handle] = [delayRender("Loading 3D text font")];
    const loader = new FontLoader();
    loader.load(
      staticFile("fonts/helvetiker_bold.typeface.json"),
      (loadedFont) => {
        setFont(loadedFont);
        continueRender(handle);
      },
    );
  }, []);

  return font;
};

const Text3D: React.FC<{ font: Font; text: string; color: string; progress: number }> = ({
  font,
  text,
  color,
  progress,
}) => {
  const geometry = useMemo(() => {
    const geo = new TextGeometry(text, {
      font,
      size: 1,
      depth: 0.25,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
    });
    geo.computeBoundingBox();
    const box = geo.boundingBox as THREE.Box3;
    const centerX = -(box.max.x - box.min.x) / 2;
    const centerY = -(box.max.y - box.min.y) / 2;
    geo.translate(centerX, centerY, 0);
    return geo;
  }, [font, text]);

  const scale = interpolate(progress, [0, 0.35], [0.7, 1], { extrapolateRight: "clamp" });
  const rotationY = interpolate(progress, [0, 1], [-0.5, 0.15]);

  return (
    <mesh geometry={geometry} scale={scale} rotation={[0, rotationY, 0]}>
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.25} />
    </mesh>
  );
};

export const TextIntro3D: React.FC<TextIntro3DProps> = ({ text, color, background }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const font = useFont();

  const progress = frame / durationInFrames;
  const fade = spring({ frame, fps, config: { damping: 30, stiffness: 60 } });

  // Camera dolly-in + a light sweeping across the text -- both plain
  // functions of `progress`, so no two frames ever depend on each other.
  const cameraZ = interpolate(progress, [0, 1], [9, 5.5]);
  const lightX = interpolate(progress, [0, 1], [-6, 6]);

  if (!font) {
    return <AbsoluteFill style={{ backgroundColor: background }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: background, opacity: fade }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 0, cameraZ], fov: 45 }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[lightX, 3, 4]} intensity={80} color="#ffffff" />
        <pointLight position={[-lightX, -2, 3]} intensity={30} color="#7dd3fc" />
        <Text3D font={font} text={text} color={color} progress={progress} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
