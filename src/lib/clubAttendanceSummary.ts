import { supabase } from "./supabase";

type AttendancePlayer = { id: string; name: string };
type AttendanceRecord = {
  id: string;
  player_id: string;
  session_id: string;
  status: string;
  player: { name: string } | null;
};
export type AttendanceSummaryRow = AttendancePlayer & {
  recordings: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  injured: number;
  other: number;
};

export function attendanceSummary(
  players: AttendancePlayer[],
  records: AttendanceRecord[],
) {
  const rows = new Map<string, AttendanceSummaryRow>();
  const events = new Set<string>();
  const seen = new Set<string>();
  const addPlayer = (id: string, name: string) => {
    const row: AttendanceSummaryRow = {
      id,
      name,
      recordings: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      injured: 0,
      other: 0,
    };
    rows.set(id, row);
    return row;
  };
  for (const player of players) addPlayer(player.id, player.name);
  for (const record of records) {
    // A page overlap must not count one pointage twice.
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    events.add(record.session_id);
    const row =
      rows.get(record.player_id) ||
      addPlayer(record.player_id, record.player?.name || "Joueur");
    row.recordings++;
    switch (record.status) {
      case "present":
        row.present++;
        break;
      case "late":
        row.late++;
        break;
      case "absent":
        row.absent++;
        break;
      case "excused":
        row.excused++;
        break;
      case "injured":
        row.injured++;
        break;
      default:
        row.other++;
    }
  }
  return {
    rows: [...rows.values()].sort(
      (a, b) => a.name.localeCompare(b.name, "fr") || a.id.localeCompare(b.id),
    ),
    eventCount: events.size,
  };
}

export async function loadClubAttendanceSummary(
  clubId: string,
  sessionId: string | null,
  authorize: () => Promise<void>,
) {
  const players: AttendancePlayer[] = [];
  const records: AttendanceRecord[] = [];
  for (let offset = 0; ; offset += 500) {
    await authorize();
    const result = await supabase
      .from("club_players")
      .select("id,name")
      .eq("club_id", clubId)
      .eq("is_active", true)
      .order("id")
      .range(offset, offset + 499);
    if (result.error) throw result.error;
    players.push(...result.data);
    if (result.data.length < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    await authorize();
    let query = supabase
      .from("club_attendance_records")
      .select(
        "id,player_id,session_id,status,player:club_players!player_id(name),session:club_attendance_sessions!session_id!inner(club_id)",
      )
      .eq("session.club_id", clubId)
      .order("id");
    if (sessionId) query = query.eq("session_id", sessionId);
    const result = await query.range(offset, offset + 499);
    if (result.error) throw result.error;
    records.push(...(result.data as unknown as AttendanceRecord[]));
    if (result.data.length < 500) break;
  }
  return attendanceSummary(players, records);
}
