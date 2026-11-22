import React from "react";
import { Link } from "expo-router";
import { ChevronRight, Plus, UsersRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SUPPORTERS_ENABLED } from "../lib/supportersConfig";
import { useTheme } from "../theme";

export function ClubSupportersEntry({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const { colors } = useTheme();
  if (!SUPPORTERS_ENABLED) return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.heading}>
        <UsersRound size={22} color={colors.blue} />
        <View style={styles.copy}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.ink }]}
          >
            Supporters
          </Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Retrouve les supporters de {name} près de chez toi.
          </Text>
        </View>
      </View>
      <Link href={{ pathname: "/supporters", params: { clubId: id } }} asChild>
        <Pressable
          accessibilityLabel={`Découvrir les communautés de supporters de ${name}`}
          style={({ pressed }) => [
            styles.link,
            { backgroundColor: colors.accentSoft, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.linkLabel, { color: colors.blue }]}>
            Découvrir les communautés
          </Text>
          <ChevronRight size={19} color={colors.blue} />
        </Pressable>
      </Link>
      <Link
        href={{ pathname: "/supporters/new", params: { clubId: id } }}
        asChild
      >
        <Pressable
          accessibilityLabel={`Créer une communauté de supporters de ${name}`}
          style={({ pressed }) => [styles.link, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Plus size={17} color={colors.muted} />
          <Text style={[styles.linkLabel, { color: colors.muted }]}>
            Créer une communauté
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 8 },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 4,
  },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: "Inter-SemiBold", fontSize: 16 },
  description: { fontFamily: "Inter-Regular", fontSize: 13, lineHeight: 20 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  linkLabel: {
    flex: 1,
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    lineHeight: 20,
  },
});
