import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// Data-callout overlay for the motion-graphics-overlay workflow: the
// "this gun has a 73% win rate -- show it, don't just say it" cut.
// NEVER paints a background -- the clip is meant to drop on top of
// footage with its alpha channel intact (composition transparent:true).
//
// Pure function of frame (AGENT_GUIDE ground rule): no clocks, no
// useFrame-driven three state, all timing derives from useCurrentFrame().

// flexDirection is "column": justifyContent places vertically (main
// axis), alignItems horizontally (cross axis). Live-test caught these
// being swapped (bottom-left rendered top-right) -- keep straight.
const POSITIONS: Record<string, React.CSSProperties> = {
  "bottom-left": { alignItems: "flex-start", justifyContent: "flex-end", padding: "4% 5%" },
  "bottom-right": { alignItems: "flex-end", justifyContent: "flex-end", padding: "4% 5%" },
  "top-left": { alignItems: "flex-start", justifyContent: "flex-start", padding: "4% 5%" },
  "top-right": { alignItems: "flex-end", justifyContent: "flex-start", padding: "4% 5%" },
  center: { alignItems: "center", justifyContent: "center" },
};

const parseValue = (value: string) => {
  // "73%" -> {num: 73, suffix: "%"}; "1.2M" -> {num: 1.2, suffix: "M"};
  // non-numeric values render without the count-up.
  const match = value.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return null;
  return { num: parseFloat(match[1]), suffix: match[2], decimals: (match[1].split(".")[1] || "").length };
};

export const StatCard: React.FC<{
  durationInFrames: number;
  value: string;
  label?: string;
  accent?: string;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right" | "center";
}> = ({ value, label, accent = "#7dd3fc", position = "bottom-left" }) => {
  const frame = useCurrentFrame();
  const { fps, height, durationInFrames: total } = useVideoConfig();

  // Entrance: springy pop for the whole card, slide-up for the label.
  const pop = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const cardOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const labelSlide = interpolate(frame, [8, 22], [28, 0], { extrapolateRight: "clamp", easing: (t) => 1 - (1 - t) ** 3 });

  // Count-up: number rolls to its target over the first ~40 frames.
  const parsed = parseValue(value);
  const shown = parsed
    ? `${(parsed.num * interpolate(frame, [0, 40], [0, 1], { extrapolateRight: "clamp" })).toFixed(parsed.decimals)}${parsed.suffix}`
    : value;

  // Exit: quick fade over the last 6 frames so the overlay doesn't
  // hard-cut out when dropped mid-sentence in an NLE.
  const exitFade = interpolate(frame, [total - 6, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const numberSize = Math.round(height * 0.13);
  const labelSize = Math.round(height * 0.032);

  return (
    <AbsoluteFill style={{ ...POSITIONS[position], display: "flex", flexDirection: "column", opacity: cardOpacity * exitFade }}>
      <div
        style={{
          transform: `scale(${0.8 + 0.2 * pop}) translateY(${(1 - pop) * 12}px)`,
          background: "rgba(8, 10, 18, 0.55)",
          backdropFilter: "blur(14px)",
          borderRadius: height * 0.018,
          borderLeft: `${Math.round(height * 0.006)}px solid ${accent}`,
          padding: `${height * 0.02}px ${height * 0.035}px`,
          boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontSize: numberSize,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.05,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
          }}
        >
          {shown}
        </div>
        {label ? (
          <div
            style={{
              fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
              fontSize: labelSize,
              fontWeight: 600,
              color: accent,
              marginTop: height * 0.008,
              transform: `translateY(${labelSlide}px)`,
              opacity: interpolate(frame, [8, 20], [0, 1], { extrapolateRight: "clamp" }),
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {label}
        </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
