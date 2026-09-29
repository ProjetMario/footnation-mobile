import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  CalendarDays,
  Users,
  User,
  Newspaper,
  Trophy,
  QrCode,
  Radio,
  SquareUserRound,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useTheme } from "../theme";
const clubNavigationGroups = [
  {
    key: "infos",
    label: "Présentation",
    Icon: User,
    sections: [
      ["infos", "Présentation", User],
      ["qr", "QR code", QrCode],
    ],
  },
  {
    key: "publications",
    label: "Publications",
    Icon: Newspaper,
    sections: [["publications", "Publications", Newspaper]],
  },
  {
    key: "teams",
    label: "Équipes",
    Icon: Users,
    sections: [["teams", "Équipes", Users]],
  },
  {
    key: "matches",
    label: "Matchs",
    Icon: CalendarDays,
    sections: [
      ["matches", "Calendrier", CalendarDays],
      ["live", "En direct", Radio],
    ],
  },
  {
    key: "about",
    label: "À propos",
    Icon: SquareUserRound,
    sections: [
      ["about", "Le club", SquareUserRound],
      ["top", "Top joueurs", Users],
    ],
  },
] as const;

function clubNavigationGroup(active: string) {
  return (
    clubNavigationGroups.find((group) =>
      group.sections.some(([key]) => key === active),
    ) || clubNavigationGroups[0]
  );
}

export function ClubSectionNavigation({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (key: string) => void;
}) {
  const { colors } = useTheme();
  const group = clubNavigationGroup(active);
  if (group.sections.length < 2) return null;
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignSelf: "flex-start",
          borderRadius: 14,
          backgroundColor: colors.surfaceRaised,
          padding: 3,
          gap: 3,
        }}
      >
        {group.sections.map(([key, label, Icon]) => {
          const selected = active === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              aria-selected={selected}
              onPress={() => onSelect(key)}
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 12,
                gap: 7,
                borderRadius: 11,
                backgroundColor: selected ? colors.surface : "transparent",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon size={16} color={selected ? colors.blue : colors.muted} />
              <Text
                style={{
                  color: selected ? colors.blue : colors.muted,
                  fontFamily: selected ? "Inter-SemiBold" : "Inter-Regular",
                  fontSize: 12,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
export function ClubWebNavigation({
  id,
  name,
  active,
  onSelect,
  section = "tabs",
}: {
  section?: "stats" | "tabs";
  id: string;
  name: string;
  active: string;
  onSelect: (key: string) => void;
}) {
  const { colors } = useTheme();
  const stats = useQuery({
    queryKey: ["club-web-counts", id, name],
    queryFn: async () => {
      const results = await Promise.all([
        Promise.all(
          ["club_publications", "club_shorts", "club_news"].map((table) =>
            supabase
              .from(table)
              .select("id", { count: "exact", head: true })
              .eq("club_id", id)
              .eq("is_published", true),
          ),
        ).then((rows) => ({
          count: rows.reduce((total, row) => total + (row.count || 0), 0),
          error: rows.find((row) => row.error)?.error,
        })),
        supabase
          .from("club_followers")
          .select("id", { count: "exact", head: true })
          .eq("club_id", id),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .or(`linked_club_id.eq.${id},club.eq.${JSON.stringify(name)}`),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .or(
            `favorite_pro_club.eq.${JSON.stringify(name)},favorite_amateur_club.eq.${JSON.stringify(name)}`,
          ),
      ]);
      return results.map((result) => (result.error ? null : result.count));
    },
  });
  const tabsRef = React.useRef<ScrollView>(null);
  const activeGroup = clubNavigationGroup(active).key;
  const lastSelected = React.useRef<Record<string, string>>({});
  const positions = React.useRef<Record<string, { x: number; width: number }>>(
    {},
  );
  const viewport = React.useRef(0);
  React.useEffect(() => {
    lastSelected.current[activeGroup] = active;
    const position = positions.current[activeGroup];
    if (position)
      tabsRef.current?.scrollTo({
        x: Math.max(0, position.x - (viewport.current - position.width) / 2),
        animated: false,
      });
  }, [active, activeGroup]);
  if (section === "stats")
    return (
      <View
        style={{
          flexDirection: "row",
          paddingVertical: 18,
          backgroundColor: "rgba(255,255,255,0.035)",
          borderTopWidth: 1,
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        {(
          [
            ["Publications", "publications"],
            ["FootLovers", "followers"],
            ["Membres", "members"],
            ["Fans", "fans"],
          ] as const
        ).map(([label, key], index) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`Voir les ${label}`}
            onPress={() => onSelect(key)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              borderRightWidth: index < 3 ? 1 : 0,
              borderColor: "rgba(255,255,255,0.12)",
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontFamily: "Inter-Bold",
                fontSize: 22,
              }}
            >
              {stats.data?.[index] ?? "—"}
            </Text>
            <Text
              style={{
                color: "#BAC7D4",
                fontFamily: "Inter-Regular",
                fontSize: 10,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  return (
    <ScrollView
      ref={tabsRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(event) => {
        viewport.current = event.nativeEvent.layout.width;
      }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 8 }}
      style={{ backgroundColor: colors.surface }}
    >
      {clubNavigationGroups.map(({ key, label, Icon }) => (
        <Pressable
          key={key}
          onLayout={(event) => {
            positions.current[key] = event.nativeEvent.layout;
          }}
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected: activeGroup === key }}
          aria-selected={activeGroup === key}
          onPress={() => onSelect(lastSelected.current[key] || key)}
          style={({ pressed }) => ({
            flex: 1,
            minWidth: 64,
            minHeight: 62,
            paddingHorizontal: 4,
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            borderBottomWidth: 2,
            borderBottomColor:
              activeGroup === key ? colors.blue : "transparent",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon
            size={19}
            strokeWidth={activeGroup === key ? 2.1 : 1.6}
            color={activeGroup === key ? colors.blue : colors.muted}
          />
          <Text
            style={{
              fontSize: 11,
              fontFamily:
                activeGroup === key ? "Inter-SemiBold" : "Inter-Regular",
              color: activeGroup === key ? colors.blue : colors.muted,
            }}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
