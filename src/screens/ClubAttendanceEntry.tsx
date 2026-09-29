import { useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  SearchField,
  useUIStyles,
} from "../components/ui";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { searchPattern, useDebounced } from "../lib/data";
import { requireAttendanceAdmin } from "./ClubAttendanceSessions";
export const attendanceStatuses: Record<string, string> = {
  present: "Présent",
  absent: "Absent",
  late: "En retard",
  excused: "Excusé",
  injured: "Blessé",
};
type Player = {
  id: string;
  name: string;
  category: string;
  is_active: boolean | null;
};
type RecordRow = {
  id: string;
  session_id: string;
  player_id: string;
  status: string;
  notes: string | null;
};
export default function ClubAttendanceEntry({
  id,
  sessionId,
  close,
}: {
  id: string;
  sessionId: string;
  close: () => void;
}) {
  const s = useUIStyles();

  const uid = useAuth().session!.user.id;
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const [player, setPlayer] = useState<Player | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["attendance-player-picker", id, uid, term],
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
        .range(pageParam, pageParam + 29);
      if (r.error) throw r.error;
      return r.data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  if (player)
    return (
      <EntryLoader
        key={`${uid}:${sessionId}:${player.id}`}
        id={id}
        uid={uid}
        sessionId={sessionId}
        player={player}
        close={() => setPlayer(null)}
      />
    );
  return (
    <>
      <Text style={s.h2}>Pointer un joueur</Text>
      <Button title="Revenir aux présences" secondary onPress={close} />
      <SearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher un joueur du club"
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages.flat().map((p) => (
        <View style={s.card} key={p.id}>
          <Text style={s.h2}>{p.name}</Text>
          <Text style={s.subtitle}>
            {p.category}
            {p.is_active === false ? " · Inactif" : ""}
          </Text>
          <Button title="Renseigner la présence" onPress={() => setPlayer(p)} />
        </View>
      ))}
      {!!(query.data && !query.data.pages.flat().length) && (
        <Empty title="Aucun joueur trouvé dans ce club" />
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
function EntryLoader({
  id,
  uid,
  sessionId,
  player,
  close,
}: {
  id: string;
  uid: string;
  sessionId: string;
  player: Player;
  close: () => void;
}) {
  const query = useQuery({
    queryKey: ["attendance-entry", sessionId, player.id, uid],
    gcTime: 0,
    staleTime: Infinity,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      await requireAttendanceAdmin(id, uid);
      const session = await supabase
        .from("club_attendance_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("club_id", id)
        .single();
      if (session.error) throw session.error;
      const r = await supabase
        .from("club_attendance_records")
        .select("id,session_id,player_id,status,notes")
        .eq("session_id", sessionId)
        .eq("player_id", player.id)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data;
    },
  });
  if (query.isFetching) return <Loading />;
  if (query.error)
    return (
      <>
        <ErrorState error={query.error} retry={() => void query.refetch()} />
        <Button title="Retour aux joueurs" secondary onPress={close} />
      </>
    );
  if (query.isPending) return <Loading />;
  return (
    <EntryForm
      id={id}
      uid={uid}
      sessionId={sessionId}
      player={player}
      record={query.data}
      close={close}
    />
  );
}
function EntryForm({
  id,
  uid,
  sessionId,
  player,
  record,
  close,
}: {
  id: string;
  uid: string;
  sessionId: string;
  player: Player;
  record: RecordRow | null;
  close: () => void;
}) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [baseline] = useState(record);
  const [key] = useState(() => record?.id || randomUUID());
  const [status, setStatus] = useState(record?.status || "");
  const [notes, setNotes] = useState(record?.notes || "");
  const save = useMutation({
    mutationFn: async () => {
      if (!Object.hasOwn(attendanceStatuses, status))
        throw new Error("Choisissez un statut de présence.");
      if (notes.trim().length > 3000)
        throw new Error("Les notes sont limitées à 3 000 caractères.");
      await requireAttendanceAdmin(id, uid);
      const r = await supabase.rpc("save_native_attendance_record", {
        p_id: key,
        p_session_id: sessionId,
        p_player_id: player.id,
        p_status: status,
        p_notes: notes.trim() || null,
        p_expected: baseline,
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      for (const prefix of [
        "club-attendance-records",
        "club-attendance-counts",
        "club-attendance-summary",
        "club-member-attendance",
      ])
        void cache.invalidateQueries({ queryKey: [prefix, id] });
      close();
    },
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useMutation({
    mutationFn: async () => {
      if (!baseline || !confirmDelete)
        throw new Error("Confirmez la suppression.");
      await requireAttendanceAdmin(id, uid);
      const r = await supabase.rpc("delete_native_attendance_record", {
        p_id: baseline.id,
        p_session_id: sessionId,
        p_expected: baseline,
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      for (const prefix of [
        "club-attendance-records",
        "club-attendance-counts",
        "club-attendance-summary",
        "club-member-attendance",
      ])
        void cache.invalidateQueries({ queryKey: [prefix, id] });
      close();
    },
  });
  const busy = save.isPending || remove.isPending;
  return (
    <>
      <Text style={s.h2}>{player.name}</Text>
      <Text style={s.subtitle}>
        {baseline ? "Modifier le pointage" : "Nouveau pointage"}
      </Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(attendanceStatuses).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={status === key}
            disabled={busy}
            onPress={() => setStatus(key)}
          />
        ))}
      </View>
      <Field
        label="Notes (facultatif)"
        value={notes}
        onChangeText={setNotes}
        editable={!busy}
        maxLength={3000}
        multiline
      />
      {!!save.error && <ErrorState error={save.error} />}
      <Button
        title="Enregistrer le pointage"
        disabled={confirmDelete || remove.isPending}
        busy={save.isPending}
        onPress={() => save.mutate()}
      />
      {!!baseline &&
        (confirmDelete ? (
          <>
            <Text style={s.text}>
              Supprimer définitivement le pointage enregistré pour ce joueur
              dans cette séance ? Les modifications non enregistrées seront
              abandonnées.
            </Text>
            <Button
              title="Confirmer la suppression"
              busy={remove.isPending}
              disabled={save.isPending}
              onPress={() => remove.mutate()}
            />
            <Button
              title="Conserver le pointage"
              secondary
              disabled={busy}
              onPress={() => {
                setConfirmDelete(false);
                remove.reset();
              }}
            />
          </>
        ) : (
          <Button
            title="Supprimer le pointage"
            secondary
            disabled={busy}
            onPress={() => setConfirmDelete(true)}
          />
        ))}
      {!!remove.error && <ErrorState error={remove.error} />}
      <Button title="Annuler" secondary disabled={busy} onPress={close} />
    </>
  );
}
