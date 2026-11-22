import React, { useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Compass,
  FileText,
  Send,
  Target,
} from "lucide-react-native";
import { AuthGate } from "../src/components/AuthGate";
import { Screen } from "../src/components/ui";
import { useTheme } from "../src/theme";

const items = [
  {
    title: "Explorer",
    description: "Trouvez votre prochaine aventure football.",
    path: "/opportunities",
    Icon: Compass,
    color: "#0960DC",
    darkColor: "#83B5FF",
    tint: "#F0F6FF",
    darkTint: "#10243B",
  },
  {
    title: "Demandes publiées",
    description:
      "Retrouvez vos annonces, créées depuis votre projet carrière ou directement.",
    path: "/my-requests",
    Icon: FileText,
    color: "#7338CE",
    darkColor: "#BEA0FF",
    tint: "#F6F2FF",
    darkTint: "#211D38",
  },
  {
    title: "Offres",
    description: "Proposez une place, une mission ou un projet.",
    path: "/my-offers",
    Icon: Briefcase,
    color: "#08765F",
    darkColor: "#65D6B9",
    tint: "#EEF9F5",
    darkTint: "#102C2B",
  },
  {
    title: "Candidatures",
    description: "Suivez vos candidatures et leurs réponses.",
    path: "/my-applications",
    Icon: Send,
    color: "#B82560",
    darkColor: "#FFA0C1",
    tint: "#FFF2F6",
    darkTint: "#321D30",
  },
];

export default function MyOpportunities() {
  const { colors, mode } = useTheme();
  const [gridWidth, setGridWidth] = useState(0);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const careerPath = "/career-preferences";
  const careerFocused = focusedPath === careerPath;
  return (
    <Screen title="Mes opportunités">
      <AuthGate>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mon projet carrière : préparer ma recherche"
          accessibilityHint="Définir mes objectifs et préparer une demande à publier."
          onPress={() => router.push(careerPath)}
          onHoverIn={() => setHoveredPath(careerPath)}
          onHoverOut={() => setHoveredPath(null)}
          onFocus={() => setFocusedPath(careerPath)}
          onBlur={() => setFocusedPath(null)}
          style={({ pressed }) => [
            s.career,
            {
              borderColor: careerFocused ? colors.ink : "transparent",
              opacity: pressed ? 0.8 : hoveredPath === careerPath ? 0.9 : 1,
            },
          ]}
        >
          <LinearGradient
            colors={["#075BD9", "#6732CF", "#AF246D"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.hero}
          >
            <Target size={26} color="#FFF" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.heroTitle}>Mon projet carrière</Text>
              <Text style={s.heroDescription}>Préparer ma recherche</Text>
            </View>
            <ArrowRight size={20} color="#FFF" />
          </LinearGradient>
        </Pressable>
        <View
          style={s.grid}
          onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
        >
          {items.map((item) => {
            const { title, description, path, Icon } = item;
            const accent = mode === "dark" ? item.darkColor : item.color;
            const active = hoveredPath === path || focusedPath === path;
            return (
              <Pressable
                key={path}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityHint={description}
                onPress={() => router.push(path)}
                onHoverIn={() => setHoveredPath(path)}
                onHoverOut={() => setHoveredPath(null)}
                onFocus={() => setFocusedPath(path)}
                onBlur={() => setFocusedPath(null)}
                style={({ pressed }) => [
                  s.card,
                  {
                    width: gridWidth >= 400 ? (gridWidth - 12) / 2 : "100%",
                    backgroundColor:
                      mode === "dark" ? item.darkTint : item.tint,
                    borderColor: active ? accent : colors.border,
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <View style={[s.icon, { backgroundColor: colors.surface }]}>
                  <Icon size={22} color={accent} />
                </View>
                <Text style={[s.cardTitle, { color: colors.ink }]}>
                  {title}
                </Text>
                <ArrowUpRight size={18} color={accent} />
              </Pressable>
            );
          })}
        </View>
      </AuthGate>
    </Screen>
  );
}
const s = StyleSheet.create({
  career: { borderRadius: 22, borderWidth: 2, overflow: "hidden" },
  hero: { padding: 20, gap: 14, flexDirection: "row", alignItems: "center" },
  heroTitle: { fontSize: 19, fontWeight: "800", color: "#FFF" },
  heroDescription: { color: "#F4F0FF", fontSize: 13, lineHeight: 19 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 88,
    padding: 16,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  icon: { padding: 10, borderRadius: 13 },
  cardTitle: { fontSize: 16, fontWeight: "700", flex: 1 },
});
