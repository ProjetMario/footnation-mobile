import ClubAttendanceEntry from "./ClubAttendanceEntry";
import ClubAttendanceSessions, {
  requireAttendanceAdmin,
} from "./ClubAttendanceSessions";
import { attendanceTypes as types } from "../lib/attendanceSession";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  loadClubAttendanceSummary,
  type AttendanceSummaryRow,
} from "../lib/clubAttendanceSummary";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Button,
  Chip,
  Empty,
  ErrorState,
  Loading,
  SearchField,
  useUIStyles,
} from "../components/ui";
import { useThemedStyles, type ThemeColors } from "../theme";
import { ArrowLeft, Filter, Info, UserRound } from "lucide-react-native";
import { useAuth } from "../lib/auth";
import { searchPattern, useDebounced } from "../lib/data";
import { supabase } from "../lib/supabase";
const statuses = {
  present: "Présent",
  absent: "Absent",
  late: "En retard",
  excused: "Excusé",
  injured: "Blessé",
} as const;
export default function ClubAttendance({ id }: { id: string }) {
  const s = useUIStyles();
  const styles = useThemedStyles(createAttendanceStyles);

  const { session } = useAuth();
  const { sessionId: requestedSessionId } = useLocalSearchParams<{
    sessionId?: string;
  }>();
  const [view, setView] = useState<"summary" | "events" | "tasks">("summary");
  const [pointing, setPointing] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(
    requestedSessionId || null,
  );
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const [status, setStatus] = useState("");
  const access = useQuery({
    queryKey: ["club-attendance-access", id, session?.user.id],
    queryFn: async () => {
      await requireAttendanceAdmin(id, session!.user.id);
      return true;
    },
  });
  const request = (selected: string, head = false) => {
    let q = supabase
      .from("club_attendance_records")
      .select(
        "id,status,notes,created_at,session:club_attendance_sessions!session_id!inner(club_id,category,session_type,session_date),player:club_players!player_id!inner(name)",
        { count: "exact", head },
      )
      .eq("session.club_id", id);
    if (selectedSession) q = q.eq("session_id", selectedSession);
    if (term) q = q.ilike("player.name", searchPattern(term));
    if (selected) q = q.eq("status", selected);
    return q;
  };
  const records = useInfiniteQuery({
    queryKey: [
      "club-attendance-records",
      id,
      session?.user.id,
      term,
      status,
      selectedSession,
    ],
    enabled: !!access.data && !access.error,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const r = await request(status)
        .order("session(session_date)", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (r.error) throw r.error;
      return { rows: r.data as any[], count: r.count || 0 };
    },
    getNextPageParam: (last, pages) =>
      last.rows.length === 30 ? pages.length * 30 : undefined,
  });
  const counts = useQuery({
    queryKey: [
      "club-attendance-counts",
      id,
      session?.user.id,
      term,
      selectedSession,
    ],
    enabled: !!access.data && !access.error,
    queryFn: async () =>
      Object.fromEntries(
        await Promise.all(
          Object.keys(statuses).map(async (key) => {
            const r = await request(key, true);
            if (r.error) throw r.error;
            return [key, r.count || 0];
          }),
        ),
      ),
  });
  const summary = useQuery({
    queryKey: [
      "club-attendance-summary",
      id,
      session?.user.id,
      selectedSession,
    ],
    enabled: !!access.data && !access.error,
    queryFn: () =>
      loadClubAttendanceSummary(id, selectedSession, () =>
        requireAttendanceAdmin(id, session!.user.id),
      ),
  });
  if (access.isPending) return <Loading />;
  if (access.error)
    return (
      <ErrorState error={access.error} retry={() => void access.refetch()} />
    );
  if (pointing && selectedSession)
    return (
      <ClubAttendanceEntry
        key={`${id}:${selectedSession}:${session!.user.id}`}
        id={id}
        sessionId={selectedSession}
        close={() => setPointing(false)}
      />
    );
  if (showSessions)
    return (
      <>
        <ClubAttendanceSessions
          key={`${id}:${session!.user.id}`}
          id={id}
          onBack={() => setShowSessions(false)}
          onOpen={(sessionId) => {
            setSelectedSession(sessionId);
            setSearch("");
            setStatus("");
            setShowSessions(false);
          }}
        />
      </>
    );
  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => setShowSessions(true)}
          style={styles.roundButton}
        >
          <ArrowLeft size={26} color="#06111D" />
        </Pressable>
        <Text style={styles.headerTitle}>Présences</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filtres"
          onPress={() => setShowSessions(true)}
          style={styles.roundButton}
        >
          <Filter size={24} color="#06111D" />
        </Pressable>
      </View>
      <View style={styles.tabs}>
        <AttendanceTab
          label="Bilan"
          selected={view === "summary"}
          onPress={() => setView("summary")}
        />
        <AttendanceTab
          label="Par événements"
          selected={view === "events"}
          onPress={() => setView("events")}
        />
        <AttendanceTab
          label="Par tâches"
          selected={view === "tasks"}
          onPress={() => setView("tasks")}
        />
      </View>
      <View style={styles.tools}>
        <Button
          title="Séances et création"
          secondary
          onPress={() => setShowSessions(true)}
        />
        {!!selectedSession && (
          <Button title="Pointer un joueur" onPress={() => setPointing(true)} />
        )}
        {!!selectedSession && (
          <Button
            title="Toutes les séances"
            secondary
            onPress={() => setSelectedSession(null)}
          />
        )}
      </View>
      {view === "events" && (
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un joueur"
        />
      )}
      {view === "events" && (
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <Chip label="Tous" selected={!status} onPress={() => setStatus("")} />
          {Object.entries(statuses).map(([key, label]) => (
            <Chip
              key={key}
              selected={status === key}
              label={`${label}${counts.data ? ` · ${counts.data[key]}` : ""}`}
              onPress={() => setStatus(key)}
            />
          ))}
        </View>
      )}
      <Button
        title="Actualiser"
        secondary
        busy={records.isFetching || counts.isFetching || summary.isFetching}
        onPress={() => {
          void records.refetch();
          void counts.refetch();
          void summary.refetch();
          void access.refetch();
        }}
      />
      {!!(!!counts.error && view === "events") && (
        <ErrorState error={counts.error} retry={() => void counts.refetch()} />
      )}
      {!!(!!summary.error && view === "summary") && (
        <ErrorState
          error={summary.error}
          retry={() => void summary.refetch()}
        />
      )}
      {!!(view === "summary" && summary.isPending) && <Loading />}
      {!!(view === "summary" && summary.data) && (
        <AttendanceSummaryTable
          rows={summary.data.rows}
          eventCount={summary.data.eventCount}
          styles={styles}
        />
      )}
      {view === "tasks" && (
        <Empty
          title="Aucune tâche de présence"
          description="Les tâches staff liées aux présences seront affichées ici."
        />
      )}
      {!!(view === "events" && records.isPending) && <Loading />}
      {!!(!!records.error && view === "events") && (
        <ErrorState
          error={records.error}
          retry={() => void records.refetch()}
        />
      )}
      {!!(!!records.data && view === "events") && (
        <Text style={s.small}>
          {records.data.pages[0].count} relevés trouvés
        </Text>
      )}
      {view === "events" &&
        records.data?.pages
          .flatMap((page) => page.rows)
          .map((row) => (
            <View key={row.id} style={s.card}>
              <Text style={s.h2}>{row.player?.name || "Joueur"}</Text>
              <Text style={s.text}>
                {statuses[row.status as keyof typeof statuses] || row.status}
              </Text>
              <Text style={s.subtitle}>
                {types[row.session?.session_type] || row.session?.session_type}{" "}
                · {new Date(row.session.session_date).toLocaleString("fr-FR")}
              </Text>
              {!!row.session?.category && (
                <Text style={s.subtitle}>
                  Catégorie : {row.session.category}
                </Text>
              )}
              {!!row.notes && (
                <Text selectable style={s.text}>
                  {row.notes}
                </Text>
              )}
            </View>
          ))}
      {!!(
        view === "events" &&
        !!(
          records.data &&
          !records.data.pages.flatMap((page) => page.rows).length
        )
      ) && (
        <Empty
          title="Aucune présence trouvée"
          description="Modifiez les filtres ou vérifiez que des séances ont été renseignées."
        />
      )}
      {!!(view === "events" && !!records.hasNextPage) && (
        <Button
          title="Charger la suite"
          busy={records.isFetchingNextPage}
          onPress={() => void records.fetchNextPage()}
        />
      )}
    </View>
  );
}

