import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WifiOff } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { useConnectivity } from "./ConnectivityProvider";

// Render after the navigator in a flex:1 parent. It takes its own space and
// cannot cover a header, an action or the tab bar.
export function OfflineBanner() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const { isOffline, checking, retry } = useConnectivity();
  if (!isOffline) return null;
  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={styles.container}>
      <View style={styles.content}>
        <WifiOff color={colors.muted} size={20} accessibilityElementsHidden />
        <View style={styles.copy}>
          <Text accessibilityLiveRegion="polite" style={styles.title}>
            Vous êtes hors ligne
          </Text>
          <Text style={styles.description}>
            Les contenus déjà chargés restent disponibles.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Réessayer la connexion"
          accessibilityState={{ disabled: checking, busy: checking }}
          disabled={checking}
          onPress={() => void retry()}
          style={({ pressed }) => [
            styles.retry,
            { opacity: checking ? 0.6 : pressed ? 0.7 : 1 },
          ]}
        >
          {checking ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <Text style={styles.retryLabel}>Réessayer</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surfaceRaised,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    content: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    copy: { flex: 1, gap: 2 },
    title: {
      color: colors.ink,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
    },
    description: { color: colors.muted, fontSize: 11, lineHeight: 16 },
    retry: {
      minWidth: 76,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 12,
      paddingHorizontal: 9,
      backgroundColor: colors.accentSoft,
    },
    retryLabel: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  });
