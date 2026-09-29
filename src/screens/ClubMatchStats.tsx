import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  SearchField,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { searchPattern, useDebounced } from "../lib/data";
import { clubFieldValue } from "../lib/clubFieldValue";
import { requireAttendanceAdmin } from "./ClubAttendanceSessions";
const fields = [
  ["goals", "Buts"],
  ["assists", "Passes décisives"],
  ["minutes_played", "Minutes jouées"],
  ["yellow_cards", "Cartons jaunes"],
  ["red_cards", "Cartons rouges"],
] as const;
type Player = {
  id: string;
  name: string;
  category: string;
  is_active: boolean | null;
};
export default function ClubMatchStats() {
  const { id, matchId } = useLocalSearchParams<{
    id: string;
    matchId: string;
  }>();
  const uid = useAuth().session?.user.id;
  return (
    <Screen title="Statistiques du match">
      <AuthGate>
        <MatchStats
          key={`${id}:${matchId}:${uid}`}
          id={id}
          matchId={matchId}
          uid={uid!}
        />
      </AuthGate>
    </Screen>
  );
}
function MatchStats({
  id,
  matchId,
  uid,
}: {
  id: string;
  matchId: string;
  uid: string;
}) {
  const s = useUIStyles();

  const [selected, setSelected] = useState<Player | null>(null);
  const [saved, setSaved] = useState(false);
  const match = useQuery({
    queryKey: ["club-stats-match", id, matchId, uid],
    queryFn: async () => {
      await requireAttendanceAdmin(id, uid);
      const r = await supabase
        .from("club_matches")
        .select("id,opponent_name,match_date,category")
        .eq("id", matchId)
        .eq("club_id", id)
        .single();
      if (r.error) throw r.error;
      return r.data;
    },
  });
  if (match.isPending) return <Loading />;
  if (match.error)
    return (
      <ErrorState error={match.error} retry={() => void match.refetch()} />
    );
  return (
    <>
      <Text style={s.h2}>Match contre {match.data!.opponent_name}</Text>
      <Text style={s.subtitle}>
        {match.data!.category} ·{" "}
        {new Date(match.data!.match_date).toLocaleString("fr-FR")}
      </Text>
      {!!saved && <Text style={s.text}>Statistiques enregistrées.</Text>}
      {selected ? (
        <StatsLoader
          key={selected.id}
          id={id}
          matchId={matchId}
          uid={uid}
          player={selected}
          close={(success) => {
            setSelected(null);
            setSaved(success);
          }}
        />
      ) : (
        <PlayerPicker
          id={id}
          uid={uid}
          select={(player) => {
            setSaved(false);
            setSelected(player);
          }}
        />
      )}
    </>
  );
}
function PlayerPicker({
  id,
  uid,
  select,
}: {
  id: string;
  uid: string;
  select: (player: Player) => void;
}) {
  const s = useUIStyles();

  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const query = useInfiniteQuery({
    queryKey: ["club-statistics-players", id, uid, term],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      await requireAttendanceAdmin(id, uid);
      let q = supabase
        .from("club_players")
        .select("id,name,category,is_active")
        .eq("club_id", id);
      if (term) q = q.ilike("name", searchPattern(term));
      const r = await q
        .order("name")
        .order("id")
        .range(pageParam, pageParam + 29)
        .returns<Player[]>();
      if (r.error) throw r.error;
      return r.data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  return (
    <>
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Choisir un joueur du club"
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages.flat().map((player) => (
        <View key={player.id} style={s.card}>
          <Text style={s.h2}>{player.name}</Text>
          <Text style={s.small}>
            {player.category}
            {player.is_active === false ? " · Ancien effectif" : ""}
          </Text>
          <Button
            title="Saisir ou corriger ses statistiques"
            secondary
            onPress={() => select(player)}
          />
        </View>
      ))}
      {!!(query.data && !query.data.pages.flat().length) && (
        <Empty
          title="Aucun joueur trouvé"
          description="Ajoutez les joueurs dans l’effectif du club ou modifiez votre recherche."
        />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Voir les joueurs suivants"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
function StatsLoader({
  id,
  matchId,
  uid,
  player,
  close,
}: {
  id: string;
  matchId: string;
  uid: string;
  player: Player;
  close: (saved: boolean) => void;
}) {
  const query = useQuery({
    queryKey: ["club-player-match-stats", id, matchId, player.id, uid],
    gcTime: 0,
    staleTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      await requireAttendanceAdmin(id, uid);
      const r = await supabase
        .from("match_player_stats")
        .select("*")
        .eq("match_id", matchId)
        .eq("player_id", player.id)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data as Record<string, any> | null;
    },
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <>
        <ErrorState error={query.error} retry={() => void query.refetch()} />
        <Button
          title="Revenir aux joueurs"
          secondary
          onPress={() => close(false)}
        />
      </>
    );
  return (
    <StatsForm
      id={id}
      matchId={matchId}
      uid={uid}
      player={player}
      record={query.data ?? null}
      close={close}
    />
  );
}
function StatsForm({
  id,
  matchId,
  uid,
  player,
  record,
  close,
}: {
  id: string;
  matchId: string;
  uid: string;
  player: Player;
  record: Record<string, any> | null;
  close: (saved: boolean) => void;
}) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [recordId] = useState(() => record?.id || randomUUID());
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map(([key]) => [key, String(record?.[key] ?? 0)]),
    ),
  );
  const [proposal, setProposal] = useState<Record<string, any> | null>(null);
  const [validation, setValidation] = useState<unknown>(null);
  const save = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      await requireAttendanceAdmin(id, uid);
      const r = await supabase.rpc("save_native_match_player_stats", {
        p_id: recordId,
        p_match_id: matchId,
        p_player_id: player.id,
        p_values: payload,
        p_expected: record,
      });
      if (r.error) throw r.error;
      if (r.data !== recordId)
        throw new Error(
          "L’enregistrement n’a pas pu être confirmé. Rechargez la fiche du joueur.",
        );
    },
    onSuccess: () => {
      void cache.invalidateQueries({
        queryKey: ["club-match-mvp-candidates", id, matchId],
      });
      void cache.invalidateQueries({
        queryKey: ["club-match-contributors", id, matchId],
      });
      void cache.invalidateQueries({ queryKey: ["club-native-stats", id] });
      void cache.invalidateQueries({ queryKey: ["club-member-stats", id] });
      void cache.invalidateQueries({
        queryKey: ["club-player-match-stats", id, matchId, player.id],
      });
      close(true);
    },
  });
  return (
    <>
      <Text style={s.h2}>{player.name}</Text>
      {fields.map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={values[key]}
          keyboardType="number-pad"
          editable={!proposal && !save.isPending}
          onChangeText={(value) =>
            setValues((old) => ({ ...old, [key]: value }))
          }
        />
      ))}
      {!!validation && <ErrorState error={validation} />}
      {!!save.error && <ErrorState error={save.error} />}
      {proposal ? (
        <>
          <Text style={s.text}>
            Confirmer ces statistiques pour {player.name} ?
          </Text>
          <Button
            title="Confirmer l’enregistrement"
            busy={save.isPending}
            onPress={() => save.mutate(proposal)}
          />
          <Button
            title="Modifier les valeurs"
            secondary
            disabled={save.isPending}
            onPress={() => {
              setProposal(null);
              save.reset();
            }}
          />
        </>
      ) : (
        <Button
          title="Vérifier avant enregistrement"
          onPress={() => {
            try {
              setValidation(null);
              setProposal(
                Object.fromEntries(
                  fields.map(([key, label]) => [
                    key,
                    clubFieldValue(
                      { key, label, type: "number", required: true },
                      values[key],
                    ),
                  ]),
                ),
              );
            } catch (error) {
              setValidation(error);
            }
          }}
        />
      )}
      <Button
        title="Revenir aux joueurs"
        secondary
        disabled={save.isPending}
        onPress={() => close(false)}
      />
    </>
  );
}
