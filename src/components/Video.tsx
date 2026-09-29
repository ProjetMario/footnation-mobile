import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useVideoPlayer, VideoView, type VideoPlayerStatus } from "expo-video";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Play, RotateCcw } from "lucide-react-native";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { nextMediaPosition, type MediaPlaybackMemory } from "../lib/mediaFeed";
import {
  clipPosition,
  playbackClip,
  type ShortClip,
  type ShortPlayback,
} from "../lib/shortEditing";
import { reportError } from "../lib/monitoring";
import { registerSoundActivation } from "../lib/mediaSound";
import { createMediaPlaybackControl } from "../lib/mediaPlaybackControl";

interface NativeVideoProps {
  uri: string;
  active?: boolean;
  visible?: boolean;
  posterUri?: string | null;
  seek?: { seconds: number; play: boolean; request: number };
  onProgress?: (seconds: number, duration: number) => void;
  clip?: ShortClip | null;
  muted?: boolean;
  volume?: number;
  controls?: boolean;
  onPlayback?: (state: ShortPlayback) => void;
  style?: StyleProp<ViewStyle>;
  contentFit?: "contain" | "cover" | "fill";
  playbackMemory?: React.RefObject<MediaPlaybackMemory>;
}

function appIsForeground() {
  // Native AppState can initially be null while its first snapshot resolves.
  return (
    AppState.currentState !== "background" &&
    AppState.currentState !== "inactive"
  );
}

export function NativeVideo({
  visible = true,
  posterUri,
  style,
  contentFit = "contain",
  playbackMemory,
  ...props
}: NativeVideoProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(appIsForeground);
  const [attempt, setAttempt] = useState(0);
  const localMemory = useMemo<React.RefObject<MediaPlaybackMemory>>(
    () => ({ current: { seconds: 0, seekRequest: null } }),
    [props.uri],
  );
  const memory = playbackMemory ?? localMemory;
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state !== "background" && state !== "inactive"),
    );
    return () => subscription.remove();
  }, []);
  return (
    <View style={[styles.frame, style]}>
      {visible && focused && foreground ? (
        <VideoSurface
          key={`${props.uri}:${attempt}`}
          {...props}
          memory={memory}
          retry={() => setAttempt((value) => value + 1)}
          contentFit={contentFit}
        />
      ) : (
        <View style={styles.placeholder}>
          {!!posterUri ? (
            <Image
              source={{ uri: posterUri }}
              style={StyleSheet.absoluteFill}
              contentFit={contentFit}
            />
          ) : (
            <Play size={30} color={colors.muted} accessibilityLabel="Vidéo" />
          )}
        </View>
      )}
    </View>
  );
}

