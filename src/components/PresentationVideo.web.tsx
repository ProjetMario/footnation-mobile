import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  presentationVideoUrl,
  type PresentationVideoProps,
} from "./presentationVideoSource";

export default function PresentationVideo({
  title,
  language,
}: PresentationVideoProps) {
  const [active, setActive] = useState(false);
  // Expo keeps previous screens mounted: stop playback when opening signup or another page.
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => setActive(false);
    }, []),
  );
  if (!active) return null;

  return (
    <video
      aria-label={title}
      src={presentationVideoUrl(language)}
      autoPlay
      muted
      loop
      playsInline
      controls
      preload="auto"
      ref={(video) => {
        if (video) {
          video.muted = true;
          void video.play().catch(() => { /* Native controls remain available. */ });
        }
      }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        border: 0,
        objectFit: "contain",
      }}
    />
  );
}
