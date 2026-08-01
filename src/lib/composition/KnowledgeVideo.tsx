/**
 * Remotion Composition: Knowledge Video
 * Renders a complete insurance/finance knowledge video from scene clips + subtitles + branding.
 */

import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Audio } from "remotion";

export interface SceneClip {
  videoUrl: string;
  startFrame: number;
  endFrame: number;
  prompt: string;
}

export interface SubtitleSegment {
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface KnowledgeVideoProps {
  scenes: SceneClip[];
  subtitles: SubtitleSegment[];
  title: string;
  watermarkText: string;
  outroText: string;
  primaryColor: string;
  fps: number;
}

const FADE_DURATION_FRAMES = 15;

const SceneVideo: React.FC<{ src: string; sceneIndex: number }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, FADE_DURATION_FRAMES], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* In a real implementation we'd use <OffthreadVideo> or <Video> from Remotion */}
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#1a1a2e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 24,
        }}
      >
        Scene {sceneIndex + 1}: {src ? "Video loading..." : "AI generated scene"}
      </div>
    </AbsoluteFill>
  );
};

const SubtitleOverlay: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const entrance = spring({ frame, fps: 30, config: { damping: 12 } });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        left: "50%",
        transform: `translateX(-50%) scale(${entrance})`,
        backgroundColor: "rgba(0,0,0,0.6)",
        color: "#fff",
        padding: "12px 28px",
        borderRadius: 12,
        fontSize: 32,
        fontWeight: 600,
        textAlign: "center",
        maxWidth: "80%",
      }}
    >
      {text}
    </div>
  );
};

const Watermark: React.FC<{ text: string; color: string }> = ({ text, color }) => (
  <div
    style={{
      position: "absolute",
      top: 30,
      right: 30,
      color: color || "rgba(255,255,255,0.4)",
      fontSize: 18,
      fontWeight: 500,
    }}
  >
    {text}
  </div>
);

export const KnowledgeVideo: React.FC<KnowledgeVideoProps> = ({
  scenes,
  subtitles,
  title,
  watermarkText,
  outroText,
  primaryColor,
}) => {
  const { fps } = useVideoConfig();
  const totalFrames = scenes.length > 0 ? scenes[scenes.length - 1]!.endFrame : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a1a" }}>
      {/* Title card */}
      <Sequence from={0} durationInFrames={fps * 3}>
        <AbsoluteFill
          style={{
            background: `linear-gradient(135deg, ${primaryColor}22, ${primaryColor}44)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ color: "#fff", fontSize: 48, fontWeight: 700, textAlign: "center", padding: 40 }}>
            {title}
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Scenes */}
      {scenes.map((scene, i) => {
        const duration = scene.endFrame - scene.startFrame;
        return (
          <Sequence key={i} from={scene.startFrame} durationInFrames={duration}>
            <SceneVideo src={scene.videoUrl} sceneIndex={i} />
          </Sequence>
        );
      })}

      {/* Subtitles */}
      {subtitles.map((sub, i) => {
        const duration = sub.endFrame - sub.startFrame;
        return (
          <Sequence key={`sub-${i}`} from={sub.startFrame} durationInFrames={duration}>
            <SubtitleOverlay text={sub.text} />
          </Sequence>
        );
      })}

      {/* Watermark */}
      <Sequence from={0} durationInFrames={totalFrames}>
        <Watermark text={watermarkText} color={primaryColor} />
      </Sequence>

      {/* Outro */}
      {outroText && (
        <Sequence from={totalFrames - fps * 3} durationInFrames={fps * 3}>
          <AbsoluteFill
            style={{
              background: `linear-gradient(135deg, #1a1a2e, ${primaryColor}44)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ color: "#fff", fontSize: 36, fontWeight: 600, textAlign: "center", padding: 40 }}>
              {outroText}
            </div>
          </AbsoluteFill>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
