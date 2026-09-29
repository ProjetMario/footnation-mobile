import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, usePathname, useLocalSearchParams } from "expo-router";
import { authGateReturnPath } from "../lib/authReturn";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { AuthGate } from "../components/AuthGate";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { MatchDTO } from "../types/matches";
export function MatchPrediction({ match }: { match: MatchDTO }) {
  const s = useUIStyles();
  const next = authGateReturnPath(usePathname(), useLocalSearchParams());

  const { session } = useAuth();
  const cache = useQueryClient();
  const id = match.external_match_id;
  const query = useQuery({
    queryKey: ["native-prediction", id, session?.user.id],
    queryFn: async () => {
      const stats = await supabase
        .from("match_prediction_stats")
        .select("*")
        .eq("match_id", id)
        .maybeSingle();
      if (stats.error) throw stats.error;
      let own = null;
      if (session) {
        const result = await supabase
          .from("match_predictions")
          .select("prediction")
          .eq("match_id", id)
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (result.error) throw result.error;
        own = result.data?.prediction;
      }
      return { stats: stats.data, own };
    },
    refetchInterval: 30000,
  });
  const vote = useMutation({
    mutationFn: async (prediction: string) => {
      if (!session) throw new Error("Connectez-vous pour pronostiquer.");
      if (
        match.status !== "SCHEDULED" ||
        (match.kickoff_at && Date.parse(match.kickoff_at) <= Date.now())
      )
        throw new Error("Les pronostics sont fermés pour ce match.");
      const { error } = await supabase
        .from("match_predictions")
        .upsert(
          { match_id: id, user_id: session.user.id, prediction },
          { onConflict: "match_id,user_id" },
        )
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["native-prediction", id] });
    },
  });
  const closed =
    match.status !== "SCHEDULED" ||
    (match.kickoff_at && Date.parse(match.kickoff_at) <= Date.now());
  return (
    <View style={s.card}>
      <Text style={s.h2}>Votre pronostic</Text>
      {!!query.isPending && <Loading />}
      {!!query.error && <ErrorState error={query.error} />}
      {[
        ["home", match.home.name],
        ["draw", "Match nul"],
        ["away", match.away.name],
      ].map(([key, label]) => (
        <View key={key} style={{ gap: 6 }}>
          <Text style={s.small}>
            {query.data?.stats?.total_count
              ? Math.round(
                  ((query.data.stats[`${key}_count`] || 0) * 100) /
                    query.data.stats.total_count,
                )
              : 0}{" "}
            % des pronostics
          </Text>
          <Button
            title={`${query.data?.own === key ? "✓ " : ""}${label}`}
            secondary={query.data?.own !== key}
            disabled={!!closed || !session || query.isPending || !!query.error}
            busy={vote.isPending}
            onPress={() => vote.mutate(key)}
          />
        </View>
      ))}
      {!!closed && <Text style={s.small}>Pronostics fermés</Text>}
      {!session && (
        <Button title="Se connecter" onPress={() => router.push({ pathname: "/login", params: next ? { next } : {} })} />
      )}
      {!!vote.error && <ErrorState error={vote.error} />}
    </View>
  );
}
export default function Predictions() {
  return (
    <Screen title="Classement des pronostics">
      <AuthGate>
        <Leaderboard />
      </AuthGate>
    </Screen>
  );
}
function Leaderboard() {
  const s = useUIStyles();

  const [period, setPeriod] = useState("total_points");
  const query = useInfiniteQuery({
    queryKey: ["native-prediction-leaderboard", period],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const stats = await supabase
        .from("user_prediction_stats")
        .select("*")
        .order(period, { ascending: false })
        .order("user_id")
        .range(pageParam, pageParam + 29);
      if (stats.error) throw stats.error;
      if (!stats.data.length) return [];
      const profiles = await supabase
        .from("profiles")
        .select("id,full_name,username,avatar_url")
        .in(
          "id",
          stats.data.map((row) => row.user_id),
        );
      if (profiles.error) throw profiles.error;
      return stats.data.map((row, index) => ({
        ...row,
        rank: pageParam + index + 1,
        profile: profiles.data.find((p) => p.id === row.user_id),
      }));
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  return (
    <>
      <Button
        title="Pronostiquer un match"
        onPress={() => router.push("/matches")}
      />
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {[
          ["total_points", "Général"],
          ["weekly_points", "Cette semaine"],
          ["monthly_points", "Ce mois"],
        ].map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={period === key}
            onPress={() => setPeriod(key)}
          />
        ))}
      </View>
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages.flat().map((row) => (
        <View style={[s.card, s.row]} key={row.user_id}>
          <Text style={s.h2}>{row.rank}</Text>
          <Avatar uri={row.profile?.avatar_url} name={row.profile?.full_name} />
          <View style={{ flex: 1 }}>
            <Text style={s.text}>
              {row.profile?.full_name ||
                row.profile?.username ||
                "Membre FootNation"}
            </Text>
            <Text style={s.small}>
              {row.correct_predictions} pronostics corrects sur{" "}
              {row.total_predictions}
            </Text>
          </View>
          <Text style={s.h2}>{row[period] || 0} pts</Text>
        </View>
      ))}
      {!!(query.data && !query.data.pages.flat().length) && (
        <Empty title="Aucun résultat pour le moment" />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Charger la suite"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
