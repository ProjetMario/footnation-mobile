import { useMemo, useRef } from "react";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import type { SoundtrackPlayer, SoundtrackStatus } from "./soundtrackPlayer";

export function useSoundtrackPlayer(uri: string): {
  player: SoundtrackPlayer | null;
  status: SoundtrackStatus;
} {
  const audio = useAudioPlayer(uri, { updateInterval: 250 });
  const state = useAudioPlayerStatus(audio);
  const generation = useRef(0);
  const player = useMemo<SoundtrackPlayer>(
    () => ({
      get muted() {
        return audio.muted;
      },
      set muted(v) {
        audio.muted = v;
      },
      get loop() {
        return audio.loop;
      },
      set loop(v) {
        audio.loop = v;
      },
      get volume() {
        return audio.volume;
      },
      set volume(v) {
        audio.volume = v;
      },
      get playbackRate() {
        return audio.playbackRate;
      },
      set playbackRate(v) {
        audio.playbackRate = v;
      },
      get currentTime() {
        return audio.currentTime;
      },
      get duration() {
        return audio.duration;
      },
      get playing() {
        return audio.playing;
      },
      get isLoaded() {
        return audio.isLoaded;
      },
      async play() {
        const request = generation.current;
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: "mixWithOthers",
        });
        if (request === generation.current) audio.play();
      },
      pause() {
        generation.current++;
        try {
          audio.pause();
        } catch {
          /* The native hook may already have released the player. */
        }
      },
      seekTo(seconds) {
        return audio.seekTo(seconds);
      },
    }),
    [audio],
  );
  return {
    player,
    status: {
      isLoaded: state.isLoaded,
      playing: state.playing,
      blocked: false,
      failed: !!state.error,
    },
  };
}
