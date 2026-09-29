import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Images, Pin, PlaySquare } from "lucide-react-native";
import { NativeVideo } from "./Video";

export type MediaTileItem = {
  id: string;
  title?: string | null;
  image?: string | null;
  video?: string | null;
  pinned?: boolean;
  multiple?: boolean;
};
export function MediaTile({
  item,
  onPress,
  visible = true,
}: {
  item: MediaTileItem;
  onPress: () => void;
  visible?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${item.video ? "le Short" : "la publication"} : ${item.title?.trim() || "Sans légende"}`}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.8 : 1 }]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
        ) : item.video ? (
          <NativeVideo
            uri={item.video}
            active={false}
            muted
            controls={false}
            visible={visible}
            contentFit="cover"
            style={styles.video}
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
export function MediaGrid({
  items,
  onOpen,
}: {
  items: MediaTileItem[];
  onOpen: (item: MediaTileItem) => void;
}) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.id} style={styles.cell}>
          <MediaTile item={item} onPress={() => onOpen(item)} />
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