function VideoSurface({
  uri,
  active,
  seek,
  onProgress,
  clip,
  muted,
  volume,
  controls = true,
  onPlayback,
  memory,
  retry,
  contentFit,
}: Omit<NativeVideoProps, "visible" | "posterUri" | "style"> & {
  memory: React.RefObject<MediaPlaybackMemory>;
  retry: () => void;
  contentFit: "contain" | "cover" | "fill";
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [status, setStatus] = useState<VideoPlayerStatus>("loading");
  const [slow, setSlow] = useState(false);
  const focused = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const videoView = useRef<VideoView>(null);
  const restored = useRef(false);
  const pendingSeekPlay = useRef(false);
  const reportedError = useRef(false);
  const progress = useRef(onProgress);
  progress.current = onProgress;
  const playback = useRef(onPlayback),
    range = useRef(clip);
  playback.current = onPlayback;
  range.current = clip;
  // Native assets load asynchronously. On web, an initial source avoids
  // replaceAsync's implicit play() and a second src assignment by VideoView.
  const player = useVideoPlayer(Platform.OS === "web" ? uri : null, (p) => {
    p.loop = active !== undefined;
    p.muted = muted ?? active !== undefined;
    if (volume !== undefined) {
      p.volume = volume;
      if (volume === 0) p.audioMixingMode = "mixWithOthers";
    }
    p.staysActiveInBackground = false;
  });
  const playbackControl = useMemo(
    () =>
      createMediaPlaybackControl({
        play: () => {
          if (Platform.OS !== "web") return player.play();
          // Expo Web's player.play() discards the HTML play promise. Use this
          // view's element so cancellation is handled without global listeners.
          const element = videoView.current?.nativeRef.current;
          if (!element) throw new Error("Video view is unavailable");
          return element.play() as Promise<void>;
        },
        pause: () => player.pause(),
        playing: () => player.playing,
        onError: () => setStatus("error"),
      }),
    [player],
  );

  useEffect(() => {
    if (!active || volume === 0) return;
    return registerSoundActivation(() => {
      player.muted = false;
      playbackControl.play();
    });
  }, [player, active, volume, playbackControl]);

  useEffect(() => {
    if (muted !== undefined) player.muted = muted;
  }, [player, muted]);
  useEffect(() => {
    if (volume !== undefined) {
      player.volume = volume;
      // A separate soundtrack shares this Short's playback session. Other
      // NativeVideo callers omit volume and keep their existing audio mode.
      player.audioMixingMode = volume === 0 ? "mixWithOthers" : "auto";
    }
  }, [player, volume]);
  useEffect(() => {
    const emit = (overrides: Partial<ShortPlayback> = {}) =>
      playback.current?.({
        seconds: player.currentTime,
        duration: player.duration,
        playing: player.playing,
        ready: player.status === "readyToPlay",
        rate: player.playbackRate,
        ...overrides,
        ...(reportedError.current ? { playing: false, ready: false } : {}),
      });
    const subscriptions = [
      player.addListener("playingChange", (event) =>
        emit({ playing: event.isPlaying }),
      ),
      player.addListener("statusChange", (event) =>
        emit({ ready: event.status === "readyToPlay" }),
      ),
      player.addListener("playbackRateChange", (event) =>
        emit({ rate: event.playbackRate }),
      ),
      player.addListener("sourceLoad", (event) =>
        emit({ duration: event.duration }),
      ),
    ];
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [player]);
  useEffect(() => {
    let mounted = true;
    const listener = player.addListener("statusChange", (event) => {
      if (mounted) setStatus(event.status);
    });
    setStatus(player.status === "idle" ? "loading" : player.status);
    if (Platform.OS !== "web") {
      void player.replaceAsync(uri).catch(() => {
        if (mounted) setStatus("error");
      });
    }
    return () => {
      mounted = false;
      listener.remove();
    };
  }, [player, uri]);

  useEffect(() => {
    if (status === "error" && !reportedError.current) {
      reportedError.current = true;
      reportError(new Error("Video playback failed"), "media");
      // A rejected Web play promise does not produce Expo's statusChange.
      // Tell the parent so its pause overlay cannot cover our Retry button.
      playback.current?.({
        seconds: player.currentTime,
        duration: player.duration,
        playing: false,
        ready: false,
        rate: player.playbackRate,
      });
    }
    if (status !== "loading" && status !== "idle") {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(timer);
  }, [status, player]);

  useEffect(() => {
    player.timeUpdateEventInterval = clip || onPlayback ? 0.2 : 0.5;
    const listener = player.addListener("timeUpdate", (event) => {
      if (reportedError.current) return;
      const bounded = playbackClip(range.current, player.duration);
      const seconds = clipPosition(event.currentTime, bounded);
      if (restored.current && seconds !== event.currentTime)
        player.currentTime = seconds;
      if (
        restored.current &&
        Number.isFinite(event.currentTime) &&
        event.currentTime >= 0
      )
        memory.current.seconds = seconds;
      if (restored.current) {
        progress.current?.(seconds, player.duration);
        playback.current?.({
          seconds,
          duration: player.duration,
          playing: player.playing,
          ready: player.status === "readyToPlay",
          rate: player.playbackRate,
        });
      }
    });
    return () => {
      listener.remove();
      // The web hook does not automatically dispose this interval.
      if (Platform.OS === "web") player.timeUpdateEventInterval = 0;
    };
  }, [player, memory]);

  useEffect(() => {
    // Expo web emits statusChange before updating player.status. React state
    // runs this after the event, including a seek requested during loading.
    if (status !== "readyToPlay") return;
    const position = nextMediaPosition(memory.current, seek, player.duration);
    const boundedSeconds = clipPosition(
      position.seconds,
      playbackClip(clip, player.duration),
    );
    const outsideClip = boundedSeconds !== position.seconds;
    position.seconds = boundedSeconds;
    const hasNewSeek = position.seekRequest !== memory.current.seekRequest;
    const initialRestore = !restored.current;
    if (initialRestore || hasNewSeek || outsideClip) {
      player.currentTime = position.seconds;
      memory.current = {
        seconds: position.seconds,
        seekRequest: position.seekRequest,
      };
      restored.current = true;
      pendingSeekPlay.current = position.play;
    }
  }, [status, player, seek, memory, active, clip?.start, clip?.duration]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (
        restored.current &&
        (activeRef.current || pendingSeekPlay.current) &&
        player.status === "readyToPlay" &&
        appIsForeground()
      ) {
        pendingSeekPlay.current = false;
        playbackControl.play();
      }
      return () => {
        focused.current = false;
        // Expo's native hook may already have released the shared player when
        // our effect cleanup runs. A released player is already stopped.
        playbackControl.pause({ reportFailure: false });
      };
    }, [player, playbackControl]),
  );
  useEffect(() => {
    if (
      restored.current &&
      status === "readyToPlay" &&
      focused.current &&
      appIsForeground() &&
      (active || pendingSeekPlay.current)
    ) {
      pendingSeekPlay.current = false;
      playbackControl.play();
    } else if (active === false) playbackControl.pause();
  }, [active, status, seek, playbackControl]);
  useEffect(() => {
    const app = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive")
        playbackControl.pause();
    });
    return () => app.remove();
  }, [playbackControl]);
  const pending = status === "idle" || status === "loading";
  return (
    <View style={styles.surface}>
      <VideoView
        ref={videoView}
        accessibilityLabel="Lecteur vidéo"
        player={player}
        style={[
          StyleSheet.absoluteFill,
          {
            width: "100%",
            height: "100%",
            ...(Platform.OS === "web"
              ? ({ objectFit: contentFit } as unknown as ViewStyle)
              : null),
          },
        ]}
        contentFit={contentFit}
        playsInline
        nativeControls={controls}
      />
      {!!(pending || status === "error") && (
        <View
          style={styles.status}
          pointerEvents={status === "error" || slow ? "auto" : "none"}
        >
          {!!pending && <ActivityIndicator color={colors.white} />}
          <Text
            accessibilityRole={status === "error" ? "alert" : undefined}
            accessibilityLiveRegion="polite"
            style={styles.statusText}
          >
            {status === "error"
              ? "Cette vidéo n’est pas disponible pour le moment."
              : slow
                ? "Le chargement prend plus de temps que prévu."
                : "Chargement de la vidéo…"}
          </Text>
          {!!(status === "error" || slow) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Réessayer de charger la vidéo"
              onPress={retry}
              style={styles.retry}
            >
              <RotateCcw size={18} color={colors.white} />
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    frame: {
      width: "100%",
      aspectRatio: 1,
      backgroundColor: "#101218",
      overflow: "hidden",
    },
    surface: { flex: 1, minHeight: 0, overflow: "hidden" },
    placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
    status: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 14,
      backgroundColor: "#151A30D9",
    },
    statusText: {
      color: colors.white,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    retry: {
      minHeight: 44,
      paddingHorizontal: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 24,
      backgroundColor: "#0064D8",
    },
    retryText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  });
