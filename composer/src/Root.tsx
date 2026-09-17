import React from "react";
import { Composition } from "remotion";
import { compositionPropsSchema, totalDurationInFrames, type CompositionProps } from "./schema";
import { SceneRenderer } from "./SceneRenderer";
import { LottieScene } from "./effects/vector/LottieScene";
import pulseLottieData from "./effects/vector/fixtures/pulse.lottie.json";

const defaultProps: CompositionProps = {
  fps: 30,
  width: 1920,
  height: 1080,
  transparent: false,
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

const spotlightDefaultProps: CompositionProps = {
  fps: 30,
  width: 720,
  height: 1280,
  transparent: false,
  cuts: [
    {
      type: "project_spotlight",
      durationInFrames: 210,
      index: 1,
      total: 5,
      name: "screenshot-to-code",
      stars: 77300,
      tags: ["截图转代码", "前端工程", "AI 编程"],
      demoTitle: "Official result demo",
      subtitle: "左边贴截图，右边生成页面预览和代码；",
      brand: "Oraink",
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
      {/* M2 smoke test for the Lottie wrapper only -- not part of the Cut
          union yet since there's no asset pipeline to source real
          Lottie/Rive files from (see AGENT_GUIDE.md / M3). Proves
          @remotion/lottie renders correctly here, independent of that. */}
      <Composition
        id="LottieSmokeTest"
        component={() => <LottieScene animationData={pulseLottieData} background="#05050a" />}
        durationInFrames={60}
        fps={30}
        width={800}
        height={800}
      />
      {/* Vertical "project spotlight" style (720x1280) — the reference look
          the agent-authored spotlight pipeline targets. Same data-driven
          props contract as CinematicTrailer; render with --props. */}
      <Composition
        id="Spotlight"
        component={SceneRenderer}
        schema={compositionPropsSchema}
        durationInFrames={totalDurationInFrames(spotlightDefaultProps.cuts)}
        fps={30}
        width={720}
        height={1280}
        defaultProps={spotlightDefaultProps}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: totalDurationInFrames(props.cuts),
          fps: props.fps,
          width: props.width,
          height: props.height,
        })}
      />
    </>
  );
};
