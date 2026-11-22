import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Briefcase,
  CalendarDays,
  ChevronRight,
  Club,
  FilePenLine,
  Radio,
} from "lucide-react-native";
import { Screen } from "../../src/components/ui";
import { useTheme } from "../../src/theme";

const options = [
  {
    title: "Publier",
    hint: "Texte, photo, vidéo, story ou réel / short",
    icon: FilePenLine,
    color: "#2563EB",
    darkColor: "#83B5FF",
    path: "/compose",
  },
  {
    title: "Opportunité",
    hint: "Explorer les offres et les demandes",
    icon: Briefcase,
    color: "#08765F",
    darkColor: "#65D6B9",
    path: "/opportunities",
  },
  {
    title: "Événement",
    hint: "Créer un tournoi, un match ou un rassemblement",
    icon: CalendarDays,
    color: "#4F46E5",
    darkColor: "#AAA5FF",
    path: "/events/new",
  },
  {
    title: "Live",
    hint: "Préparer une diffusion en direct",
    icon: Radio,
    color: "#B82560",
    darkColor: "#FFA0C1",
    path: "/live/create?mode=simple",
  },
  {
    title: "Club",
    hint: "Ajouter ou gérer un club",
    icon: Club,
    color: "#A031B4",
    darkColor: "#E8A2EE",
    path: "/club-claim",
  },
];

export default function ComposeChooser() {
  const { colors, mode } = useTheme();
  const [focused, setFocused] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <Screen title="Créer">
      <View style={styles.options}>
        {options.map(({ title, hint, icon: Icon, color, darkColor, path }) => {
          const accent = mode === "dark" ? darkColor : color;
          return (
            <Pressable
              key={path}
              accessibilityRole="button"
              accessibilityLabel={title}
              accessibilityHint={hint}
              onPress={() => router.push(path)}
              onFocus={() => setFocused(path)}
              onBlur={() => setFocused(null)}
              onHoverIn={() => setHovered(path)}
              onHoverOut={() => setHovered(null)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor:
                    pressed || hovered === path
                      ? colors.surfaceRaised
                      : colors.surface,
                  borderColor: focused === path ? colors.blue : colors.border,
                },
              ]}
            >
              <View style={[styles.icon, { backgroundColor: `${accent}14` }]}>
                <Icon size={21} color={accent} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
                {path === "/compose" && <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{hint}</Text>}
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 8 },
  option: {
    minHeight: 64,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
});
