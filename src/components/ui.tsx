import React from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  AlertCircle,
  WifiOff,
} from "lucide-react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { useConnectivity } from "./ConnectivityProvider";
import { BrandWordmark, useBrandMotion } from "./BrandWordmark";

const createUIStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: 20,
      gap: 18,
      paddingBottom: 40,
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    between: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    title: {
      fontFamily: "Inter-Bold",
      fontSize: 28,
      fontWeight: "800",
      color: colors.navy,
      letterSpacing: -0.8,
    },
    subtitle: {
      fontFamily: "Inter-Regular",
      fontSize: 15,
      lineHeight: 23,
      color: colors.muted,
    },
    h2: {
      fontFamily: "Inter-Bold",
      fontSize: 19,
      fontWeight: "700",
      color: colors.navy,
      letterSpacing: -0.3,
    },
    text: {
      fontFamily: "Inter-Regular",
      fontSize: 15,
      lineHeight: 23,
      color: colors.ink,
    },
    small: {
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    button: {
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      minHeight: 48,
      overflow: "hidden",
    },
    input: {
      fontFamily: "Inter-Regular",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.navy,
      minHeight: 50,
    },
    label: {
      fontFamily: "Inter-SemiBold",
      fontSize: 13,
      fontWeight: "600",
      color: colors.ink,
      marginBottom: 7,
    },
  });