function AttendanceTab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[attendanceTabBase.tab, selected && attendanceTabBase.selected]}
    >
      <Text
        style={[
          attendanceTabBase.text,
          selected && attendanceTabBase.selectedText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AttendanceSummaryTable({
  rows,
  eventCount,
  styles,
}: {
  rows: AttendanceSummaryRow[];
  eventCount: number;
  styles: ReturnType<typeof createAttendanceStyles>;
}) {
  return (
    <View style={styles.summaryWrap}>
      <View style={styles.summaryTop}>
        <Text style={styles.summaryTitle}>
          {eventCount} événement{eventCount > 1 ? "s" : ""}
        </Text>
        <Info size={24} color="#98A2B3" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.tableHeader}>
            <View style={styles.playerHeader} />
            <Text style={[styles.colHeader, styles.blueHeader]}>Pointages</Text>
            <Text style={[styles.colHeader, styles.greenHeader]}>
              Présences
            </Text>
            <Text style={[styles.colHeader, styles.redHeader]}>Absences</Text>
            <Text style={[styles.colHeader, styles.orangeHeader]}>Autres</Text>
          </View>
          <View style={styles.iconHeader}>
            <View style={styles.playerHeader} />
            <Text style={styles.iconCell}>✓</Text>
            <Text style={styles.iconCell}>✓</Text>
            <Text style={styles.iconCell}>◷</Text>
            <Text style={styles.iconCell}>×</Text>
            <Text style={styles.iconCell}>T</Text>
            <Text style={styles.iconCell}>⊘</Text>
          </View>
          {rows.map((row, index) => (
            <View key={row.id || row.name} style={styles.tableRow}>
              <View style={styles.playerCell}>
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={styles.avatarMini}>
                  <UserRound size={18} color="#98A2B3" />
                </View>
                <Text numberOfLines={1} style={styles.playerName}>
                  {row.name}
                </Text>
              </View>
              <Text style={styles.valueCell}>{row.recordings || "-"}</Text>
              <Text style={styles.valueCell}>{row.present || "-"}</Text>
              <Text style={styles.valueCell}>{row.late || "-"}</Text>
              <Text style={styles.valueCell}>{row.absent || "-"}</Text>
              <Text style={styles.valueCell}>{row.excused || "-"}</Text>
              <Text style={styles.valueCell}>
                {row.injured + row.other || "-"}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {!rows.length && <Empty title="Aucun joueur actif" />}
    </View>
  );
}

const attendanceTabBase = StyleSheet.create({
  tab: {
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  selected: { backgroundColor: "#5BD274" },
  text: {
    fontFamily: "Inter-Regular",
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  selectedText: { color: "#FFFFFF" },
});

const createAttendanceStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    page: {
      marginHorizontal: -20,
      marginTop: -20,
      paddingBottom: 24,
      backgroundColor: colors.background,
      minHeight: 720,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 24,
      backgroundColor: "#061A43",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: {
      fontFamily: "Inter-Bold",
      fontSize: 21,
      color: "#FFFFFF",
      fontWeight: "900",
    },
    roundButton: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.62)",
    },
    tabs: {
      paddingHorizontal: 12,
      paddingBottom: 20,
      backgroundColor: "#061A43",
      flexDirection: "row",
      gap: 10,
    },
    tools: {
      padding: 20,
      gap: 12,
    },
    summaryWrap: {
      backgroundColor: colors.background,
      gap: 0,
    },
    summaryTop: {
      paddingHorizontal: 22,
      paddingVertical: 18,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    summaryTitle: {
      fontFamily: "Inter-Bold",
      fontSize: 22,
      color: colors.ink,
      fontWeight: "900",
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    playerHeader: {
      width: 280,
      backgroundColor: colors.surface,
    },
    colHeader: {
      width: 150,
      paddingVertical: 18,
      textAlign: "center",
      fontFamily: "Inter-Regular",
      fontSize: 16,
      color: colors.muted,
    },
    blueHeader: { backgroundColor: "#F0F4F8" },
    greenHeader: { backgroundColor: "#DDF7D7" },
    redHeader: { backgroundColor: "#FAD7D7" },
    orangeHeader: { backgroundColor: "#FFF1D6" },
    iconHeader: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconCell: {
      width: 75,
      paddingVertical: 13,
      textAlign: "center",
      fontFamily: "Inter-Bold",
      fontSize: 15,
      color: colors.muted,
      fontWeight: "900",
    },
    tableRow: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
    },
    playerCell: {
      width: 280,
      minHeight: 58,
      paddingHorizontal: 14,
      backgroundColor: "#EEF1F6",
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    rank: {
      width: 24,
      fontFamily: "Inter-Regular",
      fontSize: 14,
      color: "#98A2B3",
      textAlign: "right",
    },
    avatarMini: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },
    playerName: {
      flex: 1,
      fontFamily: "Inter-Regular",
      fontSize: 16,
      color: colors.ink,
      fontWeight: "700",
    },
    valueCell: {
      width: 75,
      textAlign: "center",
      fontFamily: "Inter-Bold",
      fontSize: 18,
      color: colors.ink,
      fontWeight: "900",
    },
  });
