import React, { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  presentationVideoUrl,
  type PresentationVideoProps,
} from "./presentationVideoSource";

// Native players need a media URL, rather than a YouTube HTML page.
export default function PresentationVideo({
  title,
  language,
}: PresentationVideoProps) {
  const player = useVideoPlayer(presentationVideoUrl(language), (instance) => {
    instance.loop = true;
    instance.muted = true;
  });
  useFocusEffect(useCallback(() => {
    if (AppState.currentState === "active") player.play();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") player.play();
      else player.pause();
    });
    return () => {
      subscription.remove();
      player.pause();
    };
  }, [player]));
  return (
    <View style={styles.poster} accessibilityLabel={title}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    borderWidth: 3,
    borderRadius: 22,
  },
});