export const s = createUIStyles(colors);
export function useUIStyles() {
  return useThemedStyles(createUIStyles);
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      aria-disabled={disabled || busy}
      aria-busy={busy}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: secondary ? colors.surfaceRaised : "#0064D8",
          borderWidth: secondary ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled || busy ? 0.55 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.ink : colors.white} />
      ) : (
        <Text
          style={{
            fontFamily: "Inter-Bold",
            color: secondary ? colors.ink : colors.white,
            fontWeight: "700",
            fontSize: 15,
            flexShrink: 1,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.surfaceRaised : "transparent",
      })}
    >
      {children}
    </Pressable>
  );
}
export function Avatar({
  uri,
  name = "",
  size = 46,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
}) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  return uri ? (
    <Image
      source={{ uri }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accentSoft,
      }}
      contentFit="cover"
      accessibilityLabel={name}
    />
  ) : (
    <Image
      source={require("../../assets/brand/app-icon.png")}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.accentSoft,
      }}
      contentFit="cover"
      accessibilityLabel={name || "Logo FootNation"}
    />
  );
}
export function Brand({ showLogo = true }: { showLogo?: boolean } = {}) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  const motion = useBrandMotion();
  return (
    <View style={[s.row, { gap: 6, flexShrink: 1 }]}>
      {showLogo && (
        <Animated.View
          style={{
            transform: [
              {
                translateY: motion.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -1.5],
                }),
              },
              {
                rotate: motion.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["-2deg", "2deg"],
                }),
              },
            ],
          }}
        >
          <Image
            source={require("../../assets/brand/app-icon.png")}
            contentFit="contain"
            accessibilityLabel="Logo FootNation avec le drapeau de la Bosnie"
            style={{ width: 30, height: 30, flexShrink: 0 }}
          />
        </Animated.View>
      )}
      <BrandWordmark motion={motion} />
    </View>
  );
}
export function Header({
  title,
  titleNode,
  back = false,
  right,
}: {
  title?: string;
  titleNode?: React.ReactNode;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  return (
    <View
      style={[
        s.between,
        {
          minHeight: 64,
          paddingVertical: 8,
          paddingHorizontal: 16,
          gap: 4,
          flexWrap: "wrap",
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[s.row, { flex: 1, minWidth: 120 }]}>
        {!!back && (
          <IconButton
            label="Retour"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
          >
            <ArrowLeft size={20} color={colors.navy} />
          </IconButton>
        )}
        {titleNode ? (
          titleNode
        ) : title ? (
          <Text accessibilityRole="header" style={[s.h2, { flexShrink: 1 }]}>
            {title}
          </Text>
        ) : (
          <Brand />
        )}
      </View>
      {right}
    </View>
  );
}
export function Screen({
  title,
  titleNode,
  children,
  header = true,
  back = true,
  right,
  scroll = true,
  scrollRef,
}: {
  title: string;
  titleNode?: React.ReactNode;
  children: React.ReactNode;
  header?: boolean;
  back?: boolean;
  right?: React.ReactNode;
  scroll?: boolean;
  scrollRef?: React.Ref<ScrollView>;
}) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.screen}>
      {header && (
        <Header title={title} titleNode={titleNode} back={back} right={right} />
      )}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          automaticallyAdjustKeyboardInsets
          indicatorStyle={mode === "dark" ? "white" : "black"}
          style={{ flex: 1 }}
          contentContainerStyle={s.content}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
export function Field({
  label,
  inputRef,
  ...props
}: TextInputProps & { label: string; inputRef?: React.Ref<TextInput> }) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        selectionColor={colors.blue}
        keyboardAppearance={mode}
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 120, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function SearchField({
  value,
  onChangeText,
  placeholder = "Rechercher",
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  return (
    <View style={[s.row, s.input, { paddingVertical: 0 }]}>
      <Search size={19} color={colors.muted} style={{ flexShrink: 0 }} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        selectionColor={colors.blue}
        keyboardAppearance={mode}
        value={value}
        onChangeText={onChangeText}
        style={{
          fontFamily: "Inter-Regular",
          flex: 1,
          minWidth: 0,
          minHeight: 48,
          fontSize: 15,
          color: colors.ink,
        }}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
    </View>
  );
}
export function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ selected, disabled }}
      aria-disabled={disabled}
      {...(Platform.OS === "web" && onPress
        ? { "aria-pressed": selected }
        : {})}
      style={{
        opacity: disabled ? 0.5 : 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 44,
        minWidth: 44,
        maxWidth: "100%",
        justifyContent: "center",
        borderRadius: 16,
        backgroundColor: selected ? colors.accentSoft : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.blue : colors.border,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter-SemiBold",
          fontSize: 13,
          fontWeight: "600",
          color: selected ? colors.deepBlue : colors.ink,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  return (
    <View style={[s.card, { paddingVertical: 32, alignItems: "center" }]}>
      <Text accessibilityRole="header" style={[s.h2, { textAlign: "center" }]}>
        {title}
      </Text>
      {!!description && (
        <Text style={[s.subtitle, { textAlign: "center" }]}>{description}</Text>
      )}
      {action}
    </View>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[s.card, { borderColor: "#E6B5BD" }]}
    >
      <AlertCircle color={colors.danger} size={23} />
      <Text style={s.h2}>Chargement impossible</Text>
      <Text style={s.subtitle}>
        {error instanceof Error ? error.message : "Veuillez réessayer."}
      </Text>
      {!!retry && <Button title="Réessayer" onPress={retry} secondary />}
    </View>
  );
}
export function Loading() {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  const { isOffline } = useConnectivity();
  if (isOffline) {
    return (
      <View accessibilityLiveRegion="polite" style={s.card}>
        <WifiOff size={24} color={colors.muted} />
        <Text accessibilityRole="header" style={s.h2}>
          Connexion indisponible
        </Text>
        <Text style={s.subtitle}>
          Les contenus déjà chargés restent consultables. Réessayez après
          reconnexion.
        </Text>
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement en cours"
      accessibilityState={{ busy: true }}
      style={{ padding: 40 }}
    >
      <ActivityIndicator size="large" color={colors.blue} />
    </View>
  );
}
export function Banner({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  return (
    <LinearGradient
      colors={[colors.surfaceRaised, colors.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 16,
        padding: 24,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter-Bold",
          color: colors.deepBlue,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 2,
        }}
      >
        {eyebrow}
      </Text>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: "Inter-Bold",
          color: colors.ink,
          fontSize: 29,
          lineHeight: 35,
          fontWeight: "800",
          letterSpacing: -0.7,
        }}
      >
        {title}
      </Text>
      {!!description && (
        <Text
          style={{
            fontFamily: "Inter-Regular",
            color: colors.muted,
            fontSize: 14,
            lineHeight: 22,
          }}
        >
          {description}
        </Text>
      )}
      {children}
    </LinearGradient>
  );
}
export function MenuRow({
  title,
  subtitle,
  onPress,
  icon,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  const { colors, mode } = useTheme();
  const s = useUIStyles();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[s.between, { paddingVertical: 13, minHeight: 48 }]}
    >
      <View style={[s.row, { flex: 1 }]}>
        {icon}
        <View style={{ flex: 1 }}>
          <Text style={[s.text, { fontWeight: "600" }]}>{title}</Text>
          {!!subtitle && <Text style={s.small}>{subtitle}</Text>}
        </View>
      </View>
      <ArrowRight color={colors.muted} size={18} />
    </Pressable>
  );
}
