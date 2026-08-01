import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { CompositionProps, Cut } from "./schema";
import { TextCard } from "./scenes/TextCard";

const renderCut = (cut: Cut): React.ReactElement => {
  switch (cut.type) {
    case "text_card":
      return <TextCard {...cut} />;
    default:
      // Cut has only one variant so far, so it isn't a real TS union yet and
      // can't be exhaustiveness-checked via `never`. M2 adds particle/shader/3D
      // variants alongside text_card — restore a `const x: never = cut` check
      // here once Cut is a true union again.
      throw new Error(`Unhandled cut type: ${JSON.stringify(cut)}`);
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
