import React from "react";
import { Link, type Href } from "expo-router";
import { ChevronRight, UsersRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import type { FavoriteClubSupportersSuggestion } from "../lib/favoriteClubSupporters";
import { supporterDiscoveryPath } from "../lib/supporterClubLinks";
import { SUPPORTERS_ENABLED } from "../lib/supportersConfig";
import { useTheme } from "../theme";

export function FavoriteClubSupportersPrompt({
  suggestion,
  onNavigate,
}: {
  suggestion: FavoriteClubSupportersSuggestion;
  onNavigate?: () => void;
}) {
  const { colors } = useTheme();
  const { session } = useAuth();
  if (!SUPPORTERS_ENABLED || session?.user.id !== suggestion.ownerId)
    return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.heading}>
        <UsersRound size={22} color={colors.blue} />
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.ink }]}
        >
          Retrouve ses supporters près de chez toi
        </Text>
      </View>
      {suggestion.clubs.map((club) => (
        <Link
          key={club}
          href={supporterDiscoveryPath({ club, city: suggestion.city }) as Href}
          asChild
        >
          <Pressable
            accessibilityLabel={`Découvrir les communautés de supporters de ${club}`}
            onPress={onNavigate}
            style={({ pressed }) => [
              styles.link,
              {
                backgroundColor: colors.accentSoft,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={styles.copy}>
              <Text style={[styles.club, { color: colors.ink }]}>{club}</Text>
              <Text style={[styles.label, { color: colors.blue }]}>
                Découvrir les communautés
              </Text>
            </View>
            <ChevronRight size={20} color={colors.blue} />
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: {
    flex: 1,
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
    lineHeight: 23,
  },
  link: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  club: { fontFamily: "Inter-SemiBold", fontSize: 14, lineHeight: 20 },
  label: { fontFamily: "Inter-Medium", fontSize: 13, lineHeight: 20 },
});
