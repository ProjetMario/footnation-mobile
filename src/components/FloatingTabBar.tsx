import React, { useEffect, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { SquarePlay, Plus, Search, CircleUserRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { useScrollChrome } from "./scrollChrome";
import { useAuth } from "../lib/auth";
import { useTranslation } from "../lib/i18n";
import { SpinningBall } from "./SpinningBall";

export const floatingBarHeight = 60;
export const floatingBarInset = (bottom: number) => Math.max(bottom, 14);
export const floatingBarSpace = (bottom: number) =>
  floatingBarHeight + floatingBarInset(bottom) + 12;

const destinations = [
  { name: "index", label: "nav.home", shortLabel: "nav.home", Icon: null },
  {
    name: "shorts",
    label: "nav.shorts",
    shortLabel: "nav.shorts",
    Icon: SquarePlay,
  },
  {
    name: "compose",
    label: "nav.createPost",
    shortLabel: "nav.create",
    Icon: Plus,
  },
  {
    name: "search",
    label: "common.search",
    shortLabel: "nav.search",
    Icon: Search,
  },
  {
    name: "my-profile",
    label: "nav.myProfile",
    shortLabel: "nav.profile",
    Icon: CircleUserRound,
  },
] as const;

function ProfileTabIcon({
  uri,
  focused,
}: {
  uri?: string | null;
  focused: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [failed, setFailed] = useState(false);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {uri && !failed ? (
        <View
          style={[
            styles.avatarRing,
            { borderColor: focused ? colors.blue : colors.border },
          ]}
        >
          <Image
            source={{ uri }}
            style={styles.avatar}
            contentFit="cover"
            onError={() => setFailed(true)}
          />
        </View>
      ) : (
        <CircleUserRound
          size={27}
          color={focused ? colors.blue : colors.muted}
          strokeWidth={focused ? 2.3 : 1.85}
        />
      )}
    </View>
  );
}

export function useKeyboardVisible() {
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return keyboardVisible;
}

export function FloatingTabBar({
  state,
  navigation,
  keyboardVisible,
}: BottomTabBarProps & {
  keyboardVisible: boolean;
  blurTarget: React.RefObject<View | null>;
}) {
  const t = useTranslation();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const { session, profile } = useAuth();
  const { compact } = useScrollChrome();
  const showLabels = !compact && width >= 360 && fontScale <= 1.1;
  const profilePhoto =
    session && profile?.id === session.user.id
      ? profile.avatar_url?.trim()
      : undefined;
  if (keyboardVisible) return null;
  const current = state.routes[state.index].name;
  if (!session && current === "index") return null;
  const selected =
    current === "more"
      ? "my-profile"
      : ["network", "opportunities", "clubs"].includes(current)
        ? "search"
        : current;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.position, { bottom: floatingBarInset(insets.bottom) }]}
    >
      <View
        style={[
          styles.shadow,
          {
            width: Math.min(width - (compact ? 112 : 24), compact ? 360 : 480),
          },
        ]}
      >
        <View style={[styles.pill, compact && styles.pillCompact]}>
          <View style={styles.items} accessibilityRole="tablist">
            {destinations.map(({ name, label, shortLabel, Icon }) => {
              if (name === "compose") {
                return (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityLabel={t(label)}
                    accessibilityHint={t("nav.createHint")}
                    onPress={() => router.navigate("/compose")}
                    style={({ pressed }) => [
                      styles.item,
                      compact && styles.itemCompact,
                      {
                        opacity: pressed ? 0.78 : 1,
                        transform: [{ scale: pressed ? 0.94 : 1 }],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={["#0967FF", "#7A2CFF", "#FF174D"]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={[
                        styles.createButton,
                        compact && styles.createButtonCompact,
                      ]}
                      pointerEvents="none"
                    >
                      <Plus
                        size={compact ? 29 : 34}
                        color={colors.white}
                        strokeWidth={2.5}
                      />
                    </LinearGradient>
                  </Pressable>
                );
              }
              const route = state.routes.find((item) => item.name === name);
              if (!route) return null;
              const focused = selected === name;
              return (
                <Pressable
                  key={name}
                  accessibilityRole="tab"
                  accessibilityLabel={t(label)}
                  accessibilityState={{ selected: focused }}
                  aria-selected={focused}
                  onPress={() => {
                    const event = navigation.emit({
                      type: "tabPress",
                      target: route.key,
                      canPreventDefault: true,
                    });
                    if (current !== name && !event.defaultPrevented)
                      navigation.navigate(route.name, route.params);
                  }}
                  onLongPress={() =>
                    navigation.emit({ type: "tabLongPress", target: route.key })
                  }
                  style={({ pressed }) => [
                    styles.item,
                    compact && styles.itemCompact,
                    {
                      backgroundColor: focused
                        ? colors.accentSoft
                        : pressed
                          ? colors.surfaceRaised
                          : "transparent",
                    },
                  ]}
                >
                  {name === "my-profile" ? (
                    <ProfileTabIcon
                      key={`${session?.user.id || "guest"}:${profilePhoto || "none"}`}
                      uri={profilePhoto}
                      focused={focused}
                    />
                  ) : Icon ? (
                    <Icon
                      size={compact ? 25 : 27}
                      color={focused ? colors.blue : colors.muted}
                      strokeWidth={focused ? 2.3 : 1.85}
                      fill="none"
                    />
                  ) : (
                    <SpinningBall size={34} />
                  )}
                  {!!showLabels && (
                    <Text
                      accessible={false}
                      aria-hidden
                      numberOfLines={1}
                      style={[
                        styles.label,
                        { color: focused ? colors.deepBlue : colors.muted },
                      ]}
                    >
                      {t(shortLabel)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    position: { position: "absolute", left: 0, right: 0, alignItems: "center" },
    shadow: {
      borderRadius: 24,
      shadowColor: "#000000",
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    pill: {
      height: floatingBarHeight,
      borderRadius: 24,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pillCompact: {
      height: 48,
      borderRadius: 24,
      backgroundColor: `${colors.surface}F2`,
    },
    items: { flex: 1, flexDirection: "row", padding: 4, gap: 2 },
    createButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    createButtonCompact: {
      width: 40,
      height: 40,
      borderRadius: 15,
    },
    avatarRing: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      padding: 2,
    },
    avatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surfaceRaised,
    },
    item: {
      flex: 1,
      minWidth: 44,
      minHeight: 48,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    itemCompact: {
      minHeight: 40,
      borderRadius: 16,
    },
    label: {
      fontFamily: "Inter-SemiBold",
      fontSize: 10,
      lineHeight: 12,
      fontWeight: "600",
    },
  });
