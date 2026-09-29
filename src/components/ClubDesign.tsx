import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { RefreshCw, Shield, X } from "lucide-react-native";
import { ThemePaletteProvider, useTheme } from "../theme";
import { clubThemePalette, resolveClubBrand } from "../lib/clubBrand";
import { Button as BaseButton, useUIStyles as useBaseUIStyles } from "./ui";

const ClubDesignContext = createContext<ReturnType<
  typeof resolveClubBrand
> | null>(null);
export function ClubDesignProvider({
  club,
  children,
}: {
  club: Record<string, any>;
  children: React.ReactNode;
}) {
  const { colors, mode } = useTheme();
  const brand = useMemo(
    () => resolveClubBrand(club, mode === "dark"),
    [club, mode],
  );
  const palette = useMemo(
    () => clubThemePalette(colors, brand),
    [colors, brand],
  );
  return (
    <ClubDesignContext.Provider value={brand}>
      <ThemePaletteProvider colors={palette}>{children}</ThemePaletteProvider>
    </ClubDesignContext.Provider>
  );
}
export function useClubBrand() {
  const brand = useContext(ClubDesignContext);
  const { mode } = useTheme();
  return brand || resolveClubBrand({}, mode === "dark");
}
export function useClubUIStyles() {
  const base = useBaseUIStyles();
  const active = useContext(ClubDesignContext);
  return useMemo(
    () =>
      active
        ? {
            ...base,
            card: { ...base.card, borderRadius: 20, padding: 20, gap: 16 },
          }
        : base,
    [base, active],
  );
}
export function useClubReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

export function ClubButton(props: React.ComponentProps<typeof BaseButton>) {
  const brand = useContext(ClubDesignContext);
  const { colors } = useTheme();
  if (!brand) return <BaseButton {...props} />;
  const { title, secondary, disabled, busy, onPress, accessibilityLabel } =
    props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 18,
        paddingVertical: 13,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: secondary ? colors.border : brand.accent,
        backgroundColor: secondary ? colors.surfaceRaised : brand.accent,
        opacity: disabled || busy ? 0.5 : pressed ? 0.78 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.ink : "#FFFFFF"} />
      ) : (
        <Text
          style={{
            color: secondary ? colors.ink : "#FFFFFF",
            fontFamily: "Inter-SemiBold",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function ClubLogo({
  uri,
  name,
  size = 64,
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View
      style={{
        width: size,
        height: size,
        padding: size * 0.1,
        borderRadius: size * 0.24,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          accessibilityLabel={`Logo ${name}`}
          onError={() => setFailed(true)}
        />
      ) : (
        <Shield size={size * 0.5} color="#43556A" accessibilityLabel={name} />
      )}
    </View>
  );
}

export function ClubSectionHeading({
  title,
  refresh,
  busy,
}: {
  title: string;
  refresh?: () => void;
  busy?: boolean;
}) {
  const s = useClubUIStyles();
  const { colors } = useTheme();
  return (
    <View style={s.between}>
      <Text accessibilityRole="header" style={[s.h2, { flex: 1 }]}>
        {title}
      </Text>
      {!!refresh && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Actualiser : ${title}`}
          accessibilityState={{ busy: !!busy, disabled: !!busy }}
          disabled={busy}
          onPress={refresh}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color={colors.blue} />
          ) : (
            <RefreshCw size={18} color={colors.muted} />
          )}
        </Pressable>
      )}
    </View>
  );
}

export function ClubSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const reduced = useClubReducedMotion();
  const mobile = width < 600;
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? "none" : "fade"}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: mobile ? "flex-end" : "center",
          padding: mobile ? 8 : 24,
          backgroundColor: "rgba(4,12,22,0.6)",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer la fenêtre"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          role="dialog"
          aria-label={title}
          style={{
            maxHeight: "88%",
            width: "100%",
            maxWidth: 520,
            alignSelf: "center",
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 20,
            gap: 18,
          }}
        >
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text
                accessibilityRole="header"
                style={{
                  color: colors.ink,
                  fontFamily: "Inter-Bold",
                  fontSize: 22,
                }}
              >
                {title}
              </Text>
              {!!subtitle && (
                <Text
                  style={{
                    fontFamily: "Inter-Regular",
                    color: colors.muted,
                    fontSize: 13,
                    lineHeight: 19,
                  }}
                >
                  {subtitle}
                </Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Fermer : ${title}`}
              onPress={onClose}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surfaceRaised,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <X size={21} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={{ gap: 14, paddingBottom: 8 }}
          >
            {children}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
