import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSoundtrackPlayer } from "../lib/useSoundtrackPlayer";
import { registerSoundActivation, setMediaMuted } from "../lib/mediaSound";
import { NativeVideo } from "./Video";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  Music,
  AudioLines,
} from "lucide-react-native";
import { useTheme } from "../theme";
import { useCalls } from "./CallProvider";
import { Chip, useUIStyles } from "./ui";
import {
  clipPosition,
  createShortAudioSync,
  playbackClip,
  soundtrackPosition,
  type ShortClip,
  type ShortPlayback,
} from "../lib/shortEditing";

function ShortSoundtrack({
  uri,
  state,
  muted,
  clipStart,
  allowed,
  onUnavailable,
}: {
  uri: string;
  state: ShortPlayback;
  muted: boolean;
  clipStart: number;
  allowed: boolean;
  onUnavailable(): void;
}) {
  const s = useUIStyles();
  // Source lifetime is confined to the one visible Short. This is playback only.
  const { player, status } = useSoundtrackPlayer(uri);
  const sync = useMemo(createShortAudioSync, [player]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (failed) onUnavailable();
  }, [failed, onUnavailable]);
  const mounted = useRef(true);
  const pause = useCallback(() => {
    try {
      player?.pause();
    } catch {
      /* Already released. */
    }
  }, [player]);
  const stateRef = useRef({ state, allowed });
  stateRef.current = { state, allowed };
  useEffect(() => {
    if (!player) return;
    player.loop = true;
    player.volume = 0.5;
  }, [player]);
  useEffect(() => {
    if (player) player.muted = muted;
  }, [muted, player]);
  useEffect(() => {
    mounted.current = true;
    const app = AppState.addEventListener("change", (value) => {
      if (value !== "active") sync.stop(pause);
    });
    return () => {
      mounted.current = false;
      sync.stop(pause);
      app.remove();
    };
  }, [sync, player, pause]);
  useEffect(() => {
    if (
      !player ||
      muted ||
      status.blocked ||
      failed ||
      !allowed ||
      !state.playing ||
      !state.ready
    ) {
      sync.stop(pause);
      return;
    }
    if (!status.isLoaded) return;
    player.playbackRate = Math.min(2, Math.max(0.1, state.rate));
    void sync
      .sync(
        {
          target: soundtrackPosition(state.seconds, clipStart, player.duration),
          play: true,
        },
        {
          time: () => player.currentTime,
          seek: (seconds) => player.seekTo(seconds),
          pause,
          play: () => {
            if (
              stateRef.current.allowed &&
              stateRef.current.state.playing &&
              AppState.currentState !== "background" &&
              AppState.currentState !== "inactive" &&
              !player.playing
            )
              return player.play();
          },
        },
      )
      .catch(() => {
        sync.stop(pause);
        if (mounted.current) setFailed(true);
      });
  }, [
    allowed,
    muted,
    status.blocked,
    failed,
    state.seconds,
    state.playing,
    state.ready,
    state.rate,
    clipStart,
    status.isLoaded,
    player?.duration,
    sync,
    player,
    pause,
  ]);
  useEffect(() => {
    if (!player) return;
    const timeout = setTimeout(() => {
      if (!player.isLoaded) setFailed(true);
    }, 15000);
    return () => clearTimeout(timeout);
  }, [player]);
  useEffect(() => {
    if (status.failed) setFailed(true);
  }, [status.failed]);
  useEffect(() => {
    if (status.blocked) setMediaMuted(true);
  }, [status.blocked]);
  useEffect(() => {
    if (!player || !allowed) return;
    return registerSoundActivation(() => {
      if (!stateRef.current.state.ready || !stateRef.current.state.playing)
        return;
      player.muted = false;
      void player.play().catch(() => setFailed(true));
    });
  }, [player, allowed]);
  return failed ? (
    <Text accessibilityRole="alert" style={s.small}>
      Cette musique est indisponible. Le son original est utilisé.
    </Text>
  ) : null;
}
function ShortControl({
  label,
  disabled = false,
  selected,
  onPress,
  children,
}: {
  label: string;
  disabled?: boolean;
  selected?: boolean;
  onPress(): void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      aria-disabled={disabled}
      {...(Platform.OS === "web" && selected !== undefined
        ? { "aria-pressed": selected }
        : {})}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        justifyContent: "center",
        alignItems: "center",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </Pressable>
  );
}
export function ShortVideo({
  uri,
  posterUri,
  visible = true,
  autoplay = false,
  clip,
  musicUri,
  goals = [],
  style,
  onProgress,
  playRequest,
  controls = true,
  muted: controlledMuted,
}: {
  uri: string;
  posterUri?: string | null;
  visible?: boolean;
  autoplay?: boolean;
  clip?: ShortClip | null;
  musicUri?: string | null;
  goals?: readonly number[];
  style?: StyleProp<ViewStyle>;
  onProgress?: (seconds: number, duration: number) => void;
  playRequest?: number;
  controls?: boolean;
  muted?: boolean;
}) {
  const s = useUIStyles(),
    calls = useCalls(),
    { colors } = useTheme();
  const [focused, setFocused] = useState(false),
    [foreground, setForeground] = useState(
      AppState.currentState !== "background" &&
        AppState.currentState !== "inactive",
    );
  const [wanted, setWanted] = useState(autoplay),
    [localMuted, setMuted] = useState(true),
    [original, setOriginal] = useState(false);
  const muted = controlledMuted ?? localMuted;
  const useOriginalAudio = useCallback(() => setOriginal(true), []);
  const [state, setState] = useState<ShortPlayback>({
    seconds: 0,
    duration: 0,
    playing: false,
    ready: false,
    rate: 1,
  });
  const [seek, setSeek] = useState<{
    seconds: number;
    play: boolean;
    request: number;
  }>();
  const request = useRef(0),
    previousPlayRequest = useRef(playRequest);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (value) =>
      setForeground(value !== "background" && value !== "inactive"),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    setWanted(autoplay);
    setOriginal(false);
    setSeek(undefined);
    setState({
      seconds: 0,
      duration: 0,
      playing: false,
      ready: false,
      rate: 1,
    });
  }, [uri, autoplay]);
  useEffect(() => {
    if (
      playRequest !== undefined &&
      playRequest !== previousPlayRequest.current
    ) {
      previousPlayRequest.current = playRequest;
      setWanted(true);
      setSeek({
        seconds: clip?.start ?? 0,
        play: true,
        request: ++request.current,
      });
    }
  }, [playRequest, clip?.start]);
  const allowed = visible && focused && foreground && !calls.busy;
  useEffect(() => {
    if (!allowed)
      setState((value) =>
        value.playing || value.ready
          ? { ...value, playing: false, ready: false }
          : value,
      );
  }, [allowed]);
  const music = !original && !!musicUri;
  const markers = (Array.isArray(goals) ? goals : []).filter(
    (value) =>
      Number.isFinite(value) &&
      value >= (clip?.start ?? 0) &&
      (!clip || value < clip.start + clip.duration),
  );
  const togglePlayback = () => {
    if (wanted) {
      setSeek({
        seconds: state.seconds,
        play: false,
        request: ++request.current,
      });
    }
    setWanted((value) => !value);
  };
  return (
    <View style={style || { width: "100%" }}>
      <View style={style ? { flex: 1, minHeight: 80 } : { aspectRatio: 1 }}>
        <NativeVideo
          uri={uri}
          posterUri={posterUri}
          visible={allowed}
          active={wanted && allowed}
          clip={clip}
          seek={seek}
          muted={muted}
          volume={music ? 0 : 1}
          controls={false}
          onPlayback={setState}
          onProgress={onProgress}
          style={{ flex: 1, height: "100%", aspectRatio: undefined }}
        />
        {!controls && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              wanted ? "Mettre le short en pause" : "Reprendre le short"
            }
            disabled={!allowed || !state.ready}
            pointerEvents={state.ready ? "auto" : "none"}
            onPress={togglePlayback}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {!wanted && (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "rgba(0,0,0,0.4)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Play size={30} color="#FFFFFF" fill="#FFFFFF" />
              </View>
            )}
          </Pressable>
        )}
      </View>
      {controls && (
        <View style={{ padding: 8, gap: 4, backgroundColor: colors.surface }}>
          <View
            style={[
              s.row,
              { gap: 4, flexWrap: "wrap", justifyContent: "center" },
            ]}
          >
            <ShortControl
              label={
                wanted && allowed ? "Mettre le short en pause" : "Lire le short"
              }
              disabled={!allowed}
              onPress={togglePlayback}
            >
              {wanted && allowed ? (
                <Pause size={22} color={colors.ink} />
              ) : (
                <Play size={22} color={colors.ink} />
              )}
            </ShortControl>
            <ShortControl
              label={
                muted ? "Activer le son du short" : "Couper le son du short"
              }
              selected={!muted}
              onPress={() => {
                if (muted) setMediaMuted(false);
                setMuted(!muted);
              }}
            >
              {muted ? (
                <VolumeX size={22} color={colors.ink} />
              ) : (
                <Volume2 size={22} color={colors.ink} />
              )}
            </ShortControl>
            <ShortControl
              label="Reculer de 5 secondes"
              disabled={!allowed || state.duration <= 0}
              onPress={() =>
                setSeek({
                  seconds: Math.max(clip?.start ?? 0, state.seconds - 5),
                  play: wanted,
                  request: ++request.current,
                })
              }
            >
              <RotateCcw size={22} color={colors.ink} />
            </ShortControl>
            <ShortControl
              label="Avancer de 5 secondes"
              disabled={!allowed || state.duration <= 0}
              onPress={() =>
                setSeek({
                  seconds: Math.max(
                    0,
                    Math.min(
                      (clip ? clip.start + clip.duration : state.duration) -
                        0.1,
                      state.seconds + 5,
                    ),
                  ),
                  play: wanted,
                  request: ++request.current,
                })
              }
            >
              <RotateCw size={22} color={colors.ink} />
            </ShortControl>
            {!!musicUri && (
              <ShortControl
                label={
                  original
                    ? "Écouter la musique du short"
                    : "Écouter le son original"
                }
                selected={!original}
                onPress={() => setOriginal((value) => !value)}
              >
                {original ? (
                  <Music size={22} color={colors.ink} />
                ) : (
                  <AudioLines size={22} color={colors.ink} />
                )}
              </ShortControl>
            )}
          </View>
          {!!markers.length && (
            <ScrollView
              horizontal
              contentContainerStyle={{ gap: 8 }}
              style={{ flexGrow: 0 }}
            >
              {markers.map((seconds) => (
                <Chip
                  key={seconds}
                  label={`But · ${seconds.toFixed(1)} s`}
                  disabled={!allowed}
                  onPress={() => {
                    setWanted(true);
                    setSeek({
                      seconds: clipPosition(
                        seconds,
                        playbackClip(clip, state.duration),
                      ),
                      play: true,
                      request: ++request.current,
                    });
                  }}
                />
              ))}
            </ScrollView>
          )}
        </View>
      )}
      {!!(music && allowed) && (
        <ShortSoundtrack
          key={musicUri}
          uri={musicUri!}
          state={state}
          muted={muted}
          clipStart={clip?.start ?? 0}
          allowed={allowed && wanted}
          onUnavailable={useOriginalAudio}
        />
      )}
    </View>
  );
}
