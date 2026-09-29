import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { supabase } from "../lib/supabase";
import { Button, Chip, Empty, ErrorState, Loading, useUIStyles } from "./ui";
type Contribution = {
  id: string;
  goals: number | null;
  assists: number | null;
  player: { id: string; name: string; jersey_number: number | null };
};
export function ClubMatchContributors({
  matchId,
  clubId,
}: {
  matchId: string;
  clubId: string;
}) {
  const s = useUIStyles();

  const [mode, setMode] = useState<"goals" | "assists">("goals");
  const query = useInfiniteQuery({
    queryKey: ["club-match-contributors", clubId, matchId, mode],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const result = await supabase
        .from("match_player_stats")
        .select(
          "id,goals,assists,player:club_players!inner(id,name,jersey_number),match:club_matches!inner(id)",
          { count: "exact" },
        )
        .eq("match_id", matchId)
        .eq("player.club_id", clubId)
        .eq("match.club_id", clubId)
        .eq("match.status", "finished")
        .gt(mode, 0)
        .order(mode, { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29)
        .returns<Contribution[]>();
      if (result.error) throw result.error;
      return { rows: result.data, count: result.count || 0 };
    },
    getNextPageParam: (last, pages) =>
      pages.reduce((sum, page) => sum + page.rows.length, 0) < last.count
        ? pages.length * 30
        : undefined,
  });
  return (
    <View style={{ gap: 12 }}>
      <View style={s.row}>
        <Chip
          label="Buteurs"
          selected={mode === "goals"}
          onPress={() => setMode("goals")}
        />
        <Chip
          label="Passeurs"
          selected={mode === "assists"}
          onPress={() => setMode("assists")}
        />
      </View>
      <Button
        title="Actualiser les statistiques du match"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages
        .flatMap((page) => page.rows)
        .map((row) => (
          <View key={row.id} style={s.card}>
            <Text style={s.h2}>{row.player.name}</Text>
            {!!(row.player.jersey_number != null) && (
              <Text style={s.small}>N° {row.player.jersey_number}</Text>
            )}
            <Text style={s.text}>
              {row[mode]} {mode === "goals" ? "but(s)" : "passe(s) décisive(s)"}
            </Text>
          </View>
        ))}
      {!!(
        query.data && !query.data.pages.flatMap((page) => page.rows).length
      ) && (
        <Empty
          title={
            mode === "goals"
              ? "Aucun buteur renseigné"
              : "Aucun passeur renseigné"
          }
          description="Les statistiques disponibles pour ce match apparaîtront ici."
        />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Voir les joueurs suivants"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </View>
  );
}

type LivePlayer = {
  id: string;
  name: string;
  category: string | null;
  jersey_number: number | null;
};

type LiveStat = {
  id: string;
  player_id: string;
  goals: number | null;
  assists: number | null;
  minutes_played: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
};

export function ClubGoalLiveRecorder({
  matchId,
  clubId,
  category,
}: {
  matchId: string;
  clubId: string;
  category?: string | null;
}) {
  const s = useUIStyles();
  const cache = useQueryClient();
  const [scorerId, setScorerId] = useState("");
  const [assistId, setAssistId] = useState("");
  const [notice, setNotice] = useState("");
  const players = useQuery({
    queryKey: ["club-live-goal-players", clubId, category || null],
    queryFn: async () => {
      let request = supabase
        .from("club_players")
        .select("id,name,category,jersey_number")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .order("name")
        .limit(80);
      if (category) request = request.eq("category", category);
      const result = await request.returns<LivePlayer[]>();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const stats = useQuery({
    queryKey: ["club-live-goal-stats", clubId, matchId],
    queryFn: async () => {
      const result = await supabase
        .from("match_player_stats")
        .select("*")
        .eq("match_id", matchId)
        .returns<LiveStat[]>();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const statByPlayer = useMemo(() => {
    const map = new Map<string, LiveStat>();
    (stats.data || []).forEach((row) => map.set(row.player_id, row));
    return map;
  }, [stats.data]);
  const saveOne = async (playerId: string, field: "goals" | "assists") => {
    const current = statByPlayer.get(playerId) || null;
    const payload = {
      goals: current?.goals ?? 0,
      assists: current?.assists ?? 0,
      minutes_played: current?.minutes_played ?? 0,
      yellow_cards: current?.yellow_cards ?? 0,
      red_cards: current?.red_cards ?? 0,
    };
    payload[field] += 1;
    const recordId = current?.id || randomUUID();
    const result = await supabase.rpc("save_native_match_player_stats", {
      p_id: recordId,
      p_match_id: matchId,
      p_player_id: playerId,
      p_values: payload,
      p_expected: current,
    });
    if (result.error) throw result.error;
    if (result.data !== recordId)
      throw new Error(
        "L’action n’a pas pu être confirmée. Actualisez le match.",
      );
  };
  const mutation = useMutation({
    mutationFn: async () => {
      setNotice("");
      if (!scorerId) throw new Error("Choisissez le buteur.");
      if (assistId && assistId === scorerId)
        throw new Error("Le passeur doit être différent du buteur.");
      await saveOne(scorerId, "goals");
      if (assistId) await saveOne(assistId, "assists");
    },
    onSuccess: () => {
      const scorer = players.data?.find((player) => player.id === scorerId);
      const passer = players.data?.find((player) => player.id === assistId);
      setNotice(
        passer
          ? `But ajouté : ${scorer?.name || "buteur"}, passe décisive ${passer.name}.`
          : `But ajouté : ${scorer?.name || "buteur"}.`,
      );
      setScorerId("");
      setAssistId("");
      void stats.refetch();
      void cache.invalidateQueries({
        queryKey: ["club-live-goal-stats", clubId, matchId],
      });
      void cache.invalidateQueries({
        queryKey: ["club-match-contributors", clubId, matchId],
      });
      void cache.invalidateQueries({
        queryKey: ["club-match-mvp-candidates", clubId, matchId],
      });
      void cache.invalidateQueries({ queryKey: ["club-native-stats", clubId] });
    },
  });
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.h2}>But en direct</Text>
      <Text style={s.subtitle}>
        Sélectionnez le buteur, puis le passeur si la passe décisive existe.
      </Text>
      {!!players.isPending && <Loading />}
      {!!players.error && (
        <ErrorState
          error={players.error}
          retry={() => void players.refetch()}
        />
      )}
      {!!stats.error && (
        <ErrorState error={stats.error} retry={() => void stats.refetch()} />
      )}
      <Text style={s.small}>Buteur</Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {(players.data || []).map((player) => (
          <Chip
            key={`scorer:${player.id}`}
            label={`${player.jersey_number != null ? `N°${player.jersey_number} · ` : ""}${player.name}`}
            selected={scorerId === player.id}
            disabled={mutation.isPending}
            onPress={() => setScorerId(player.id)}
          />
        ))}
      </View>
      <Text style={s.small}>Passeur décisif</Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Chip
          label="Aucun passeur"
          selected={!assistId}
          disabled={mutation.isPending}
          onPress={() => setAssistId("")}
        />
        {(players.data || []).map((player) => (
          <Chip
            key={`assist:${player.id}`}
            label={`${player.jersey_number != null ? `N°${player.jersey_number} · ` : ""}${player.name}`}
            selected={assistId === player.id}
            disabled={mutation.isPending || scorerId === player.id}
            onPress={() => setAssistId(player.id)}
          />
        ))}
      </View>
      {!!mutation.error && <ErrorState error={mutation.error} />}
      {!!notice && <Text style={s.text}>{notice}</Text>}
      <Button
        title="Valider le but"
        busy={mutation.isPending || stats.isFetching}
        disabled={mutation.isPending || stats.isFetching || players.isPending}
        onPress={() => mutation.mutate()}
      />
    </View>
  );
}
