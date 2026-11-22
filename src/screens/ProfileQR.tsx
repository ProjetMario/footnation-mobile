import React, { useState } from "react";
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ArrowUpRight, Share2 } from "lucide-react-native";
import { PersonalizedQR } from "../components/PersonalizedQR";
import { profileQrUrl } from "../lib/profileQr";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../lib/auth";
import { useProfile } from "../lib/data";
import { displayName } from "../lib/models";
import { AuthGate } from "../components/AuthGate";
import { ErrorState, Loading, Screen, useUIStyles } from "../components/ui";
import { useTheme } from "../theme";

export default function ProfileQR() {
  return (
    <Screen title="QR code">
      <AuthGate>
        <Card />
      </AuthGate>
    </Screen>
  );
}
function Card() {
  const s = useUIStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const qrSize = Math.min(260, Math.max(120, width - 96));
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const profileId = id || session!.user.id;
  const profile = useProfile(profileId);
  const [error, setError] = useState<unknown>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const url = profileQrUrl({ id: profileId });
  if (profile.isPending) return <Loading />;
  if (profile.error) return <ErrorState error={profile.error} />;
  if (!profile.data) return <Text style={s.text}>Profil indisponible.</Text>;
  return (
    <View style={styles.content}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.name, { color: colors.ink }]}>
          {displayName(profile.data)}
        </Text>
        <PersonalizedQR profile={profile.data} size={qrSize} />
        <Text style={[styles.hint, { color: colors.muted }]}>
          Scannez pour voir le profil
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Partager le profil"
        onPress={() => {
          setError(null);
          void Share.share({
            title: "Profil FootNation",
            message: `${displayName(profile.data)} sur FootNation\n${url}`,
          }).catch(setError);
        }}
        onFocus={() => setFocused("share")}
        onBlur={() => setFocused(null)}
        onHoverIn={() => setHovered("share")}
        onHoverOut={() => setHovered(null)}
        style={({ pressed }) => [
          styles.share,
          {
            backgroundColor: colors.deepBlue,
            borderColor: focused === "share" ? colors.ink : "transparent",
            opacity: pressed ? 0.75 : hovered === "share" ? 0.9 : 1,
          },
        ]}
      >
        <Share2 size={18} color={colors.background} />
        <Text style={[styles.shareText, { color: colors.background }]}>
          Partager
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voir le profil"
        onPress={() => router.push(`/profile/${profileId}`)}
        onFocus={() => setFocused("profile")}
        onBlur={() => setFocused(null)}
        onHoverIn={() => setHovered("profile")}
        onHoverOut={() => setHovered(null)}
        style={({ pressed }) => [
          styles.link,
          {
            borderColor: focused === "profile" ? colors.blue : "transparent",
            backgroundColor:
              hovered === "profile" ? colors.accentSoft : "transparent",
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[styles.hint, { color: colors.muted }]}>
          Voir le profil
        </Text>
        <ArrowUpRight size={16} color={colors.muted} />
      </Pressable>
      {!!error && <ErrorState error={error} />}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { width: "100%", maxWidth: 360, alignSelf: "center", gap: 12 },
  card: {
    alignItems: "center",
    gap: 14,
    padding: 22,
    borderWidth: 1,
    borderRadius: 24,
  },
  name: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  hint: { fontSize: 13, lineHeight: 20, textAlign: "center" },
  share: {
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
  },
  shareText: { fontSize: 14, fontWeight: "700" },
  link: {
    minHeight: 44,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
});
