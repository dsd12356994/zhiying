import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// Vertical "project spotlight" card, matching the reference style the user
// pointed at (Oraink 系列): browser-chrome bar with traffic lights +
// "02 / 05" progress + green star badge (count-up), numbered tag + project
// name, keyword tag pills, a dark demo panel holding the screenshot with a
// title strip and "official demo" footer, a bold subtitle pill, and a brand
// bar. Pure function of frame -- no clocks (AGENT_GUIDE ground rule).

const palette = {
  canvas: "#f0f0f0",
  card: "#ffffff",
  ink: "#0f172a",
  navy: "#10233f",
  blue: "#0074d9",
  green: "#00c400",
  chrome: "#e8eaed",
  panel: "#0d1117",
  panelInk: "#e6edf3",
  muted: "#5b6b7c",
};

const fmtStars = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const TrafficLights: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ display: "flex", gap: size * 0.5, alignItems: "center" }}>
    {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
      <div key={c} style={{ width: size, height: size, borderRadius: "50%", backgroundColor: c }} />
    ))}
  </div>
);

const StarBadge: React.FC<{ text: string; scale: number }> = ({ text, scale }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6 * scale,
      backgroundColor: palette.green,
      color: "#ffffff",
      borderRadius: 6 * scale,
      padding: `${4 * scale}px ${9 * scale}px`,
      fontWeight: 800,
      fontSize: 15 * scale,
      letterSpacing: "0.01em",
    }}
  >
    <span style={{ fontSize: 13 * scale }}>★</span>
    {text}
  </div>
);

