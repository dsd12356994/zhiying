import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { CompositionProps, Cut } from "./schema";
import { TextCard } from "./scenes/TextCard";
import { TextIntro3D } from "./effects/three/TextIntro3D";
import { ParticleBurst } from "./effects/three/ParticleBurst";
import { ShaderTransition } from "./effects/shaders/ShaderTransition";
import { VideoClip } from "./scenes/VideoClip";
import { VideoTransition } from "./effects/shaders/VideoTransition";

const renderCut = (cut: Cut): React.ReactElement => {
  switch (cut.type) {
    case "text_card":
      return <TextCard {...cut} />;
    case "three_text_intro":
      return <TextIntro3D {...cut} />;
    case "particle_burst":
      return <ParticleBurst {...cut} />;
    case "shader_transition":
      return <ShaderTransition {...cut} />;
    case "video_clip":
      return <VideoClip {...cut} />;
    case "video_transition":
      return <VideoTransition {...cut} />;
    default: {
      const neverCut: never = cut;
      throw new Error(`Unhandled cut type: ${JSON.stringify(neverCut)}`);
    }
  }
};

export const SceneRenderer: React.FC<CompositionProps> = ({ cuts }) => {
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {cuts.map((cut, index) => {
        const sequence = (
          <Sequence key={index} from={from} durationInFrames={cut.durationInFrames}>
            {renderCut(cut)}
          </Sequence>
        );
        from += cut.durationInFrames;
        return sequence;
      })}
    </AbsoluteFill>
  );
};
