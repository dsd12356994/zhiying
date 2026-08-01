import { Lottie, type LottieAnimationData } from "@remotion/lottie";
import React from "react";
import { AbsoluteFill } from "remotion";

export const LottieScene: React.FC<{
  animationData: LottieAnimationData;
  background?: string;
}> = ({ animationData, background = "transparent" }) => {
  return (
    <AbsoluteFill
      style={{ backgroundColor: background, alignItems: "center", justifyContent: "center" }}
    >
      <Lottie animationData={animationData} style={{ width: "60%", height: "60%" }} />
    </AbsoluteFill>
  );
};
