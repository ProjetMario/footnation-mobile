import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Images, Pin, PlaySquare } from "lucide-react-native";
import { useVideoPlayer, type VideoThumbnail } from "expo-video";
import { NativeVideo } from "./Video";

export type MediaTileItem = {
  id: string;
  title?: string | null;
  image?: string | null;
  video?: string | null;
  fallbackVideo?: string | null;
  pinned?: boolean;
  multiple?: boolean;
};
export function MediaTile({
  item,
  onPress,
  visible = true,
  videoPreview = true,
}: {
  item: MediaTileItem;
  onPress: () => void;
  visible?: boolean;
  videoPreview?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [item.image]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${item.video ? "le Short" : "la publication"} : ${item.title?.trim() || "Sans légende"}`}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.8 : 1 }]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {item.image && !imageFailed ? (
          <Image
            source={{ uri: item.image }}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
            onError={() => setImageFailed(true)}
          />
        ) : item.video && videoPreview ? (
          <VideoTilePoster
            uri={item.video}
            fallbackUri={item.fallbackVideo || undefined}
            visible={visible}
          />
        ) : (
          <LinearGradient
            colors={["#10233E", "#255079"]}
            style={styles.textTile}
          >
            <Text numberOfLines={7} style={styles.caption}>
              {item.title || "Publication"}
            </Text>
          </LinearGradient>
        )}
        <View style={styles.marker}>
          {item.pinned ? (
            <Pin size={20} color="white" fill="white" />
          ) : item.video ? (
            <PlaySquare size={20} color="white" />
          ) : item.multiple ? (
            <Images size={20} color="white" />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function VideoTilePoster({
  uri,
  fallbackUri,
  visible,
}: {
  uri: string;
  fallbackUri?: string;
  visible: boolean;
}) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const source = failedUri === uri && fallbackUri ? fallbackUri : uri;
  const handleUnavailable = useCallback(() => {
    if (source === uri && fallbackUri) setFailedUri(uri);
  }, [fallbackUri, source, uri]);
  if (Platform.OS === "web")
    return (
      <NativeVideo
        uri={source}
        active={false}
        muted
        controls={false}
        visible={visible}
        contentFit="cover"
        style={styles.video}
      />
    );
  return (
    <GeneratedVideoPoster
      key={source}
      uri={source}
      onUnavailable={handleUnavailable}
    />
  );
}

function GeneratedVideoPoster({
  uri,
  onUnavailable,
}: {
  uri: string;
  onUnavailable: () => void;
}) {
  const [thumbnail, setThumbnail] = useState<VideoThumbnail | null>(null);
  const retainedThumbnail = useRef<VideoThumbnail | null>(null);
  const player = useVideoPlayer(null, (instance) => {
    instance.muted = true;
    instance.staysActiveInBackground = false;
  });
  useEffect(() => {
    let current = true;
    void player
      .replaceAsync({ uri, useCaching: true })
      .then(() =>
        player.generateThumbnailsAsync([0.1, 0], {
          maxWidth: 480,
          maxHeight: 640,
        }),
      )
      .then((thumbnails) => {
        const next = thumbnails[0];
        if (!current || !next) {
          thumbnails.forEach((item) => item.release());
          if (current) onUnavailable();
          return;
        }
        thumbnails.slice(1).forEach((item) => item.release());
        retainedThumbnail.current = next;
        setThumbnail(next);
      })
      .catch(() => {
        if (current) onUnavailable();
      });
    return () => {
      current = false;
      retainedThumbnail.current?.release();
      retainedThumbnail.current = null;
    };
  }, [player, uri, onUnavailable]);
  return thumbnail ? (
    <Image
      source={thumbnail}
      contentFit="cover"
      style={StyleSheet.absoluteFill}
      accessibilityLabel="Aperçu du Short"
    />
  ) : (
    <LinearGradient colors={["#10233E", "#255079"]} style={styles.textTile}>
      <PlaySquare size={28} color="white" />
    </LinearGradient>
  );
}
export function MediaGrid({
  items,
  onOpen,
  videoPreviews = true,
}: {
  items: MediaTileItem[];
  onOpen: (item: MediaTileItem) => void;
  videoPreviews?: boolean;
}) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.id} style={styles.cell}>
          <MediaTile
            item={item}
            onPress={() => onOpen(item)}
            videoPreview={videoPreviews}
          />
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", width: "100%" },
  cell: { width: "33.333333%", padding: 1 },
  tile: {
    width: "100%",
    aspectRatio: 3 / 4,
    overflow: "hidden",
    backgroundColor: "#10233E",
  },
  video: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 0,
    backgroundColor: "#10233E",
  },
  marker: {
    position: "absolute",
    right: 7,
    top: 7,
    borderRadius: 6,
    padding: 3,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  textTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  caption: {
    color: "white",
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
