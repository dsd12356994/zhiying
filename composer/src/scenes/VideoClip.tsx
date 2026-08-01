import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import type { Cut } from "../schema";

type VideoClipProps = Extract<Cut, { type: "video_clip" }>;

export const VideoClip: React.FC<VideoClipProps> = ({ src, trimStart, fit, volume }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={Math.round(trimStart * fps)}
        volume={volume}
        style={{ width: "100%", height: "100%", objectFit: fit }}
      />
    </AbsoluteFill>
  );
};
