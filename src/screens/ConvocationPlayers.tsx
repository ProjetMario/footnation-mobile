import React, { useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useLocalSearchParams } from "expo-router";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { ClubAdminGate } from "./ClubAdmin";
import { requireAttendanceAdmin } from "./ClubAttendanceSessions";
import { useAuth } from "../lib/auth";
import { useDebounced } from "../lib/data";
import { createProContent } from "../lib/proContentSave";
import { supabase } from "../lib/supabase";
import {
  Button,
  Chip,
  Empty,
  ErrorState,
  Loading,
  Screen,
  SearchField,
  useUIStyles,
} from "../components/ui";
type Candidate = { id: string; name: string; category: string };
type Action =
  | { kind: "add"; player: Candidate; key: string }
  | { kind: "remove"; row: Record<string, any> }
  | { kind: "team"; teamId: string | null; expected: string | null };
export default function ConvocationPlayers() {
  const { id, convocation } = useLocalSearchParams<{
    id: string;
    convocation: string;
  }>();
  const uid = useAuth().session?.user.id;
  return (
    <Screen title="Joueurs convoqués">
      <ClubAdminGate id={id}>
        <Players
          key={`${uid}:${id}:${convocation}`}
          id={id}
          convocation={convocation}
        />
      </ClubAdminGate>
    </Screen>
  );
}
function Players({ id, convocation }: { id: string; convocation: string }) {
  const s = useUIStyles();

  const uid = useAuth().session!.user.id;
  const cache = useQueryClient();
  const [team, setTeam] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const [action, setAction] = useState<Action | null>(null);
  const parent = useQuery({
    queryKey: ["convocation-roster", id, convocation, uid, "header"],
    queryFn: async () => {
      await requireAttendanceAdmin(id, uid);
      const r = await supabase
        .from("club_convocations")
        .select("id,title,team_id")
        .eq("id", convocation)
        .eq("club_id", id)
        .single();
      if (r.error) throw r.error;
      const teams: { id: string; name: string }[] = [];
      for (let offset = 0; ; offset += 100) {
        const t = await supabase
          .from("teams")
          .select("id,name")
          .eq("club_id", id)
          .order("name")
          .order("id")
          .range(offset, offset + 99);
        if (t.error) throw t.error;
        teams.push(...t.data);
        if (t.data.length < 100) break;
      }
      return { record: r.data, teams };
    },
  });
  const selected = team ?? parent.data?.record.team_id ?? "";
  const invited = useInfiniteQuery({
    queryKey: ["convocation-roster", id, convocation, uid, "invited"],
    enabled: !!parent.data && !parent.error,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      await requireAttendanceAdmin(id, uid);
      const r = await supabase
        .from("club_convocation_players")
        .select(
          "id,convocation_id,player_id,status,responded_at,notes,created_at,player:club_players!player_id(name)",
        )
        .eq("convocation_id", convocation)
        .order("created_at")
        .order("id")
        .range(pageParam, pageParam + 29);
      if (r.error) throw r.error;
      return r.data as any[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const candidates = useInfiniteQuery({
    queryKey: [
      "convocation-roster",
      id,
      convocation,
      uid,
      "candidates",
      selected,
      term,
    ],
    enabled: !!parent.data && !parent.error,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      await requireAttendanceAdmin(id, uid);
      const r = await supabase.rpc("get_native_convocation_candidates", {
        p_club_id: id,
        p_convocation_id: convocation,
        p_team_id: selected || null,
        p_search: term,
        p_offset: pageParam,
      });
      if (r.error) throw r.error;
      return r.data as Candidate[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error("Confirmez une action.");
      await requireAttendanceAdmin(id, uid);
      const current = await supabase
        .from("club_convocations")
        .select("id")
        .eq("id", convocation)
        .eq("club_id", id)
        .single();
      if (current.error) throw current.error;
      if (action.kind === "remove") {
        const { player, ...snapshot } = action.row;
        const r = await supabase.rpc("delete_native_convocation_player", {
          p_id: snapshot.id,
          p_convocation_id: convocation,
          p_expected: snapshot,
        });
        if (r.error) throw r.error;
      } else if (action.kind === "team") {
        if (action.teamId) {
          const valid = await supabase
            .from("teams")
            .select("id")
            .eq("id", action.teamId)
            .eq("club_id", id)
            .single();
          if (valid.error) throw valid.error;
        }
        let q = supabase
          .from("club_convocations")
          .update({ team_id: action.teamId })
          .eq("id", convocation)
          .eq("club_id", id);
        q =
          action.expected === null
            ? q.is("team_id", null)
            : q.eq("team_id", action.expected);
        const r = await q.select("id").maybeSingle();
        if (r.error) throw r.error;
        if (!r.data)
          throw new Error(
            "L’équipe associée a changé. Actualisez avant de réessayer.",
          );
      } else {
        await createProContent(
          {
            read: async (key) => {
              const r = await supabase
                .from("club_convocation_players")
                .select("id,convocation_id,player_id")
                .eq("id", key)
                .eq("convocation_id", convocation)
                .maybeSingle();
              if (r.error) throw r.error;
              return r.data;
            },
            insert: async (row) => {
              const r = await supabase
                .from("club_convocation_players")
                .insert({ ...row, status: "pending" });
              if (r.error) throw r.error;
            },
          },
          {
            id: action.key,
            convocation_id: convocation,
            player_id: action.player.id,
          },
        );
      }
    },
    onSuccess: () => {
      setAction(null);
      void cache.invalidateQueries({
        queryKey: ["convocation-roster", id, convocation],
      });
      void cache.invalidateQueries({ queryKey: ["member-space"] });
      void cache.invalidateQueries({ queryKey: ["club-member-rows", id] });
      void cache.invalidateQueries({
        queryKey: ["club-admin-records", id, "convocations"],
      });
      void cache.invalidateQueries({ queryKey: ["club-coach-kit", id] });
      void cache.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  if (parent.isPending) return <Loading />;
  if (parent.error)
    return (
      <ErrorState error={parent.error} retry={() => void parent.refetch()} />
    );
  const refresh = () => {
    setAction(null);
    mutation.reset();
    void parent.refetch();
    void invited.refetch();
    void candidates.refetch();
  };
  return (
    <>
      <Text style={s.h2}>{parent.data.record.title}</Text>
      <Button
        title="Actualiser"
        secondary
        disabled={mutation.isPending}
        busy={parent.isFetching || invited.isFetching || candidates.isFetching}
        onPress={refresh}
      />
      <Text style={s.label}>Filtrer les joueurs par équipe</Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Chip
          label="Tout l’effectif actif"
          selected={!selected}
          disabled={mutation.isPending}
          onPress={() => {
            setAction(null);
            setTeam("");
          }}
        />
        {parent.data.teams.map((t) => (
          <Chip
            key={t.id}
            label={t.name}
            selected={selected === t.id}
            disabled={mutation.isPending}
            onPress={() => {
              setAction(null);
              setTeam(t.id);
            }}
          />
        ))}
      </View>
      {!!(team !== null && (team || null) !== parent.data.record.team_id) && (
        <Button
          title={team ? "Associer cette équipe" : "Dissocier l’équipe"}
          secondary
          disabled={mutation.isPending}
          onPress={() =>
            setAction({
              kind: "team",
              teamId: team || null,
              expected: parent.data.record.team_id,
            })
          }
        />
      )}
      {!!action && (
        <View style={s.card}>
          <Text style={s.text}>
            {action.kind === "add"
              ? `Convoquer ${action.player.name} ?`
              : action.kind === "remove"
                ? `Retirer la convocation de ${action.row.player?.name || "ce joueur"} et sa réponse ?`
                : "Modifier l’équipe associée ? Les joueurs déjà convoqués seront conservés."}
          </Text>
          <Button
            title="Confirmer"
            busy={mutation.isPending}
            onPress={() => mutation.mutate()}
          />
          <Button
            title="Annuler"
            secondary
            disabled={mutation.isPending}
            onPress={() => {
              setAction(null);
              mutation.reset();
            }}
          />
        </View>
      )}
      {!!mutation.error && <ErrorState error={mutation.error} />}
      <Text style={s.h2}>Réponses des joueurs</Text>
      {!!invited.isPending && <Loading />}
      {!!invited.error && (
        <ErrorState
          error={invited.error}
          retry={() => void invited.refetch()}
        />
      )}
      {invited.data?.pages.flat().map((row) => (
        <View key={row.id} style={s.card}>
          <Text style={s.text}>{row.player?.name || "Joueur"}</Text>
          <Text style={s.subtitle}>
            {(
              {
                pending: "En attente",
                accepted: "Présent",
                declined: "Absent",
                injured: "Blessé",
                absent: "Absence renseignée",
              } as Record<string, string>
            )[row.status] || row.status}
          </Text>
          <Button
            title="Retirer la convocation"
            secondary
            disabled={mutation.isPending}
            onPress={() => {
              mutation.reset();
              setAction({ kind: "remove", row });
            }}
          />
        </View>
      ))}
      {!!(invited.data && !invited.data.pages.flat().length) && (
        <Empty title="Aucun joueur convoqué" />
      )}
      {!!invited.hasNextPage && (
        <Button
          title="Charger les réponses suivantes"
          busy={invited.isFetchingNextPage}
          disabled={mutation.isPending}
          onPress={() => void invited.fetchNextPage()}
        />
      )}
      <Text style={s.h2}>Ajouter des joueurs</Text>
      <SearchField
        value={search}
        onChangeText={(v) => {
          if (!mutation.isPending) {
            setAction(null);
            setSearch(v.slice(0, 100));
          }
        }}
        placeholder="Rechercher un joueur du club"
      />
      {!!candidates.isPending && <Loading />}
      {!!candidates.error && (
        <ErrorState
          error={candidates.error}
          retry={() => void candidates.refetch()}
        />
      )}
      {candidates.data?.pages.flat().map((player) => (
        <View key={player.id} style={s.card}>
          <Text style={s.text}>{player.name}</Text>
          <Text style={s.subtitle}>{player.category}</Text>
          <Button
            title="Convoquer"
            disabled={mutation.isPending}
            onPress={() => {
              mutation.reset();
              setAction({ kind: "add", player, key: randomUUID() });
            }}
          />
        </View>
      ))}
      {!!(candidates.data && !candidates.data.pages.flat().length) && (
        <Empty
          title="Aucun joueur disponible"
          description="Les joueurs déjà convoqués sont exclus. Pour une équipe, la fiche joueur doit être liée au compte membre de l’équipe."
        />
      )}
      {!!candidates.hasNextPage && (
        <Button
          title="Charger les joueurs suivants"
          busy={candidates.isFetchingNextPage}
          disabled={mutation.isPending}
          onPress={() => void candidates.fetchNextPage()}
        />
      )}
    </>
  );
}
