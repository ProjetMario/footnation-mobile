import React, { useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Newspaper } from "lucide-react-native";
import type { NewsTopic } from "../types/news";
import { brandHero } from "../lib/brandAssets";

const fallbackHero = brandHero;

const badImageHints = [
  "avatar",
  "badge",
  "crest",
  "default",
  "favicon",
  "icon",
  "logo",
  "placeholder",
  "profile",
  "sprite",
  "transparent",
];

const topicLabels: Partial<Record<NewsTopic, string>> = {
  top: "A la une",
  mercato: "Mercato",
  ligue1: "Ligue 1",
  ucl: "Europe",
  epl: "Premier League",
  laliga: "Liga",
  seriea: "Serie A",
  bundesliga: "Bundesliga",
  feminine: "Football feminin",
  world: "International",
  youth: "Jeunes",
  injuries: "Infirmerie",
  coaches: "Coachs",
  referee: "Arbitrage",
};

export function isUsableNewsImageUrl(value?: string | null) {
  if (!value) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(url.protocol)) return false;
  const path = `${url.hostname}${url.pathname}`.toLowerCase();
  if (/\.(svg|ico)(\?|$)/.test(path)) return false;
  if (badImageHints.some((hint) => path.includes(hint))) return false;
  const width = Number(
    url.searchParams.get("w") || url.searchParams.get("width"),
  );
  const height = Number(
    url.searchParams.get("h") || url.searchParams.get("height"),
  );
  if ((width && width < 420) || (height && height < 260)) return false;
  return true;
}

export function NewsVisual({
  imageUrl,
  sourceName,
  topic,
  style,
  imageStyle,
  fallbackOverlay = true,
  contentFit = "cover",
}: {
  imageUrl?: string | null;
  sourceName?: string | null;
  topic?: NewsTopic | null;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
  fallbackOverlay?: boolean;
  contentFit?: "cover" | "contain";
}) {
  const usableImage = useMemo(() => isUsableNewsImageUrl(imageUrl), [imageUrl]);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);
  const showFallback = !usableImage || failed;
  const label = topic ? topicLabels[topic] || "Football" : "Football";
  return (
    <View style={[styles.frame, style]}>
      <Image
        source={showFallback ? fallbackHero : { uri: imageUrl! }}
        contentFit={contentFit}
        style={[StyleSheet.absoluteFill, imageStyle]}
        transition={160}
        onError={() => setFailed(true)}
      />
      {showFallback && fallbackOverlay ? (
        <>
          <LinearGradient
            colors={["rgba(4,18,38,0.2)", "rgba(4,18,38,0.82)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.badge}>
            <Newspaper size={16} color="#FFFFFF" strokeWidth={2.4} />
            <Text numberOfLines={1} style={styles.badgeText}>
              {label}
            </Text>
          </View>
          {!!sourceName && (
            <Text numberOfLines={1} style={styles.source}>
              {sourceName}
            </Text>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: "#07182E",
    overflow: "hidden",
  },
  badge: {
    position: "absolute",
    left: 14,
    top: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.42)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  source: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowRadius: 4,
  },
});
