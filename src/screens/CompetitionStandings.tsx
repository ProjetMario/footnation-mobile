import React from "react";
import { FlatList, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase, requireBackend } from "../lib/supabase";
import {
  Avatar,
  Chip,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";

const competitions = [
  { slug: "ligue-1", code: "FL1", name: "Ligue 1" },
  { slug: "premier-league", code: "PL", name: "Premier League" },
  { slug: "liga", code: "PD", name: "Liga" },
  { slug: "bundesliga", code: "BL1", name: "Bundesliga" },
  { slug: "ligue-des-champions", code: "CL", name: "Ligue des champions" },
];
type Standing = {
  position: number;
  team: { id: number; name: string; shortName?: string; crest?: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form?: string;
};
type StandingsResponse = {
  fetchedAt?: string;
  source?: string;
  standings?: {
    competitionCode: string;
    season: string;
    standings: Standing[];
  }[];
};
export default function CompetitionStandings() {
  const s = useUIStyles();

  const { competition = "ligue-1" } = useLocalSearchParams<{
    competition?: string;
  }>();
  const selected = competitions.find((item) => item.slug === competition);
  const query = useQuery({
    queryKey: ["competition-standings", selected?.code],
    enabled: !!selected,
    queryFn: async () => {
      requireBackend();
      const { data, error } =
        await supabase.functions.invoke<StandingsResponse>("standings", {
          body: { competitions: selected!.code },
        });
      if (error) throw error;
      const result = data?.standings?.find(
        (item) => item.competitionCode.toUpperCase() === selected!.code,
      );
      if (!result)
        throw new Error(
          "Le classement de cette compétition est momentanément indisponible.",
        );
      return { ...result, fetchedAt: data?.fetchedAt, source: data?.source };
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });
  return (
    <Screen title="Classements" scroll={false}>
      <FlatList
        contentContainerStyle={s.content}
        data={[...(query.data?.standings ?? [])].sort(
          (a, b) => a.position - b.position,
        )}
        keyExtractor={(item) => String(item.team.id)}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {competitions.map((item) => (
                <Chip
                  key={item.code}
                  label={item.name}
                  selected={item.slug === competition}
                  onPress={() => router.replace(`/classements/${item.slug}`)}
                />
              ))}
            </ScrollView>
            <Text style={s.title}>
              {selected?.name ?? "Compétition inconnue"}
            </Text>
            {!!query.data && (
              <Text style={s.small}>
                Saison {query.data.season}
                {query.data.fetchedAt
                  ? ` · Actualisé le ${new Date(query.data.fetchedAt).toLocaleString("fr-FR")}`
                  : ""}
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.h2}>{item.position}</Text>
              <Avatar uri={item.team.crest} name={item.team.name} />
              <Text style={[s.h2, { flex: 1 }]}>
                {item.team.shortName || item.team.name}
              </Text>
              <Text style={s.h2}>{item.points} pts</Text>
            </View>
            <Text style={s.text}>
              {item.playedGames} joués · {item.won} gagnés · {item.draw} nuls ·{" "}
              {item.lost} perdus
            </Text>
            <Text style={s.small}>
              Buts marqués : {item.goalsFor} · encaissés : {item.goalsAgainst} ·
              différence : {item.goalDifference > 0 ? "+" : ""}
              {item.goalDifference}
            </Text>
            {!!item.form && (
              <Text style={s.small}>
                Forme :{" "}
                {item.form
                  .split(/[,.;\s]+/)
                  .filter((value) =>
                    ["W", "D", "L"].includes(value.toUpperCase()),
                  )
                  .map(
                    (value) =>
                      ({ W: "Victoire", D: "Nul", L: "Défaite" })[
                        value.toUpperCase()
                      ],
                  )
                  .join(" · ")}
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          !selected ? (
            <Empty title="Compétition inconnue" />
          ) : query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : (
            <Empty title="Classement pas encore disponible" />
          )
        }
      />
    </Screen>
  );
}
