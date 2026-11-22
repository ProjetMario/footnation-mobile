import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Link, type Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Play } from "lucide-react-native";
import { useLanguage } from "../lib/i18n";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { publicLandingCopies } from "./publicLandingCopy";
import PresentationVideo from "./PresentationVideo";

export function PublicLanding() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { width, fontScale } = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState(width);
  const copy = publicLandingCopies[language] || publicLandingCopies.fr;
  const wide = availableWidth >= 900 && fontScale < 1.5;
  const rtl = language === "ar";

  return (
    <View
      testID="public-landing"
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
      style={[styles.page, { direction: rtl ? "rtl" : "ltr" }]}
    >
      <View style={[styles.composition, wide && styles.compositionWide]}>
        <View style={[styles.intro, wide && styles.introWide]}>
          <LinearGradient
            colors={["#0066FF", "#8B20FF", "#FF1744"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.signature}
            aria-hidden
          />
          <Text
            accessibilityRole="header"
            style={[
              styles.title,
              wide && styles.titleWide,
              availableWidth < 360 && styles.titleSmall,
              rtl && styles.rtlText,
            ]}
          >
            {copy.title}
            {"\n"}
            <Text style={styles.titleAccent}>{copy.titleAccent}</Text>
          </Text>
          <Text style={[styles.description, rtl && styles.rtlText]}>
            {copy.description}
          </Text>
          <View style={styles.actions}>
            <LandingLink href="/signup" label={copy.signup} primary rtl={rtl} />
            <LandingLink href="/login" label={copy.login} rtl={rtl} />
          </View>
          <LandingLink href="/search" label={copy.explore} subtle rtl={rtl} />
        </View>
        <View style={[styles.videoColumn, wide && styles.videoWide]}>
          <View style={styles.videoLabel}>
            <Play size={15} color={colors.deepBlue} aria-hidden />
            <Text accessibilityRole="header" style={styles.eyebrow}>
              {copy.videoTitle}
            </Text>
          </View>
          <View style={styles.videoFrame}>
            <PresentationVideo
              title={copy.videoTitle}
              language={language}
              watchLabel={copy.watchVideo}
            />
          </View>
          <View style={styles.videoCaption}>
            <Text
              accessibilityRole="header"
              style={[styles.joinTitle, rtl && styles.rtlText]}
            >
              {copy.joinTitle}
            </Text>
            <Text style={[styles.joinDescription, rtl && styles.rtlText]}>
              {copy.joinDescription}
            </Text>
            <LandingLink href="/signup" label={copy.signup} primary rtl={rtl} />
          </View>
        </View>
      </View>
    </View>
  );
}

function LandingLink({
  href,
  label,
  primary = false,
  subtle = false,
  external = false,
  rtl,
}: {
  href: Href;
  label: string;
  primary?: boolean;
  subtle?: boolean;
  external?: boolean;
  rtl: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <Link
      href={href}
      asChild
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={StyleSheet.flatten([
          styles.action,
          subtle && styles.subtleAction,
          {
            backgroundColor: primary
              ? pressed || hovered
                ? colors.navy
                : colors.deepBlue
              : pressed || hovered
                ? colors.accentSoft
                : subtle
                  ? "transparent"
                  : colors.surface,
            borderColor: focused
              ? colors.ink
              : primary || subtle
                ? "transparent"
                : colors.border,
          },
        ])}
      >
        <Text
          style={[
            styles.actionText,
            primary && styles.primaryText,
            subtle && styles.subtleText,
          ]}
        >
          {label}
        </Text>
        {(primary || subtle) && (
          <ArrowRight
            size={subtle ? 16 : 20}
            color={primary ? colors.background : colors.muted}
            style={rtl ? { transform: [{ rotate: "180deg" }] } : undefined}
            aria-hidden
          />
        )}
      </Pressable>
    </Link>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    page: { width: "100%", maxWidth: 1080, alignSelf: "center" },
    composition: {
      paddingHorizontal: 24,
      paddingTop: 36,
      paddingBottom: 48,
      gap: 32,
    },
    compositionWide: {
      flexDirection: "row",
      alignItems: "center",
      gap: 72,
      paddingTop: 36,
      paddingBottom: 48,
    },
    intro: { gap: 22, width: "100%", maxWidth: 620, alignSelf: "center" },
    introWide: { flex: 1, minWidth: 0, alignSelf: "center" },
    signature: { width: 48, height: 4, borderRadius: 2 },
    title: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 38,
      lineHeight: 44,
      letterSpacing: -1.4,
    },
    titleWide: { fontSize: 50, lineHeight: 56, letterSpacing: -1.8 },
    titleSmall: { fontSize: 32, lineHeight: 38, letterSpacing: -1 },
    titleAccent: { color: colors.deepBlue },
    rtlText: { textAlign: "right", writingDirection: "rtl" },
    description: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 16,
      lineHeight: 26,
    },
    actions: { gap: 10, paddingTop: 4 },
    action: {
      minHeight: 54,
      paddingHorizontal: 18,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      borderRadius: 14,
      borderWidth: 2,
    },
    actionText: {
      color: colors.ink,
      fontFamily: "Inter-SemiBold",
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      flexShrink: 1,
    },
    primaryText: { color: colors.background },
    subtleAction: {
      alignSelf: "flex-start",
      minHeight: 44,
      paddingHorizontal: 2,
      paddingVertical: 8,
      marginTop: -10,
    },
    subtleText: {
      color: colors.muted,
      fontFamily: "Inter-Medium",
      fontSize: 13,
    },
    videoColumn: { width: "100%", maxWidth: 340, alignSelf: "center", gap: 14 },
    videoWide: { width: 320, flexShrink: 0 },
    videoLabel: { flexDirection: "row", gap: 8, alignItems: "center" },
    eyebrow: {
      color: colors.muted,
      fontFamily: "Inter-Medium",
      fontSize: 12,
      lineHeight: 18,
      flexShrink: 1,
    },
    videoFrame: {
      width: "100%",
      aspectRatio: 9 / 16,
      borderRadius: 24,
      backgroundColor: "#000",
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    videoCaption: { gap: 10 },
    joinTitle: {
      color: colors.ink,
      fontFamily: "Inter-SemiBold",
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.5,
    },
    joinDescription: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 4,
    },
  });
