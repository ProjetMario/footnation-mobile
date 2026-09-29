import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SlidersHorizontal } from "lucide-react-native";
import { useTheme } from "../theme";
import { Chip, Empty, SearchField } from "./ui";
import { ClubCalendarMatch, type CalendarClub } from "./ClubCalendarMatch";
import { type ClubTeam, type PresentedClubTeam } from "../lib/clubTeams";
import {
  calendarTeamOptions,
  emptyMatchFilters,
  filterClubMatches,
  type CalendarMatch,
  type ClubMatchFilters,
} from "../lib/clubMatchFilters";

function teamLabel(item: PresentedClubTeam) {
  const gender = {
    men: "Masculins",
    women: "Féminines",
    mixed: "Mixte",
    unknown: "",
  }[item.gender];
  return [item.title, gender].filter(Boolean).join(" · ");
}

export function ClubMatchCalendar({
  matches,
  allMatches,
  teams,
  club,
  today = false,
}: {
  matches: CalendarMatch[];
  allMatches: CalendarMatch[];
  teams: ClubTeam[];
  club: CalendarClub;
  today?: boolean;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState<ClubMatchFilters>(emptyMatchFilters);
  const options = useMemo(
    () => calendarTeamOptions(allMatches, teams, club.name),
    [allMatches, teams, club.name],
  );
  const visible = useMemo(
    () => filterClubMatches(matches, teams, club.name, filters),
    [matches, teams, club.name, filters],
  );
  const categories = [...new Set(options.map((item) => item.category))];
  const activeCount =
    Number(filters.category !== "all") +
    Number(filters.team !== "all") +
    Number(filters.location !== "all") +
    Number(!!filters.search.trim());
  const selectedTeam = options.find((item) => item.team.id === filters.team);
  const summary = [
    filters.category !== "all" ? filters.category : "",
    selectedTeam ? teamLabel(selectedTeam) : "",
    filters.location === "home"
      ? "Domicile"
      : filters.location === "away"
        ? "Extérieur"
        : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const labelStyle = {
    color: colors.muted,
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
  };
  return (
    <View style={{ gap: 12 }}>
      <SearchField
        value={filters.search}
        onChangeText={(search) => setFilters((old) => ({ ...old, search }))}
        placeholder="Rechercher une équipe ou une compétition"
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: colors.muted,
              fontFamily: "Inter-Regular",
              fontSize: 12,
            }}
          >
            {visible.length} match{visible.length > 1 ? "s" : ""}
            {activeCount ? ` sur ${matches.length}` : ""}
          </Text>
          {!!summary && (
            <Text style={{ ...labelStyle, lineHeight: 17 }}>{summary}</Text>
          )}
        </View>
        {!!activeCount && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Réinitialiser les filtres des matchs"
            onPress={() => setFilters(emptyMatchFilters)}
            style={{
              minHeight: 44,
              paddingHorizontal: 8,
              justifyContent: "center",
            }}
          >
            <Text style={{ ...labelStyle, color: colors.blue }}>Effacer</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filtres des matchs"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((old) => !old)}
          style={{
            minHeight: 44,
            paddingHorizontal: 12,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            borderWidth: 1,
            borderColor: expanded || activeCount ? colors.blue : colors.border,
            backgroundColor:
              expanded || activeCount ? colors.accentSoft : colors.surface,
          }}
        >
          <SlidersHorizontal size={16} color={colors.blue} />
          <Text style={{ ...labelStyle, color: colors.blue }}>
            Filtres{activeCount ? ` · ${activeCount}` : ""}
          </Text>
        </Pressable>
      </View>
      {expanded && (
        <View
          style={{
            gap: 14,
            padding: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={labelStyle}>Catégorie</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {["all", ...categories].map((category) => (
              <Chip
                key={category}
                label={category === "all" ? "Toutes les catégories" : category}
                selected={filters.category === category}
                onPress={() =>
                  setFilters((old) => ({ ...old, category, team: "all" }))
                }
              />
            ))}
          </View>
          <Text style={labelStyle}>Équipe du club</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip
              label="Toutes les équipes"
              selected={filters.team === "all"}
              onPress={() => setFilters((old) => ({ ...old, team: "all" }))}
            />
            {options
              .filter(
                (item) =>
                  filters.category === "all" ||
                  item.category === filters.category,
              )
              .map((item) => (
                <Chip
                  key={item.team.id}
                  label={teamLabel(item)}
                  selected={filters.team === item.team.id}
                  onPress={() =>
                    setFilters((old) => ({ ...old, team: item.team.id }))
                  }
                />
              ))}
          </View>
          <Text style={labelStyle}>Lieu</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(
              [
                ["all", "Tous"],
                ["home", "Domicile"],
                ["away", "Extérieur"],
              ] as const
            ).map(([location, label]) => (
              <Chip
                key={location}
                label={label}
                selected={filters.location === location}
                onPress={() => setFilters((old) => ({ ...old, location }))}
              />
            ))}
          </View>
        </View>
      )}
      {!visible.length ? (
        <Empty
          title={
            activeCount
              ? "Aucun match pour ces filtres"
              : today
                ? "Aucun match aujourd’hui"
                : "Aucun match disponible"
          }
          description={
            activeCount
              ? "Modifie les filtres ou utilise Effacer pour retrouver tous les matchs."
              : undefined
          }
        />
      ) : (
        visible.map((match) => (
          <ClubCalendarMatch key={match.id} match={match} club={club} />
        ))
      )}
    </View>
  );
}