export const ProjectSpotlight: React.FC<{
  durationInFrames: number;
  index: number;
  total: number;
  name: string;
  stars: number;
  tags: string[];
  demoTitle: string;
  demoImage?: string;
  demoFooter?: string;
  subtitle: string;
  brand: string;
}> = ({ index, total, name, stars, tags, demoTitle, demoImage, demoFooter, subtitle, brand }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  // Canvas is authored at 720x1280; scale everything from the real width so
  // other canvas sizes (1080x1920 etc.) keep proportions.
  const s = width / 720;

  const enter = spring({ frame, fps, config: { damping: 14, mass: 0.7 } });
  const fade = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const slide = (1 - enter) * 40 * s;

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });

  // Star count-up over the first ~50 frames.
  const starText = fmtStars(Math.round(stars * interpolate(frame, [0, 50], [0, 1], { extrapolateRight: "clamp" })));

  const panelScale = interpolate(spring({ frame: frame - 12, fps, config: { damping: 16 } }), [0, 1], [0.94, 1]);
  const subOpacity = interpolate(frame, [26, 42], [0, 1], { extrapolateRight: "clamp" });
  const exitFade = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pad = 28 * s;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.canvas,
        backgroundImage: `radial-gradient(${palette.muted}22 1.4px, transparent 1.4px)`,
        backgroundSize: `${18 * s}px ${18 * s}px`,
        fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
        padding: pad,
        opacity: fade * exitFade,
      }}
    >
      <div style={{ transform: `translateY(${slide}px)`, display: "flex", flexDirection: "column", gap: 18 * s }}>
        {/* ---- ① browser chrome bar ---- */}
        <div
          style={{
            backgroundColor: palette.chrome,
            borderRadius: 14 * s,
            padding: `${12 * s}px ${14 * s}px`,
            display: "flex",
            alignItems: "center",
            gap: 12 * s,
            boxShadow: `0 ${4 * s}px ${14 * s}px rgba(15,23,42,0.10)`,
          }}
        >
          <TrafficLights size={11 * s} />
          <div
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 17 * s,
              fontWeight: 700,
              color: palette.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          <div style={{ fontSize: 15 * s, fontWeight: 700, color: palette.muted, fontVariantNumeric: "tabular-nums" }}>
            {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </div>
          <StarBadge text={starText} scale={s} />
        </div>

        {/* progress rail under the chrome */}
        <div style={{ height: 5 * s, backgroundColor: "#d7dbe0", borderRadius: 3 * s, overflow: "hidden", marginTop: -12 * s }}>
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${palette.blue}, ${palette.green})`,
            }}
          />
        </div>

        {/* ---- ② numbered tag + keyword pills ---- */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 * s, flexWrap: "wrap" }}>
          <div
            style={{
              backgroundColor: palette.navy,
              color: "#ffffff",
              borderRadius: 8 * s,
              padding: `${6 * s}px ${11 * s}px`,
              fontSize: 22 * s,
              fontWeight: 900,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            #{String(index).padStart(2, "0")}
          </div>
          <div style={{ fontSize: 30 * s, fontWeight: 900, color: palette.ink, letterSpacing: "-0.01em" }}>{name}</div>
        </div>

        <div style={{ display: "flex", gap: 8 * s, flexWrap: "wrap" }}>
          {tags.map((t, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "#e2f6e2",
                color: "#1d7a1d",
                borderRadius: 999,
                padding: `${5 * s}px ${11 * s}px`,
                fontSize: 15 * s,
                fontWeight: 700,
              }}
            >
              {t}
            </div>
          ))}
          <div style={{ fontSize: 15 * s, fontWeight: 700, color: palette.muted, alignSelf: "center" }}>
            总 {Math.round(stars).toLocaleString()}
          </div>
        </div>

        {/* ---- ③ dark demo panel ---- */}
        <div
          style={{
            backgroundColor: palette.panel,
            borderRadius: 16 * s,
            padding: 12 * s,
            transform: `scale(${panelScale})`,
            boxShadow: `0 ${10 * s}px ${30 * s}px rgba(15,23,42,0.28)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 * s, padding: `${2 * s}px ${4 * s}px ${10 * s}px` }}>
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: `${7 * s}px solid transparent`,
                borderBottom: `${7 * s}px solid transparent`,
                borderLeft: `${11 * s}px solid ${palette.blue}`,
              }}
            />
            <div style={{ color: palette.panelInk, fontSize: 16 * s, fontWeight: 700 }}>{demoTitle}</div>
          </div>

          <div style={{ borderRadius: 10 * s, overflow: "hidden", backgroundColor: "#161b22" }}>
            {demoImage ? (
              <Img src={demoImage} style={{ width: "100%", display: "block" }} />
            ) : (
              // No screenshot supplied: render an intentional-looking mock
              // page instead of an empty box (the pipeline must work
              // before any asset collection happens).
              <div style={{ padding: 16 * s, display: "flex", flexDirection: "column", gap: 10 * s }}>
                <div style={{ height: 12 * s, width: "55%", backgroundColor: "#2b3440", borderRadius: 4 * s }} />
                <div style={{ height: 9 * s, width: "85%", backgroundColor: "#232b36", borderRadius: 4 * s }} />
                <div style={{ height: 9 * s, width: "72%", backgroundColor: "#232b36", borderRadius: 4 * s }} />
                <div style={{ display: "flex", gap: 8 * s, marginTop: 4 * s }}>
                  {[0.5, 0.72, 0.34, 0.9, 0.62].map((h, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 74 * s * h,
                        alignSelf: "flex-end",
                        backgroundColor: i % 2 ? palette.green : palette.blue,
                        opacity: 0.85,
                        borderRadius: 3 * s,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ textAlign: "right", color: palette.muted, fontSize: 13 * s, fontWeight: 600, paddingTop: 9 * s }}>
            {demoFooter ?? `${name} official demo`}
          </div>
        </div>

        {/* ---- ④ subtitle pill ---- */}
        <div style={{ display: "flex", justifyContent: "center", opacity: subOpacity, marginTop: 2 * s }}>
          <div
            style={{
              backgroundColor: palette.navy,
              color: "#ffffff",
              borderRadius: 10 * s,
              padding: `${9 * s}px ${16 * s}px`,
              fontSize: 24 * s,
              fontWeight: 800,
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* ---- ⑤ brand bar ---- */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 2 * s }}>
          <div
            style={{
              backgroundColor: palette.navy,
              color: "#ffffff",
              borderRadius: 999,
              padding: `${7 * s}px ${18 * s}px`,
              fontSize: 18 * s,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: 8 * s,
            }}
          >
            <span style={{ color: palette.green }}>›</span>
            {brand}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
