import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import {
  ArrowUpRight,
  GraduationCap,
  Shield,
  SlidersHorizontal,
  Trophy,
  Users,
} from "lucide-react-native";
import { useTheme } from "../theme";
import { ClubLogo, ClubButton, useClubBrand } from "./ClubDesign";
import { Chip, SearchField } from "./ui";
import {
  filterClubTeams,
  sortClubTeams,
  type ClubTeam,
  type ClubTeamFilters,
  type PresentedClubTeam,
} from "../lib/clubTeams";

const initialFilters: ClubTeamFilters = {
  section: "all",
  gender: "all",
  category: "all",
  search: "",
};
const sections = [
  {
    key: "seniors",
    title: "Séniors",
    description: "Les équipes séniors du club",
    Icon: Shield,
  },
  {
    key: "academy",
    title: "Académie",
    description: "La relève, catégorie par catégorie",
    Icon: GraduationCap,
  },
  {
    key: "other",
    title: "Autres équipes",
    description: "Toutes les pratiques du club",
    Icon: Users,
  },
] as const;
const genderNames = {
  men: "Masculins",
  women: "Féminines",
  mixed: "Mixte",
  unknown: "",
};

function TeamCard({
  item,
  logoUrl,
  width,
}: {
  item: PresentedClubTeam;
  logoUrl?: string | null;
  width: number | `${number}%`;
}) {
  const { colors } = useTheme();
  const brand = useClubBrand();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir l’équipe ${item.team.name}, ${item.team.category || item.category}`}
      onPress={() =>
        router.push(`/fff-team/${encodeURIComponent(item.team.id)}`)
      }
      style={({ pressed }) => ({
        width,
        minWidth: 0,
        padding: 18,
        gap: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        overflow: "hidden",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          position: "absolute",
          top: 18,
          bottom: 18,
          left: 0,
          width: 3,
          borderRadius: 3,
          backgroundColor: brand.accent,
        }}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <ClubLogo uri={logoUrl} name={item.team.name} size={48} />
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text
            style={{
              fontFamily: "Inter-Bold",
              fontSize: 17,
              color: colors.ink,
            }}
          >
            {item.title}
          </Text>
          {!!genderNames[item.gender] && (
            <Text
              style={{
                color: colors.muted,
                fontFamily: "Inter-Regular",
                fontSize: 12,
              }}
            >
              {genderNames[item.gender]}
            </Text>
          )}
        </View>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accentSoft,
          }}
        >
          <ArrowUpRight size={17} color={colors.blue} />
        </View>
      </View>
      <View
        style={{
          borderTopWidth: 1,
          borderColor: colors.border,
          paddingTop: 12,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <Trophy size={14} color={colors.muted} style={{ marginTop: 2 }} />
        <Text
          style={{
            flex: 1,
            color: colors.muted,
            fontFamily: "Inter-Regular",
            fontSize: 12,
            lineHeight: 18,
          }}
        >
          {item.team.competition?.name || "Compétition non renseignée"}
        </Text>
      </View>
    </Pressable>
  );
}

export function ClubTeams({
  teams,
  logoUrl,
}: {
  teams: ClubTeam[];
  logoUrl?: string | null;
}) {
  const { colors } = useTheme();
  const [filters, setFilters] = useState<ClubTeamFilters>(initialFilters);
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(0);
  const sorted = useMemo(() => sortClubTeams(teams), [teams]);
  const visible = useMemo(
    () => filterClubTeams(sorted, filters),
    [sorted, filters],
  );
  const counts = Object.fromEntries(
    sections.map(({ key }) => [
      key,
      sorted.filter((item) => item.section === key).length,
    ]),
  );
  const categories = [
    ...new Set(
      sorted
        .filter(
          (item) =>
            filters.section === "all" || item.section === filters.section,
        )
        .map((item) => item.category),
    ),
  ];
  const activeCount =
    Number(filters.gender !== "all") + Number(filters.category !== "all");
  const filtered =
    filters.section !== "all" || activeCount > 0 || !!filters.search.trim();
  const selectSection = (section: ClubTeamFilters["section"]) =>
    setFilters((old) => ({ ...old, section, category: "all" }));
  const cardWidth = width >= 600 ? (width - 12) / 2 : "100%";
  if (!teams.length)
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 20,
          padding: 24,
          gap: 8,
        }}
      >
        <Text
          style={{
            color: colors.ink,
            fontFamily: "Inter-SemiBold",
            fontSize: 17,
          }}
        >
          Les équipes arrivent bientôt
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontFamily: "Inter-Regular",
            lineHeight: 21,
          }}
        >
          Les équipes séniors et les catégories de l’académie apparaîtront ici.
        </Text>
      </View>
    );
  return (
    <View
      style={{ gap: 24 }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View style={{ gap: 12 }}>
        <SearchField
          value={filters.search}
          onChangeText={(search) => setFilters((old) => ({ ...old, search }))}
          placeholder="Rechercher une équipe ou une compétition"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          <Chip
            label={`Toutes (${teams.length})`}
            selected={filters.section === "all"}
            onPress={() => selectSection("all")}
          />
          {sections
            .filter(({ key }) => counts[key] > 0)
            .map(({ key, title }) => (
              <Chip
                key={key}
                label={`${title} (${counts[key]})`}
                selected={filters.section === key}
                onPress={() => selectSection(key)}
              />
            ))}
        </ScrollView>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={{
              flex: 1,
              color: colors.muted,
              fontFamily: "Inter-Regular",
              fontSize: 12,
            }}
          >
            {visible.length} équipe{visible.length > 1 ? "s" : ""}
            {filtered ? ` sur ${teams.length}` : ""}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtres des équipes"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((old) => !old)}
            style={{
              minHeight: 44,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor:
                expanded || activeCount ? colors.accentSoft : colors.surface,
              borderWidth: 1,
              borderColor:
                expanded || activeCount ? colors.blue : colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
            }}
          >
            <SlidersHorizontal size={16} color={colors.blue} />
            <Text
              style={{
                color: colors.blue,
                fontFamily: "Inter-SemiBold",
                fontSize: 12,
              }}
            >
              Filtres{activeCount ? ` · ${activeCount}` : ""}
            </Text>
          </Pressable>
          {filtered && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Réinitialiser les filtres des équipes"
              onPress={() => setFilters(initialFilters)}
              style={{
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 6,
              }}
            >
              <Text
                style={{
                  color: colors.blue,
                  fontFamily: "Inter-SemiBold",
                  fontSize: 12,
                }}
              >
                Effacer
              </Text>
            </Pressable>
          )}
        </View>
        {expanded && (
          <View
            style={{
              padding: 16,
              gap: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 20,
              backgroundColor: colors.surface,
            }}
          >
            <Text
              style={{
                color: colors.ink,
                fontFamily: "Inter-SemiBold",
                fontSize: 12,
              }}
            >
              Section
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(
                [
                  ["all", "Toutes"],
                  ["men", "Masculins"],
                  ["women", "Féminines"],
                  ["mixed", "Mixte"],
                ] as const
              )
                .filter(
                  ([key]) =>
                    key === "all" || sorted.some((item) => item.gender === key),
                )
                .map(([key, label]) => (
                  <Chip
                    key={key}
                    label={label}
                    selected={filters.gender === key}
                    onPress={() =>
                      setFilters((old) => ({ ...old, gender: key }))
                    }
                  />
                ))}
            </View>
            <Text
              style={{
                color: colors.ink,
                fontFamily: "Inter-SemiBold",
                fontSize: 12,
              }}
            >
              Catégorie
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip
                label="Toutes les catégories"
                selected={filters.category === "all"}
                onPress={() =>
                  setFilters((old) => ({ ...old, category: "all" }))
                }
              />
              {categories.map((category) => (
                <Chip
                  key={category}
                  label={category}
                  selected={filters.category === category}
                  onPress={() => setFilters((old) => ({ ...old, category }))}
                />
              ))}
            </View>
          </View>
        )}
      </View>
      {!visible.length && (
        <View
          style={{
            padding: 24,
            gap: 12,
            borderRadius: 20,
            backgroundColor: colors.surface,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter-SemiBold",
              fontSize: 17,
              color: colors.ink,
            }}
          >
            Aucune équipe ne correspond
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontFamily: "Inter-Regular",
              lineHeight: 21,
            }}
          >
            Essaie une autre catégorie ou efface les filtres.
          </Text>
          <ClubButton
            title="Réinitialiser les filtres"
            secondary
            onPress={() => setFilters(initialFilters)}
          />
        </View>
      )}
      {sections.map(({ key, title, description, Icon }) => {
        const rows = visible.filter((item) => item.section === key);
        if (!rows.length) return null;
        const groups =
          key === "academy"
            ? [...new Set(rows.map((item) => item.category))]
            : [null];
        return (
          <View key={key} style={{ gap: 16 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.accentSoft,
                }}
              >
                <Icon size={21} color={colors.blue} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  accessibilityRole="header"
                  style={{
                    fontFamily: "Inter-Bold",
                    fontSize: 22,
                    color: colors.ink,
                  }}
                >
                  {title}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter-Regular",
                    fontSize: 12,
                    color: colors.muted,
                  }}
                >
                  {description}
                </Text>
              </View>
              <Text
                style={{
                  color: colors.blue,
                  fontFamily: "Inter-Bold",
                  fontSize: 16,
                }}
              >
                {rows.length}
              </Text>
            </View>
            {groups.map((category) => {
              const group = category
                ? rows.filter((item) => item.category === category)
                : rows;
              return (
                <View key={category || key} style={{ gap: 10 }}>
                  {!!category && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Text
                        accessibilityRole="header"
                        style={{
                          fontFamily: "Inter-SemiBold",
                          fontSize: 15,
                          color: colors.ink,
                        }}
                      >
                        {category}
                      </Text>
                      <View
                        style={{
                          height: 1,
                          backgroundColor: colors.border,
                          flex: 1,
                        }}
                      />
                      <Text
                        style={{
                          fontFamily: "Inter-Regular",
                          fontSize: 12,
                          color: colors.muted,
                        }}
                      >
                        {group.length} équipe{group.length > 1 ? "s" : ""}
                      </Text>
                    </View>
                  )}
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
                  >
                    {group.map((item) => (
                      <TeamCard
                        key={item.team.id}
                        item={item}
                        logoUrl={logoUrl}
                        width={cardWidth}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
