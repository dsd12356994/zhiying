import React from "react";
import { Composition } from "remotion";
import { compositionPropsSchema, totalDurationInFrames, type CompositionProps } from "./schema";
import { SceneRenderer } from "./SceneRenderer";

const defaultProps: CompositionProps = {
  fps: 30,
  width: 1920,
  height: 1080,
  cuts: [
    {
      type: "text_card",
      durationInFrames: 60,
      title: "zhiying",
      subtitle: "Agent-driven cinematic pipeline",
      background: "#0b0b12",
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CinematicTrailer"
      component={SceneRenderer}
      schema={compositionPropsSchema}
      defaultProps={defaultProps}
      durationInFrames={totalDurationInFrames(defaultProps.cuts)}
      fps={defaultProps.fps}
      width={defaultProps.width}
      height={defaultProps.height}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: totalDurationInFrames(props.cuts),
        fps: props.fps,
        width: props.width,
        height: props.height,
      })}
    />
  );
};
