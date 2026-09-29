import React, { useEffect, useState } from "react";
import { AppState, Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import {
  musicGenres,
  searchMusic,
  type MusicTrack,
} from "../data/shortMusicLibrary";
import { useTheme } from "../theme";
import { Button, Chip, Field, useUIStyles } from "./ui";
import { useCalls } from "./CallProvider";
function MusicPreview({ track, stop }: { track: MusicTrack; stop(): void }) {
  const s = useUIStyles(),
    player = useAudioPlayer(track.audioUrl),
    status = useAudioPlayerStatus(player);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    player.volume = 0.5;
    const timeout = setTimeout(() => {
      if (!player.isLoaded) setFailed(true);
    }, 15000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    return () => {
      clearTimeout(timeout);
      sub.remove();
      try {
        player.pause();
      } catch {
        /* Released by hook. */
      }
    };
  }, [player, stop]);
  useEffect(() => {
    if (
      status.isLoaded &&
      !failed &&
      AppState.currentState !== "background" &&
      AppState.currentState !== "inactive"
    ) {
      try {
        player.play();
      } catch {
        setFailed(true);
      }
    }
  }, [status.isLoaded, failed, player]);
  return failed ? (
    <Text accessibilityRole="alert" style={s.small}>
      Cette piste est indisponible. Choisissez-en une autre.
    </Text>
  ) : (
    <Text style={s.small}>
      {status.isLoaded ? "Écoute de l’aperçu" : "Chargement de l’aperçu…"}
    </Text>
  );
}
export function ShortMusicPicker({
  open,
  selected,
  choose,
  close,
}: {
  open: boolean;
  selected: string | null;
  choose(id: string | null): void;
  close(): void;
}) {
  const s = useUIStyles(),
    { colors } = useTheme(),
    calls = useCalls();
  const [query, setQuery] = useState(""),
    [genre, setGenre] = useState("Tous"),
    [preview, setPreview] = useState<MusicTrack | null>(null);
  const stop = React.useCallback(() => setPreview(null), []);
  useEffect(() => {
    if (!open || calls.busy) setPreview(null);
  }, [open, calls.busy]);
  const tracks = searchMusic(query, genre);
  return (
    <Modal visible={open} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{ padding: 16, gap: 12, flex: 1 }}
          accessibilityViewIsModal
        >
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text accessibilityRole="header" style={s.h2}>
              Musique du short
            </Text>
            <Button title="Fermer" secondary onPress={close} />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
          >
            <Text style={s.small}>
              La musique accompagne la lecture. Elle n’est pas incorporée au
              fichier vidéo. Les pistes proviennent du catalogue du site.
            </Text>
            <Field
              label="Rechercher une musique"
              value={query}
              onChangeText={setQuery}
            />
            <ScrollView
              horizontal
              style={{ flexGrow: 0, flexShrink: 0, minHeight: 48 }}
              contentContainerStyle={{ gap: 8 }}
              showsHorizontalScrollIndicator={false}
            >
              {musicGenres.map((value) => (
                <Chip
                  key={value}
                  label={value}
                  selected={genre === value}
                  onPress={() => setGenre(value)}
                />
              ))}
            </ScrollView>
            <Button
              title="Sans musique ajoutée"
              secondary
              onPress={() => {
                stop();
                choose(null);
                close();
              }}
            />
            {!!(preview && open && !calls.busy) && (
              <MusicPreview key={preview.id} track={preview} stop={stop} />
            )}
            <View style={{ gap: 10 }}>
              {!tracks.length && (
                <Text style={s.text}>Aucune musique pour cette recherche.</Text>
              )}
              {tracks.map((track) => (
                <View key={track.id} style={s.card}>
                  <Text style={s.h2}>{track.title}</Text>
                  <Text style={s.small}>
                    {track.artist} · {track.genre}
                  </Text>
                  <View style={[s.row, { flexWrap: "wrap" }]}>
                    <Button
                      accessibilityLabel={`Choisir ${track.title}`}
                      title={
                        selected === track.id ? "Musique choisie" : "Choisir"
                      }
                      secondary
                      onPress={() => {
                        stop();
                        choose(track.id);
                        close();
                      }}
                    />
                    <Button
                      accessibilityLabel={`${preview?.id === track.id ? "Arrêter l’aperçu de" : "Écouter"} ${track.title}`}
                      title={
                        preview?.id === track.id
                          ? "Arrêter l’aperçu"
                          : "Écouter"
                      }
                      secondary
                      disabled={calls.busy}
                      onPress={() =>
                        setPreview((value) =>
                          value?.id === track.id ? null : track,
                        )
                      }
                    />
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
