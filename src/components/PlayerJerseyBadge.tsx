import React, { useId } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { visibleJerseyNumber } from "../lib/profileJersey";

/** Lightweight vector badge shared by Web, iOS and Android. */
export function PlayerJerseyBadge({
  number,
  compact = false,
}: {
  number: number;
  compact?: boolean;
}) {
  const id = `jersey-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (visibleJerseyNumber(number) === null) return null;
  const width = compact ? 48 : 60;
  const height = compact ? 52 : 64;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Numéro de maillot ${number}`}
      style={[styles.badge, { width, height }]}
    >
      <Svg
        width={width}
        height={height}
        viewBox="0 0 64 68"
        accessible={false}
        aria-hidden
      >
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0967FF" />
            <Stop offset="100%" stopColor="#7A2CFF" />
          </LinearGradient>
        </Defs>
        <Path
          d="M21 5 11 10 2 26 14 32 19 24 18 61 Q32 66 46 61 L45 24 50 32 62 26 53 10 43 5 Q32 12 21 5Z"
          fill={`url(#${id})`}
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <Path
          d="M23 6 Q32 18 41 6 M12 12 20 21 M52 12 44 21 M20 58 Q32 62 44 58"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </Svg>
      <View pointerEvents="none" aria-hidden style={styles.numberWrap}>
        <Text
          accessible={false}
          allowFontScaling={false}
          style={[styles.number, { fontSize: compact ? 22 : 28 }]}
        >
          {number}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexShrink: 0, position: "relative" },
  numberWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 8,
  },
  number: {
    color: "#FFFFFF",
    fontFamily: "Inter-Bold",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
});
