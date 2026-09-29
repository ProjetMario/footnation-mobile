import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowUpRight, Heart, MapPin, RotateCcw, Star, X } from "lucide-react-native";
import type { MatchableItem, SwipeDirection } from "../types/matching";

export function FootballMatchCard({
  item,
  busy,
  canLike,
  showScore,
  onChoose,
  onOpen,
  opportunity = false,
  fullscreen = false,
  overlay,
  canReview = false,
  onReview,
}: {
  opportunity?: boolean;
  fullscreen?: boolean;
  overlay?: React.ReactNode;
  item: MatchableItem;
  busy: boolean;
  canLike: boolean;
  showScore: boolean;
  canReview?: boolean;
  onReview?: () => void;
  onChoose: (direction: SwipeDirection) => void;
  onOpen: () => void;
}) {
  const { height, width } = useWindowDimensions();
  const offset = useRef(new Animated.Value(0)).current;
  const [failedImage, setFailedImage] = useState(false);
  const reset = () =>
    Animated.spring(offset, { toValue: 0, useNativeDriver: false }).start();
  const gesture = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !busy && Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderMove: (_, g) => offset.setValue(g.dx),
        onPanResponderRelease: (_, g) => {
          reset();
          if (g.dx < -90) onChoose("left");
          else if (g.dx > 90 && canLike) onChoose("right");
        },
        onPanResponderTerminate: reset,
      }),
    [busy, canLike, onChoose, offset],
  );
  const photo = !!item.avatar_url && !failedImage;
  const tags =
    item.entity_type === "profile"
      ? [item.primary_role, item.position, item.highest_level]
      : [
          opportunity ? "Opportunité" : "Club",
          item.division || item.competition_level,
          item.recruiting_status ? "Recrute actuellement" : null,
        ];
  const description =
    item.entity_type === "profile" ? item.bio : item.project_description;
  return (
    <View
      style={[
        styles.deck,
        fullscreen && { maxWidth: width, width, marginTop: 0, flex: 1 },
      ]}
    >
      {!fullscreen && <View style={styles.backCard} />}
      <Animated.View
        {...gesture.panHandlers}
        style={[
          styles.card,
          {
            height: fullscreen
              ? height
              : Math.max(480, Math.min(650, height * 0.7)),
            borderRadius: fullscreen ? 0 : 28,
            transform: [
              { translateX: offset },
              {
                rotate: offset.interpolate({
                  inputRange: [-250, 0, 250],
                  outputRange: ["-9deg", "0deg", "9deg"],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      >
        <Image
          source={
            photo
              ? { uri: item.avatar_url! }
              : require("../../assets/brand/app-icon.png")
          }
          onError={() => setFailedImage(true)}
          resizeMode={photo ? "cover" : "contain"}
          style={[
            StyleSheet.absoluteFill,
            { width: "100%", height: "100%" },
            !photo
              ? { height: "60%", top: "8%", width: "80%", left: "10%" }
              : null,
          ]}
        />
        <LinearGradient
          colors={[
            "rgba(4,15,31,.3)",
            "rgba(4,15,31,0)",
            "rgba(4,15,31,.88)",
            "#040f1f",
          ]}
          locations={[0, 0.3, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.top, fullscreen && { paddingTop: 24 }]}>
          {overlay}
          <Text style={styles.badge}>
            ⚽{" "}
            {opportunity
              ? "TA PROCHAINE OPPORTUNITÉ"
              : item.entity_type === "club"
                ? "TON PROCHAIN CLUB"
                : "TON PROCHAIN COÉQUIPIER"}
          </Text>
          {showScore && (
            <Text style={styles.score}>
              {item.compatibility_score}% compatible
            </Text>
          )}
        </View>
        <Animated.Text
          style={[
            styles.stamp,
            {
              color: "#40e0ad",
              borderColor: "#40e0ad",
              opacity: offset.interpolate({
                inputRange: [20, 90],
                outputRange: [0, 1],
                extrapolate: "clamp",
              }),
            },
          ]}
        >
          INTÉRESSÉ
        </Animated.Text>
        <Animated.Text
          style={[
            styles.stamp,
            {
              color: "#ff6b80",
              borderColor: "#ff6b80",
              right: 24,
              opacity: offset.interpolate({
                inputRange: [-90, -20],
                outputRange: [1, 0],
                extrapolate: "clamp",
              }),
            },
          ]}
        >
          PASSER
        </Animated.Text>
        <View
          style={[
            styles.bottom,
            fullscreen && {
              width: "100%",
              maxWidth: 640,
              alignSelf: "center",
              paddingBottom: 32,
            },
          ]}
        >
          <View style={styles.nameRow}>
            <Text numberOfLines={2} style={styles.name}>
              {item.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voir la fiche"
              onPress={onOpen}
              style={styles.open}
            >
              <ArrowUpRight color="white" size={24} />
            </Pressable>
          </View>
          {!!item.location.city && (
            <View style={styles.location}>
              <MapPin color="#d5deeb" size={16} />
              <Text style={styles.locationText}>
                {[item.location.city, item.location.department]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          )}
          <View style={styles.tags}>
            {tags.filter(Boolean).map((tag, i) => (
              <Text key={i} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>
          {!!description && (
            <Text numberOfLines={2} style={styles.bio}>
              {description}
            </Text>
          )}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Revoir la dernière fiche"
                accessibilityState={{ disabled: busy || !canReview }}
                disabled={busy || !canReview || !onReview}
                onPress={onReview}
                style={({ pressed }) => [
                  styles.circle,
                  styles.reviewCircle,
                  { opacity: busy || !canReview ? 0.35 : pressed ? 0.65 : 1 },
                ]}
              >
                <RotateCcw size={27} color="#f5b84b" />
              </Pressable>
              <Text style={styles.actionLabel}>Revoir</Text>
            </View>
            {(
              [
                ["left", "Passer", X, "#ff6b80"],
                [
                  "super",
                  opportunity ? "Détails" : "Coup de cœur",
                  Star,
                  "#58b6ff",
                ],
                [
                  "right",
                  opportunity ? "Voir l’annonce" : "Intéressé",
                  Heart,
                  "#40e0ad",
                ],
              ] as const
            ).map(([direction, label, Icon, color]) => {
              const disabled = busy || (direction !== "left" && !canLike);
              return (
                <View key={direction} style={styles.action}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ disabled }}
                    disabled={disabled}
                    onPress={() => onChoose(direction)}
                    style={({ pressed }) => [
                      styles.circle,
                      {
                        borderColor: color,
                        opacity: disabled ? 0.35 : pressed ? 0.65 : 1,
                        backgroundColor:
                          direction === "right" ? "#0a3e36" : "#152238",
                      },
                    ]}
                  >
                    <Icon
                      size={direction === "super" ? 26 : 32}
                      color={color}
                    />
                  </Pressable>
                  <Text style={styles.actionLabel}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </Animated.View>
      {!fullscreen && (
        <Text style={styles.hint}>
          Glisse à gauche pour passer · à droite pour matcher
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  deck: { width: "100%", maxWidth: 480, alignSelf: "center", marginTop: 8 },
  backCard: {
    position: "absolute",
    top: -8,
    left: 12,
    right: 12,
    height: "85%",
    backgroundColor: "#cbdcf0",
    borderRadius: 28,
  },
  card: {
    backgroundColor: "#102b47",
    borderRadius: 28,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  top: { padding: 20, alignItems: "flex-start", gap: 8 },
  badge: {
    color: "white",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    backgroundColor: "#123655bb",
    padding: 9,
    borderRadius: 20,
  },
  score: { color: "#98f4d4", fontWeight: "700", fontSize: 12 },
  stamp: {
    position: "absolute",
    top: 110,
    marginHorizontal: 24,
    borderWidth: 3,
    padding: 8,
    fontSize: 26,
    fontWeight: "900",
    transform: [{ rotate: "-12deg" }],
  },
  bottom: { padding: 22, gap: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { flex: 1, color: "white", fontSize: 30, fontWeight: "800" },
  open: { padding: 9, borderRadius: 30, backgroundColor: "#ffffff22" },
  location: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: { flex: 1, color: "#d5deeb", fontSize: 13 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    color: "white",
    backgroundColor: "#ffffff22",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },
  bio: { color: "#d5deeb", fontSize: 14, lineHeight: 20 },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    marginTop: 8,
  },
  action: { alignItems: "center", gap: 7 },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewCircle: {
    borderColor: "#f5b84b",
    backgroundColor: "#3c2c12",
  },
  actionLabel: { color: "#d5deeb", fontSize: 11 },
  hint: {
    textAlign: "center",
    color: "#68768c",
    fontSize: 12,
    marginTop: 18,
    marginBottom: 8,
  },
});
