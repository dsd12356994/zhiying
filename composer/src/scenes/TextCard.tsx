import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Cut } from "../schema";

type TextCardProps = Extract<Cut, { type: "text_card" }>;

export const TextCard: React.FC<TextCardProps> = ({ title, subtitle, background }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const scale = interpolate(enter, [0, 1], [0.92, 1]);
  const opacity = Math.min(enter, exitOpacity);

  return (
    <AbsoluteFill style={{ backgroundColor: background, alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `scale(${scale})`, opacity, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ fontSize: 96, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 36, color: "rgba(255,255,255,0.7)", marginTop: 16 }}>{subtitle}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
