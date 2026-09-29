import React, { useEffect, useRef, useState } from "react";
import { AppState, Linking, Modal, Text, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeVideo } from "./Video";
import { useTheme } from "../theme";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCalls } from "./CallProvider";
import { Button, ErrorState, useUIStyles } from "./ui";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  normalizeAttachment,
  MESSAGE_ATTACHMENT_BUCKET,
  type MessageAttachment,
} from "../lib/messageAttachment";
import type { Message } from "../lib/models";
import { createMessagePlaybackArbiter } from "../lib/messageMediaLifecycle";

const playback = createMessagePlaybackArbiter();
export function MessageAttachmentView({
  message,
  active: focused,
}: {
  message: Message;
  active: boolean;
}) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const s = useUIStyles();
  const { colors } = useTheme();
  const calls = useCalls();
  const [source, setSource] = useState<string | null>(null);
  const [visualSource, setVisualSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // SDK57 recreates useAudioPlayer(source) on every URL change. Keep one player
  // so setting the signed source does not tear down its pending playback intent.
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const wanted = useRef(false);
  const generation = useRef(0);
  const pending = useRef<number | null>(null);
  const playbackIntent = useRef(0);
  const expiresAt = useRef(0);
  const foreground = useRef(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const current = useRef({ uid, focused, busy: calls.busy });
  current.current = { uid, focused, busy: calls.busy };
  let attachment: MessageAttachment | null;
  try {
    attachment = normalizeAttachment(
      message.attachment,
      message.sender_id,
      message.receiver_id,
      message.id,
    );
  } catch {
    attachment = null;
  }
  const attachmentPath = attachment?.path;
  useEffect(() => {
    player.replace(null);
    setSource(null);
    setVisualSource(null);
    expiresAt.current = 0;
    const stop = () => {
      generation.current++;
      pending.current = null;
      wanted.current = false;
      try {
        player.pause();
      } catch {
        /* The hook can release a player before cleanup. */
      }
      setBusy(false);
    };
    const unsubscribe = playback.subscribe(stop);
    const sub = AppState.addEventListener("change", (state) => {
      foreground.current = state === "active";
      if (state !== "active") {
        stop();
        player.replace(null);
        setSource(null);
        setVisualSource(null);
      }
    });
    return () => {
      generation.current++;
      wanted.current = false;
      pending.current = null;
      unsubscribe();
      try {
        player.pause();
      } catch {
        /* Released with the component. */
      }
      sub.remove();
    };
  }, [player, uid, attachmentPath]);
  useEffect(() => {
    if (!focused || calls.busy) {
      generation.current++;
      wanted.current = false;
      player.pause();
      player.replace(null);
      pending.current = null;
      setBusy(false);
      setSource(null);
      setVisualSource(null);
    }
  }, [focused, calls.busy, player]);
  useEffect(() => {
    if (
      wanted.current &&
      status.isLoaded &&
      focused &&
      !calls.busy &&
      foreground.current &&
      playback.current(playbackIntent.current)
    ) {
      wanted.current = false;
      try {
        player.play();
      } catch {
        player.replace(null);
        setSource(null);
        setError(new Error("Impossible de lire ce message vocal. Réessayez."));
      }
      setBusy(false);
    }
  }, [source, status.isLoaded, focused, calls.busy, player]);
  useEffect(() => {
    if (!status.error) return;
    wanted.current = false;
    setBusy(false);
    setError(new Error("Impossible de lire ce message vocal. Réessayez."));
    player.pause();
    player.replace(null);
    setSource(null);
  }, [status.error, player]);
  useEffect(() => {
    if (!source || status.isLoaded || !wanted.current) return;
    const timer = setTimeout(() => {
      if (!wanted.current) return;
      wanted.current = false;
      player.pause();
      player.replace(null);
      setSource(null);
      setBusy(false);
      setError(
        new Error(
          "Le chargement du message vocal a pris trop de temps. Réessayez.",
        ),
      );
    }, 15000);
    return () => clearTimeout(timer);
  }, [source, status.isLoaded, player]);
  async function open() {
    if (
      !uid ||
      !attachment ||
      pending.current !== null ||
      !focused ||
      calls.busy ||
      !foreground.current
    )
      return;
    const wasPlaying = status.playing;
    playbackIntent.current = playback.take();
    const attempt = ++generation.current;
    const valid = () =>
      attempt === generation.current &&
      current.current.uid === uid &&
      current.current.focused &&
      !current.current.busy &&
      foreground.current &&
      playback.current(playbackIntent.current);
    if (attachment.kind === "voice" && wasPlaying) return;
    pending.current = attempt;
    setBusy(true);
    setError(null);
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error || auth.data.user?.id !== uid)
        throw new Error("Votre session a changé.");
      if (!valid()) return;
      if (
        attachment.kind === "voice" &&
        source &&
        status.isLoaded &&
        !status.error &&
        Date.now() < expiresAt.current
      ) {
        if (status.didJustFinish || status.currentTime >= status.duration)
          await player.seekTo(0);
        if (valid()) player.play();
        return;
      }
      const result = await supabase.storage
        .from(MESSAGE_ATTACHMENT_BUCKET)
        .createSignedUrl(attachment.path, 180);
      if (result.error) throw result.error;
      const checked = await supabase.auth.getUser();
      if (!valid() || checked.data.user?.id !== uid || checked.error) return;
      if (attachment.kind === "voice") {
        wanted.current = true;
        expiresAt.current = Date.now() + 150000;
        player.replace(result.data.signedUrl);
        setSource(result.data.signedUrl);
      } else if (
        attachment.mime.startsWith("image/") ||
        attachment.mime === "video/mp4"
      ) {
        setVisualSource(result.data.signedUrl);
      } else await Linking.openURL(result.data.signedUrl);
    } catch (e) {
      if (valid()) {
        wanted.current = false;
        setError(
          new Error("Impossible d’ouvrir cette pièce jointe. Réessayez."),
        );
      }
    } finally {
      if (pending.current === attempt) pending.current = null;
      if (attempt === generation.current && !wanted.current) setBusy(false);
    }
  }
  if (!attachment)
    return <Text style={s.small}>Pièce jointe indisponible.</Text>;
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Button
        secondary
        title={
          attachment.kind === "voice"
            ? status.playing
              ? "Mettre en pause"
              : `Écouter · ${Math.ceil(attachment.duration || 0)} s`
            : `Ouvrir ${attachment.name}`
        }
        busy={busy}
        disabled={!focused || calls.busy}
        onPress={() => void open()}
      />
      {!!error && <ErrorState error={error} />}
      {!!visualSource && (
        <Modal
          animationType="slide"
          onRequestClose={() => setVisualSource(null)}
        >
          <SafeAreaView
            style={{
              flex: 1,
              padding: 16,
              backgroundColor: colors.surface,
              gap: 12,
            }}
          >
            <Text style={s.h2} numberOfLines={2}>
              {attachment.name}
            </Text>
            <Button
              title="Fermer la pièce jointe"
              secondary
              onPress={() => setVisualSource(null)}
            />
            {attachment.mime.startsWith("image/") ? (
              <Image
                source={{ uri: visualSource }}
                cachePolicy="none"
                contentFit="contain"
                accessibilityLabel={attachment.name}
                onError={() => {
                  setVisualSource(null);
                  setError(
                    new Error(
                      "Cette image n’est plus disponible. Rouvrez-la pour réessayer.",
                    ),
                  );
                }}
                style={{ flex: 1 }}
              />
            ) : (
              <NativeVideo uri={visualSource} style={{ flex: 1 }} />
            )}
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}
