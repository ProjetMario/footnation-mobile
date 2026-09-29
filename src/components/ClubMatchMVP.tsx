import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Avatar, Button, Empty, ErrorState, Loading, useUIStyles } from "./ui";
type Candidate = {
  id: string;
  name: string;
  category: string;
  position: string | null;
  jersey_number: number | null;
  vote_count: number;
};
export function ClubMatchMVP({
  matchId,
  clubId,
}: {
  matchId: string;
  clubId: string;
}) {
  const uid = useAuth().session?.user.id;
  return (
    <Voting
      key={`${matchId}:${uid || "anonymous"}`}
      matchId={matchId}
      clubId={clubId}
      uid={uid}
    />
  );
}
function Voting({
  matchId,
  clubId,
  uid,
}: {
  matchId: string;
  clubId: string;
  uid?: string;
}) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [selected, setSelected] = useState<{
    playerId: string;
    name: string;
    voteId: string;
  } | null>(null);
  const [sent, setSent] = useState(false);
  const candidates = useInfiniteQuery({
    queryKey: ["club-match-mvp-candidates", clubId, matchId, uid],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const r = await supabase.rpc("get_native_match_mvp_candidates", {
        p_match_id: matchId,
        p_club_id: clubId,
        p_offset: pageParam,
      });
      if (r.error) throw r.error;
      return r.data as Candidate[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const summary = useQuery({
    queryKey: ["club-match-mvp-summary", clubId, matchId, uid],
    queryFn: async () => {
      const count = await supabase
        .from("match_mvp_votes")
        .select("id", { count: "exact", head: true })
        .eq("match_id", matchId);
      if (count.error) throw count.error;
      if (!uid) return { count: count.count || 0, own: null };
      const own = await supabase
        .from("match_mvp_votes")
        .select("id,player_id,player:club_players(name)")
        .eq("match_id", matchId)
        .eq("voter_id", uid)
        .returns<
          { id: string; player_id: string; player: { name: string } | null }[]
        >()
        .maybeSingle();
      if (own.error) throw own.error;
      return { count: count.count || 0, own: own.data };
    },
  });
  const vote = useMutation({
    mutationFn: async (choice: NonNullable<typeof selected>) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!uid || auth.data.user?.id !== uid)
        throw new Error(
          "Votre session a changé. Reconnectez-vous avant de voter.",
        );
      const r = await supabase.rpc("cast_native_match_mvp_vote", {
        p_id: choice.voteId,
        p_match_id: matchId,
        p_player_id: choice.playerId,
      });
      if (r.error?.code === "23505")
        throw new Error(
          "Un vote a déjà été enregistré. Actualisez les votes pour retrouver votre choix.",
        );
      if (r.error?.code === "42501")
        throw new Error(
          "Ce joueur n’est plus éligible ou le vote n’est plus disponible. Actualisez les candidats.",
        );
      if (r.error) throw r.error;
      if (typeof r.data !== "string")
        throw new Error(
          "Le vote n’a pas pu être confirmé. Réessayez avec le même choix.",
        );
    },
    onSuccess: () => {
      setSent(true);
      setSelected(null);
      void cache.invalidateQueries({
        queryKey: ["club-match-mvp-candidates", clubId, matchId],
      });
      void cache.invalidateQueries({
        queryKey: ["club-match-mvp-summary", clubId, matchId],
      });
    },
  });
  const hasVoted = sent || !!summary.data?.own;
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.h2}>Joueur du match</Text>
      <Text style={s.small}>
        Un vote par personne. Votre choix est définitif.
      </Text>
      <Button
        title="Actualiser les votes"
        secondary
        disabled={vote.isPending}
        busy={candidates.isFetching || summary.isFetching}
        onPress={() => {
          void candidates.refetch();
          void summary.refetch();
        }}
      />
      {!!(candidates.isPending || summary.isPending) && <Loading />}
      {!!candidates.error && (
        <ErrorState
          error={candidates.error}
          retry={() => void candidates.refetch()}
        />
      )}
      {!!summary.error && (
        <ErrorState
          error={summary.error}
          retry={() => void summary.refetch()}
        />
      )}
      {!!vote.error && <ErrorState error={vote.error} />}
      {!!summary.data && (
        <Text style={s.text}>{summary.data.count} votes enregistrés</Text>
      )}
      {!!hasVoted && (
        <Text style={s.text}>
          Votre vote est enregistré
          {summary.data?.own?.player?.name
            ? ` pour ${summary.data.own.player.name}`
            : ""}
          .
        </Text>
      )}
      {selected && !hasVoted ? (
        <View style={s.card}>
          <Text style={s.h2}>Voter pour {selected.name} ?</Text>
          <Button
            title="Confirmer mon vote"
            busy={vote.isPending}
            onPress={() => vote.mutate(selected)}
          />
          <Button
            title="Annuler mon choix"
            secondary
            disabled={vote.isPending}
            onPress={() => {
              setSelected(null);
              vote.reset();
            }}
          />
        </View>
      ) : null}
      {candidates.data?.pages.flat().map((player) => (
        <View key={player.id} style={s.card}>
          <View style={s.row}>
            <Avatar name={player.name} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.h2}>{player.name}</Text>
              <Text style={s.small}>
                {[
                  player.category,
                  player.position,
                  player.jersey_number != null
                    ? `N° ${player.jersey_number}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          </View>
          <Text style={s.text}>{player.vote_count} votes</Text>
          {!hasVoted && (
            <Button
              title="Choisir ce joueur"
              secondary
              disabled={
                !!selected ||
                vote.isPending ||
                summary.isFetching ||
                summary.isError ||
                !summary.isSuccess ||
                candidates.isFetching ||
                candidates.isError
              }
              onPress={() =>
                uid
                  ? setSelected({
                      playerId: player.id,
                      name: player.name,
                      voteId: randomUUID(),
                    })
                  : router.push({ pathname: "/login", params: { next: `/club/${clubId}` } })
              }
            />
          )}
        </View>
      ))}
      {!!(candidates.data && !candidates.data.pages.flat().length) && (
        <Empty
          title="Aucun candidat disponible"
          description="Les joueurs éligibles apparaîtront ici une fois l’effectif renseigné."
        />
      )}
      {!!candidates.hasNextPage && (
        <Button
          title="Voir les candidats suivants"
          disabled={vote.isPending}
          busy={candidates.isFetchingNextPage}
          onPress={() => void candidates.fetchNextPage()}
        />
      )}
    </View>
  );
}
