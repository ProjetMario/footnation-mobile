import { ClubCalendarMatch as MatchCard } from "../components/ClubCalendarMatch";
import {
  ClubButton as Button,
  useClubUIStyles as useUIStyles,
  ClubSectionHeading,
} from "../components/ClubDesign";
import React, { useEffect, useState } from "react";
import { calendarDate } from "../lib/calendarDate";
import { todayMatches } from "../lib/todayMatches";
import { AppState, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Banner,
  Chip,
  Empty,
  ErrorState,
  Loading,
  Screen,
} from "../components/ui";
import { ClubTeams } from "../components/ClubTeams";
import { ClubMatchCalendar } from "../components/ClubMatchCalendar";
import { useTheme } from "../theme";
import { ClubNews } from "../components/ClubNews";
import { supabase } from "../lib/supabase";
export function ClubFootball({
  id,
  initialTab = "teams",
  contextual = false,
  clubName,
  clubLogoUrl,
}: {
  id: string;
  initialTab?: "teams" | "upcomingMatches";
  contextual?: boolean;
  clubName?: string;
  clubLogoUrl?: string | null;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();

  const [tab, setTab] = useState<string>(initialTab);
  const [day, setDay] = useState(() => calendarDate(new Date()));
  useEffect(() => {
    const update = () => setDay(calendarDate(new Date()));
    const timer = setInterval(update, 60000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  const query = useQuery({
    queryKey: ["native-club-football", id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("club-details", {
        body: { clubId: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data) throw new Error("Aucune réponse pour ce club.");
      return data;
    },
    staleTime: 120000,
  });
  const rows =
    tab === "today"
      ? todayMatches(
          query.data?.upcomingMatches || [],
          query.data?.pastMatches || [],
          day,
        )
      : query.data?.[tab] || [];
  const club = {
    name: clubName || query.data?.club?.name || "",
    logo: clubLogoUrl || query.data?.club?.logo,
    teamIds: (query.data?.teams || []).map((team: { id: string }) => team.id),
  };
  return (
    <>
      <ClubSectionHeading
        title={
          contextual
            ? initialTab === "teams"
              ? "Les équipes"
              : "Calendrier & résultats"
            : "La vie sportive du club"
        }
        busy={query.isFetching}
        refresh={() => {
          setDay(calendarDate(new Date()));
          void query.refetch();
        }}
      />
      {(!contextual || initialTab !== "teams") && (
        <View
          style={{
            flexDirection: "row",
            padding: 4,
            borderRadius: 14,
            backgroundColor: colors.accentSoft,
          }}
        >
          {[
            ["teams", "Équipes"],
            ["upcomingMatches", "À venir"],
            ["today", "Aujourd’hui"],
            ["pastMatches", "Résultats"],
          ]
            .filter(([key]) => !contextual || key !== "teams")
            .map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: tab === key }}
                aria-selected={tab === key}
                onPress={() => setTab(key)}
                style={{
                  flex: 1,
                  minHeight: 40,
                  paddingHorizontal: 6,
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 10,
                  backgroundColor: tab === key ? colors.surface : "transparent",
                }}
              >
                <Text
                  style={{
                    color: tab === key ? colors.blue : colors.muted,
                    fontFamily: "Inter-SemiBold",
                    fontSize: 12,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
        </View>
      )}
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!query.data &&
        (tab === "teams" ? (
          <ClubTeams teams={rows} logoUrl={club.logo} />
        ) : (
          <ClubMatchCalendar
            key={id}
            matches={rows}
            allMatches={[
              ...(query.data.upcomingMatches || []),
              ...(query.data.pastMatches || []),
            ]}
            teams={query.data.teams || []}
            club={club}
            today={tab === "today"}
          />
        ))}
    </>
  );
}
export function TeamDetail() {
  const s = useUIStyles();

  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const [tab, setTab] = useState("rankings");
  const query = useQuery({
    queryKey: ["native-team-football", teamId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("team-details", {
        body: { teamId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.team) throw new Error("Équipe introuvable.");
      return data;
    },
  });
  return (
    <Screen title="Équipe">
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <Banner
            eyebrow={query.data.team.category || "ÉQUIPE"}
            title={query.data.team.name}
            description={query.data.competition?.name}
          />
          {!!query.data.team.clubId && (
            <Button
              title="Voir le club"
              secondary
              onPress={() =>
                router.push(
                  `/club/${encodeURIComponent(query.data.team.clubSlug || query.data.team.clubId)}`,
                )
              }
            />
          )}
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {[
              ["rankings", "Classement"],
              ["upcomingMatches", "Calendrier"],
              ["pastMatches", "Résultats"],
              ["news", "Actualités"],
            ].map(([key, label]) => (
              <Chip
                key={key}
                label={label}
                selected={tab === key}
                onPress={() => setTab(key)}
              />
            ))}
          </View>
          {tab === "news" && query.data.team.clubId ? (
            <ClubNews
              id={query.data.team.clubId}
              name={query.data.team.clubName || query.data.team.name}
              teamId={teamId}
              title="Actualités de l’équipe"
            />
          ) : !query.data[tab]?.length ? (
            <Empty title="Aucune donnée disponible" />
          ) : tab === "rankings" ? (
            <View style={s.card}>
              {query.data.rankings.map((row: any) => (
                <View key={`${row.rank}/${row.teamId}`} style={s.between}>
                  <Text style={[s.text, { flex: 1 }]}>
                    {row.rank}. {row.teamName}
                  </Text>
                  <Text style={s.small}>
                    {row.played} J · {row.goalDiff > 0 ? "+" : ""}
                    {row.goalDiff}
                  </Text>
                  <Text style={[s.text, { fontWeight: "800" }]}>
                    {row.points} pts
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            query.data[tab].map((match: any) => (
              <MatchCard key={match.id} match={match} />
            ))
          )}
        </>
      )}
    </Screen>
  );
}
export function Ligue1Standings() {
  const s = useUIStyles();

  const query = useQuery({
    queryKey: ["native-ligue1-standings"],
    queryFn: async () => {
      const response = await fetch(
        "https://www.foot-nation.com/api/standings/ligue1",
      );
      if (!response.ok)
        throw new Error("Impossible de charger le classement Ligue 1.");
      const data = await response.json();
      if (!Array.isArray(data.standings))
        throw new Error("Le classement n’est pas disponible pour le moment.");
      return data;
    },
    staleTime: 60000,
  });
  return (
    <Screen title="Classement Ligue 1">
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <Banner
            eyebrow={query.data.season?.name || "LIGUE 1"}
            title={query.data.league?.name || "Classement Ligue 1"}
          />
          <View style={s.card}>
            {query.data.standings.map((row: any) => (
              <View key={`${row.rank}/${row.teamName}`} style={s.between}>
                <Text style={[s.text, { flex: 1 }]}>
                  {row.rank}. {row.teamName}
                </Text>
                <Text style={s.small}>
                  {row.played ?? "–"} J · {row.goalDiff ?? "–"}
                </Text>
                <Text style={[s.text, { fontWeight: "800" }]}>
                  {row.points} pts
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
