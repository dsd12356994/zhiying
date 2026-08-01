import { RemotionRiveCanvas } from "@remotion/rive";
import React from "react";
import { AbsoluteFill } from "remotion";

// Code-complete but not smoke-tested in M2: needs a real .riv asset (authored
// in the Rive editor, not hand-writable like the Lottie JSON fixture). Wire
// this up once a pipeline stage or the user supplies a .riv file via
// staticFile(). `src` should be that staticFile()/URL path.
export const RiveScene: React.FC<{
  src: string;
  artboard?: string;
  animation?: string;
  background?: string;
}> = ({ src, artboard, animation, background = "transparent" }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <RemotionRiveCanvas src={src} artboard={artboard} animation={animation} fit="contain" />
    </AbsoluteFill>
  );
};
