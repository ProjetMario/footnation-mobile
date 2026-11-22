import { Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Empty, ErrorState, Loading, useUIStyles } from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

type Row = { player_id: string; player_name: string; record_id: string | null; attendance: string | null; notes: string | null };
export default function CoachSessionAttendance({ id, sessionId, close }: { id: string; sessionId: string; close: () => void }) {
  const styles = useUIStyles();
  const uid = useAuth().session!.user.id;
  const cache = useQueryClient();
  const key = ["coach-session-attendance", id, sessionId, uid];
  const query = useQuery({ queryKey: key, queryFn: async () => {
    const result = await supabase.rpc("get_native_coach_session_attendance", { p_club_id: id, p_session_id: sessionId });
    if (result.error) throw result.error;
    return result.data as Row[];
  }});
  const save = useMutation({ mutationFn: async ({ row, status }: { row: Row; status: "present" | "absent" }) => {
    const result = await supabase.rpc("set_native_coach_session_attendance", {
      p_club_id: id, p_session_id: sessionId, p_player_id: row.player_id, p_status: status,
      p_expected: row.record_id ? { id: row.record_id, status: row.attendance, notes: row.notes } : null,
    });
    if (result.error) throw result.error;
  }, onSettled: () => { void cache.invalidateQueries({ queryKey: key }); void cache.invalidateQueries({ queryKey: ["club-attendance-records", id] }); void cache.invalidateQueries({ queryKey: ["club-attendance-summary", id] }); void cache.invalidateQueries({ queryKey: ["convocation-attendance", id] }); }});
  return <>
    <Button title="Retour aux séances" secondary onPress={close} />
    <Text style={styles.h2}>Présences de la séance</Text>
    {!!query.isPending && <Loading />}
    {!!query.error && <ErrorState error={query.error} retry={() => void query.refetch()} />}
    {!!save.error && <ErrorState error={save.error} />}
    {query.data?.map((row) => <View style={styles.card} key={row.player_id}>
      <Text style={styles.h2}>{row.player_name}</Text>
      <Text style={styles.text}>Pointage : {({ present: "Présent", absent: "Absent", late: "En retard", excused: "Excusé", injured: "Blessé" } as Record<string, string>)[row.attendance || ""] || "Non renseigné"}</Text>
      <View style={styles.row}>
        <Button title="Présent" secondary={row.attendance !== "present"} disabled={save.isPending || query.isFetching} onPress={() => save.mutate({ row, status: "present" })} />
        <Button title="Absent" secondary={row.attendance !== "absent"} disabled={save.isPending || query.isFetching} onPress={() => save.mutate({ row, status: "absent" })} />
      </View>
    </View>)}
    {!!query.data && !query.data.length && <Empty title="Aucun joueur admissible pour cette séance" />}
  </>;
}
