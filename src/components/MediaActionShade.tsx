import React from "react";
import { LinearGradient } from "expo-linear-gradient";

/** Keeps the action rail readable without intercepting scrolls or taps. */
export function MediaActionShade() {
  return (
    <LinearGradient
      pointerEvents="none"
      accessible={false}
      colors={["rgba(3,8,16,0)", "rgba(3,8,16,0.16)", "rgba(3,8,16,0.52)"]}
      locations={[0, 0.35, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        right: 0,
        width: "34%",
        maxWidth: 190,
      }}
    />
  );
}
