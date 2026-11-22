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
  fallbackUri?: string;
  active?: boolean;
  visible?: boolean;
  /** Keep the next feed player loaded but silent, without changing its identity. */
  preload?: boolean;
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
  preload = false,
  posterUri,
  style,
  contentFit = "contain",
  playbackMemory,
  fallbackUri,
  ...props
}: NativeVideoProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(appIsForeground);
  const [attempt, setAttempt] = useState(0);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const sourceUri =
    failedUri === props.uri && fallbackUri ? fallbackUri : props.uri;
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
      {(visible || preload) && focused && foreground ? (
        <VideoSurface
          key={`${sourceUri}:${attempt}`}
          {...props}
          uri={sourceUri}
          onUnavailable={
            fallbackUri && sourceUri !== fallbackUri
              ? () => setFailedUri(props.uri)
              : undefined
          }
          playbackAllowed={visible}
          posterUri={posterUri}
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
  posterUri,
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
  playbackAllowed,
  onUnavailable,
}: Omit<NativeVideoProps, "visible" | "style" | "preload"> & {
  playbackAllowed: boolean;
  onUnavailable?: () => void;
  memory: React.RefObject<MediaPlaybackMemory>;
  retry: () => void;
  contentFit: "contain" | "cover" | "fill";
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [status, setStatus] = useState<VideoPlayerStatus>("loading");
  const [slow, setSlow] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const autoplayBlockedRef = useRef(false);
  const frameReady = useRef(false);
  const playbackAllowedRef = useRef(playbackAllowed);
  playbackAllowedRef.current = playbackAllowed;
  const focused = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const videoView = useRef<VideoView>(null);
  const restored = useRef(false);
  const pendingSeekPlay = useRef(false);
  const reportedError = useRef(false);
  const unavailable = useRef(onUnavailable);
  unavailable.current = onUnavailable;
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
    p.muted = !playbackAllowed || (muted ?? active !== undefined);
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
        onError: (error) => {
          if (
            Platform.OS === "web" &&
            (error as { name?: string })?.name === "NotAllowedError"
          ) {
            // A browser requiring a tap has not rejected this media file. Keep
            // its downloaded bytes instead of retrying the larger original.
            autoplayBlockedRef.current = true;
            setAutoplayBlocked(true);
            playback.current?.({
              seconds: player.currentTime,
              duration: player.duration,
              playing: false,
              ready: false,
              rate: player.playbackRate,
            });
            return;
          }
          setStatus("error");
        },
      }),
    [player],
  );

  useEffect(() => {
    if (!active || !playbackAllowed || volume === 0) return;
    return registerSoundActivation(() => {
      player.muted = false;
      playbackControl.play();
    });
  }, [player, active, playbackAllowed, volume, playbackControl]);

  useEffect(() => {
    player.muted = !playbackAllowed || (muted ?? active !== undefined);
  }, [player, muted, playbackAllowed, active]);
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
        playing: playbackAllowedRef.current && player.playing,
        ready: frameReady.current && player.status === "readyToPlay",
        rate: player.playbackRate,
        ...overrides,
        ...(reportedError.current ? { playing: false, ready: false } : {}),
        ...(!playbackAllowedRef.current ? { playing: false } : {}),
        ...(!frameReady.current ? { ready: false } : {}),
        ...(autoplayBlockedRef.current ? { playing: false, ready: false } : {}),
      });
    const subscriptions = [
      player.addListener("playingChange", (event) => {
        if (event.isPlaying) {
          autoplayBlockedRef.current = false;
          setAutoplayBlocked(false);
        }
        emit({ playing: event.isPlaying });
      }),
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
      unavailable.current?.();
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
          playing: playbackAllowedRef.current && player.playing,
          ready:
            !autoplayBlockedRef.current &&
            frameReady.current &&
            player.status === "readyToPlay",
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

  const restorePosition = useCallback(() => {
    const position = nextMediaPosition(memory.current, seek, player.duration);
    const boundedSeconds = clipPosition(
      position.seconds,
      playbackClip(clip, player.duration),
    );
    const outsideClip = boundedSeconds !== position.seconds;
    position.seconds = boundedSeconds;
    const hasNewSeek = position.seekRequest !== memory.current.seekRequest;
    if (!restored.current || hasNewSeek || outsideClip) {
      player.currentTime = position.seconds;
      memory.current = {
        seconds: position.seconds,
        seekRequest: position.seekRequest,
      };
      restored.current = true;
      pendingSeekPlay.current = position.play;
    }
    return position.play;
  }, [player, memory, seek, clip?.start, clip?.duration]);
  useEffect(() => {
    // Expo web emits statusChange before updating player.status. Restore in an
    // effect so its duration is available and a buffered next player is reused.
    if (status !== "readyToPlay") return;
    const seekPlay = restorePosition();
    if (
      playbackAllowed &&
      (seekPlay || activeRef.current) &&
      appIsForeground()
    ) {
      pendingSeekPlay.current = false;
      playbackControl.play();
    }
  }, [status, active, playbackAllowed, restorePosition, playbackControl]);
  useEffect(() => {
    if (Platform.OS !== "web" || !playbackAllowed || !active) return;
    const element = videoView.current?.nativeRef.current as
      HTMLVideoElement | undefined;
    if (!element) return;
    const startWithMetadata = () => {
      if (
        !playbackAllowedRef.current ||
        !activeRef.current ||
        !focused.current ||
        !appIsForeground()
      )
        return;
      restorePosition();
      pendingSeekPlay.current = false;
      // Safari may fetch only metadata despite preload=auto. An explicit muted
      // play request asks for frames instead of waiting forever for canplay.
      playbackControl.play();
    };
    const retryWhenPlayable = () => {
      if (element.readyState >= 2) startWithMetadata();
    };
    element.addEventListener("loadedmetadata", startWithMetadata);
    element.addEventListener("loadeddata", retryWhenPlayable);
    element.addEventListener("canplay", retryWhenPlayable);
    if (element.readyState >= 1) startWithMetadata();
    return () => {
      element.removeEventListener("loadedmetadata", startWithMetadata);
      element.removeEventListener("loadeddata", retryWhenPlayable);
      element.removeEventListener("canplay", retryWhenPlayable);
    };
  }, [active, playbackAllowed, player, restorePosition, playbackControl]);
  useEffect(() => {
    // A visibility transition can race Safari's media-policy decision. Retry
    // briefly so a video that is allowed to autoplay starts without a tap.
    // iOS Low Power Mode may still reject every attempt by design.
    if (Platform.OS !== "web" || !playbackAllowed || !active) return;
    let started = player.playing;
    let attempts = 0;
    const listener = player.addListener("playingChange", (event) => {
      if (event.isPlaying) started = true;
    });
    const timer = setInterval(() => {
      // Once playback has started, native controls may intentionally pause it.
      // Do not undo that pause every 800ms or retry a policy rejection forever.
      if (started || attempts >= 10) {
        clearInterval(timer);
        return;
      }
      if (!focused.current || !appIsForeground()) return;
      attempts++;
      playbackControl.play();
    }, 800);
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [active, playbackAllowed, player, playbackControl]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (
        playbackAllowedRef.current &&
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
      playbackAllowed &&
      restored.current &&
      status === "readyToPlay" &&
      focused.current &&
      appIsForeground() &&
      (active || pendingSeekPlay.current)
    ) {
      pendingSeekPlay.current = false;
      playbackControl.play();
    } else if (!playbackAllowed || active === false) playbackControl.pause();
  }, [active, playbackAllowed, status, seek, playbackControl]);
  useEffect(() => {
    const app = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive")
        playbackControl.pause();
    });
    return () => app.remove();
  }, [playbackControl]);
  const onFirstFrame = useCallback(() => {
    frameReady.current = true;
    setFirstFrame(true);
    playback.current?.({
      seconds: player.currentTime,
      duration: player.duration,
      playing: playbackAllowedRef.current && player.playing,
      ready:
        !autoplayBlockedRef.current &&
        !reportedError.current &&
        player.status === "readyToPlay",
      rate: player.playbackRate,
    });
  }, [player]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const element = videoView.current?.nativeRef.current as
      HTMLVideoElement | undefined;
    if (!element) return;
    // Expo's web view omits preload. Set it on this same element once, without
    // a second src assignment/load that discards its already buffered bytes.
    element.preload = "auto";
    element.playsInline = true;
    // WebKit can dispatch loadstart before Expo installs its first-frame
    // listener, so its internal waiting flag never becomes true. Read this
    // element directly as well; HAVE_CURRENT_DATA means a decoded frame exists.
    const decodedFrame = () => {
      if (element.readyState >= 2) onFirstFrame();
    };
    element.addEventListener("loadeddata", decodedFrame);
    element.addEventListener("playing", decodedFrame);
    decodedFrame();
    return () => {
      element.removeEventListener("loadeddata", decodedFrame);
      element.removeEventListener("playing", decodedFrame);
      element.pause();
      element.removeAttribute("src");
      element.load();
    };
  }, [player, onFirstFrame]);
  const pending = !firstFrame && status !== "error";
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
        onFirstFrameRender={onFirstFrame}
        nativeControls={controls && playbackAllowed}
      />
      {!!posterUri && !firstFrame && (
        <Image
          source={{ uri: posterUri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          accessibilityLabel="Aperçu du short"
          pointerEvents="none"
        />
      )}
      {playbackAllowed && autoplayBlocked && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Démarrer la lecture"
          onPress={(event) => {
            event.stopPropagation();
            playbackControl.play();
          }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {playbackAllowed && !autoplayBlocked && (pending || status === "error") && (
        <View
          style={styles.status}
          pointerEvents={status === "error" || slow ? "auto" : "none"}
        >
          {pending && <ActivityIndicator color={colors.white} />}
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
