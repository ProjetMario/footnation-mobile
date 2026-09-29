import { useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  useUIStyles,
} from "../components/ui";
import { DateField } from "../components/DateField";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  attendanceSessionPayload,
  attendanceTypes,
} from "../lib/attendanceSession";
import { createProContent } from "../lib/proContentSave";
import { EventTeamField } from "../components/EventTeamField";
import {
  loadCalendarEditorContext,
  requireCalendarEventAccess,
} from "../lib/calendarManagement";
export async function requireAttendanceAdmin(id: string, uid: string) {
  const user = await supabase.auth.getUser();
  if (user.error) throw user.error;
  if (user.data.user?.id !== uid)
    throw new Error("La session a changé. Rechargez cet écran.");
  const access = await supabase.rpc("is_fff_club_admin", { p_club_id: id });
  if (access.error) throw access.error;
  if (access.data !== true)
    throw new Error("Cet espace est réservé aux administrateurs du club.");
}
export default function ClubAttendanceSessions({
  id,
  onOpen,
  onBack,
}: {
  id: string;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const s = useUIStyles();

  const uid = useAuth().session!.user.id;
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["club-attendance-sessions", id, uid],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const editor = await loadCalendarEditorContext(id, uid);
      let request = supabase
        .from("club_attendance_sessions")
        .select(
          "id,club_id,category,session_type,session_date,notes,created_by,created_at,team_id",
          {
            count: "exact",
          },
        )
        .eq("club_id", id)
        .order("session_date", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (!editor.clubAllowed)
        request = request.in(
          "team_id",
          editor.teams.map((team) => team.id),
        );
      const [r, attendanceAccess] = await Promise.all([
        request,
        supabase.rpc("is_fff_club_admin", { p_club_id: id }),
      ]);
      if (r.error) throw r.error;
      return {
        rows: r.data,
        count: r.count || 0,
        canViewAttendance:
          !attendanceAccess.error && attendanceAccess.data === true,
      };
    },
    getNextPageParam: (last, pages) =>
      last.rows.length === 30 ? pages.length * 30 : undefined,
  });
  if (editing)
    return (
      <SessionForm
        key={`${id}:${uid}:${editing.id || "new"}`}
        id={id}
        uid={uid}
        record={editing}
        close={() => setEditing(null)}
      />
    );
  return (
    <>
      <Button title="Revenir aux relevés" secondary onPress={onBack} />
      <Text style={s.h2}>Séances du club</Text>
      <Button title="Créer une séance" onPress={() => setEditing({})} />
      <Button
        title="Actualiser les séances"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!query.data && (
        <Text style={s.small}>{query.data.pages[0].count} séances</Text>
      )}
      {query.data?.pages
        .flatMap((page) => page.rows)
        .map((row) => (
          <View style={s.card} key={row.id}>
            <Text style={s.h2}>
              {attendanceTypes[row.session_type] || row.session_type}
            </Text>
            <Text style={s.text}>
              {new Date(row.session_date).toLocaleString("fr-FR")}
            </Text>
            {!!row.category && (
              <Text style={s.subtitle}>Catégorie : {row.category}</Text>
            )}
            {!!row.notes && (
              <Text selectable style={s.text}>
                {row.notes}
              </Text>
            )}
            <Button
              title="Modifier la séance"
              secondary
              onPress={() => setEditing(row)}
            />
            {!!query.data?.pages[0]?.canViewAttendance && (
              <Button
                title="Voir les présences de cette séance"
                secondary
                onPress={() => onOpen(row.id)}
              />
            )}
          </View>
        ))}
      {!!(query.data && !query.data.pages[0].rows.length) && (
        <Empty
          title="Aucune séance"
          description="Créez la première séance du club."
        />
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
function SessionForm({
  id,
  uid,
  record,
  close,
}: {
  id: string;
  uid: string;
  record: Record<string, any>;
  close: () => void;
}) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [key] = useState(randomUUID);
  const [type, setType] = useState(record.session_type || "training");
  const [date, setDate] = useState(record.session_date || "");
  const [category, setCategory] = useState(record.category || "");
  const [notes, setNotes] = useState(record.notes || "");
  const [teamId, setTeamId] = useState(record.team_id || "");
  const save = useMutation({
    mutationFn: async () => {
      const row = {
        id: key,
        club_id: id,
        created_by: uid,
        team_id: teamId || null,
        ...attendanceSessionPayload(type, date, category, notes),
      };
      await requireCalendarEventAccess(id, uid, teamId);
      if (record.id) {
        const r = await supabase.rpc("update_native_attendance_session", {
          p_id: record.id,
          p_club_id: id,
          p_values: {
            ...attendanceSessionPayload(type, date, category, notes),
            team_id: teamId || null,
          },
          p_expected: record,
        });
        if (r.error) throw r.error;
        return;
      }
      await createProContent(
        {
          read: async (recordId) => {
            const r = await supabase
              .from("club_attendance_sessions")
              .select(
                "id,club_id,created_by,session_type,session_date,category,notes,team_id",
              )
              .eq("id", recordId)
              .eq("club_id", id)
              .maybeSingle();
            if (r.error) throw r.error;
            return r.data;
          },
          insert: async (value) => {
            const r = await supabase
              .from("club_attendance_sessions")
              .insert(value);
            if (r.error) throw r.error;
          },
        },
        row,
      );
    },
    onSuccess: () => {
      void cache.invalidateQueries({
        queryKey: ["club-attendance-sessions", id],
      });
      void cache.invalidateQueries({
        queryKey: ["club-attendance-records", id],
      });
      void cache.invalidateQueries({
        queryKey: ["club-attendance-summary", id],
      });
      void cache.invalidateQueries({ queryKey: ["club-coach-kit", id] });
      void cache.invalidateQueries({ queryKey: ["member-calendar", id] });
      void cache.invalidateQueries({
        queryKey: ["club-member-attendance", id],
      });
      close();
    },
  });
  return (
    <>
      <Text style={s.h2}>
        {record.id ? "Modifier la séance" : "Nouvelle séance"}
      </Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(attendanceTypes).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={type === key}
            disabled={save.isPending}
            onPress={() => setType(key)}
          />
        ))}
      </View>
      <DateField
        label="Date et heure"
        value={date}
        onChange={setDate}
        disabled={save.isPending}
      />
      <EventTeamField
        clubId={id}
        value={teamId}
        disabled={save.isPending}
        onChange={(next, category) => {
          setTeamId(next);
          if (category) setCategory(category);
        }}
      />
      <Field
        label="Catégorie (facultatif)"
        value={category}
        onChangeText={setCategory}
        maxLength={100}
        editable={!save.isPending}
      />
      <Field
        label="Notes (facultatif)"
        value={notes}
        onChangeText={setNotes}
        maxLength={3000}
        multiline
        editable={!save.isPending}
      />
      {!!save.error && <ErrorState error={save.error} />}
      <Button
        title={record.id ? "Enregistrer la séance" : "Créer la séance"}
        busy={save.isPending}
        onPress={() => save.mutate()}
      />
      <Button
        title="Annuler"
        secondary
        disabled={save.isPending}
        onPress={close}
      />
    </>
  );
}
