import { useDebounced } from "../lib/data";
import ClubMemberSettings from "./ClubMemberSettings";
import ClubMemberAttendance from "./ClubMemberAttendance";
import { ClubGroupList } from "./ClubChat";
import ClubMemberStats from "./ClubMemberStats";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Banner,
  Button,
  Chip,
  Empty,
  ErrorState,
  Loading,
  Screen,
  SearchField,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { loadClubMembership } from "../lib/clubMembership";
import { attendanceTypes } from "../lib/attendanceSession";
import { useThemedStyles, type ThemeColors } from "../theme";
import { CalendarClock } from "lucide-react-native";
import {
  memberCalendarPageSize,
  uniqueCalendarEvents,
  type MemberCalendarEvent,
  type MemberCalendarPeriod,
  type MemberCalendarScope,
} from "../lib/memberCalendar";

export default function ClubMemberSpace() {
  const { id, teamId, scope } = useLocalSearchParams<{
    id: string;
    teamId?: string;
    scope?: string;
  }>();
  const uid = useAuth().session?.user.id;
  return (
    <Screen title="Espace membre du club">
      <AuthGate>
        {!!uid && (
          <Content
            key={`${uid}:${id}:${teamId || ""}:${scope || ""}`}
            id={id}
            uid={uid}
          />
        )}
      </AuthGate>
    </Screen>
  );
}
function Content({ id, uid }: { id: string; uid: string }) {
  const s = useUIStyles();
  const calendarStyles = useThemedStyles(createMemberCalendarStyles);

  const [tab, setTab] = useState("calendar");
  const context = useQuery({
    queryKey: ["club-member-context", id, uid],
    queryFn: async () => {
      const club = await supabase
        .from("fff_clubs")
        .select("id,name,short_name,logo_url")
        .eq("id", id)
        .maybeSingle();
      if (club.error) throw club.error;
      if (!club.data) throw new Error("Club introuvable.");
      return { club: club.data, ...(await loadClubMembership(id, uid)) };
    },
  });
  useFocusEffect(
    useCallback(() => {
      void context.refetch();
    }, [context.refetch]),
  );
  if (context.isPending) return <Loading />;
  if (context.error)
    return (
      <ErrorState error={context.error} retry={() => void context.refetch()} />
    );
  if (!context.data.allowed)
    return (
      <>
        <Empty
          title="Accès réservé"
          description="Cet espace est réservé aux membres approuvés ou rattachés au club."
        />
        <Button
          title="Retour à la fiche"
          onPress={() => router.replace(`/club/${id}`)}
        />
      </>
    );
  return (
    <>
      {tab === "calendar" ? (
        <View style={calendarStyles.hero}>
          <View>
            <Text style={calendarStyles.heroTitle}>Calendrier</Text>
            <Text style={calendarStyles.heroSubtitle}>
              {context.data.club.short_name || context.data.club.name}
            </Text>
          </View>
          <View style={calendarStyles.heroIcon}>
            <CalendarClock size={30} color="#FFFFFF" />
          </View>
        </View>
      ) : (
        <Banner
          eyebrow="MON CLUB"
          title={context.data.club.short_name || context.data.club.name}
          description={
            context.data.primaryTeam?.name || "Aucune équipe approuvée affectée"
          }
        />
      )}
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {[
          ["calendar", "Calendrier"],
          ["teams", "Mes équipes"],
          ["rankings", "Championnat"],
          ["roster", "Effectifs"],
          ["stats", "Statistiques"],
          ["attendance", "Présences"],
          ["messaging", "Messagerie"],
          ["settings", "Paramètres"],
        ].map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={tab === value}
            onPress={() => setTab(value)}
          />
        ))}
      </View>
      {tab === "calendar" ? (
        <MemberCalendar
          id={id}
          uid={uid}
          hasTeams={!!context.data.primaryTeam}
          clubName={context.data.club.short_name || context.data.club.name}
        />
      ) : tab === "settings" ? (
        <ClubMemberSettings id={id} uid={uid} />
      ) : tab === "attendance" ? (
        <ClubMemberAttendance id={id} uid={uid} />
      ) : tab === "messaging" ? (
        <ClubGroupList uid={uid} clubId={id} />
      ) : tab === "stats" ? (
        <ClubMemberStats id={id} uid={uid} />
      ) : (
        <MemberRows
          key={`${tab}:${context.data.primaryTeam?.id}`}
          id={id}
          uid={uid}
          tab={tab}
        />
      )}
      <Button
        secondary
        title="Retour à la fiche du club"
        onPress={() => router.push(`/club/${id}`)}
      />
    </>
  );
}
function MemberCalendar({
  id,
  uid,
  hasTeams,
  clubName,
}: {
  id: string;
  uid: string;
  hasTeams: boolean;
  clubName: string;
}) {
  const s = useUIStyles();
  const styles = useThemedStyles(createMemberCalendarStyles);
  const { teamId, scope: initialScope } = useLocalSearchParams<{
    teamId?: string;
    scope?: string;
  }>();
  const [period, setPeriod] = useState<MemberCalendarPeriod>("future");
  const [scope, setScope] = useState<MemberCalendarScope>(
    initialScope === "club" || !hasTeams ? "club" : "teams",
  );
  const [selectedTeam, setSelectedTeam] = useState(teamId || null);
  const [referenceDate, setReferenceDate] = useState(() =>
    new Date().toISOString(),
  );
  const query = useInfiniteQuery({
    queryKey: [
      "member-calendar",
      id,
      uid,
      period,
      scope,
      selectedTeam,
      referenceDate,
    ],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (auth.data.user?.id !== uid)
        throw new Error("Votre session a changé. Rouvrez le calendrier.");
      const result = await supabase.rpc("get_native_member_calendar", {
        p_club_id: id,
        p_period: period,
        p_scope: scope,
        p_team_id: scope === "teams" ? selectedTeam : null,
        p_at: referenceDate,
        p_offset: pageParam,
        p_limit: memberCalendarPageSize,
      });
      if (result.error) throw result.error;
      return result.data as MemberCalendarEvent[];
    },
    getNextPageParam: (last, _pages, offset) =>
      last.length === memberCalendarPageSize
        ? offset + memberCalendarPageSize
        : undefined,
  });
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );
  const rows = uniqueCalendarEvents(query.data?.pages || []);
  return (
    <View style={styles.calendarPage}>
      <Button
        title="Répondre à mes convocations"
        onPress={() => router.push("/member/convocations")}
      />
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {!!hasTeams && (
          <Chip
            label={selectedTeam ? "Mon équipe" : "Mes équipes"}
            selected={scope === "teams"}
            onPress={() => setScope("teams")}
          />
        )}
        <Chip
          label="Événements du club"
          selected={scope === "club"}
          onPress={() => setScope("club")}
        />
      </View>
      {!!(selectedTeam && scope === "teams") && (
        <Button
          title="Voir toutes mes équipes"
          secondary
          onPress={() => setSelectedTeam(null)}
        />
      )}
      <Text style={s.small}>
        {scope === "teams"
          ? "Les matchs et séances des équipes auxquelles vous êtes rattaché."
          : "Événements du club ou de votre catégorie, sans équipe précise."}
      </Text>
      <View style={s.row}>
        <Chip
          label="À venir"
          selected={period === "future"}
          onPress={() => setPeriod("future")}
        />
        <Chip
          label="Historique"
          selected={period === "past"}
          onPress={() => setPeriod("past")}
        />
      </View>
      <Button
        title="Actualiser le calendrier"
        secondary
        busy={query.isFetching}
        onPress={() => setReferenceDate(new Date().toISOString())}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!(!query.isPending && !query.error && !rows.length) && (
        <Empty
          title={
            period === "future"
              ? "Aucun événement à venir"
              : "Aucun événement dans l’historique"
          }
          description={
            scope === "teams"
              ? "Votre coach ajoutera ici les prochains matchs et entraînements. Consultez aussi les événements du club."
              : "Les événements du club apparaîtront ici dès leur ajout."
          }
        />
      )}
      {rows.map((row) => (
        <CalendarEventCard
          key={`${row.kind}:${row.id}`}
          row={row}
          styles={styles}
          upcoming={period === "future"}
          clubName={clubName}
        />
      ))}
      {!!query.hasNextPage && (
        <Button
          title={
            period === "future"
              ? "Voir les événements suivants"
              : "Voir les événements plus anciens"
          }
          secondary
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </View>
  );
}

function MemberRows({
  id,
  uid,
  tab,
}: {
  id: string;
  uid: string;
  tab: string;
}) {
  const s = useUIStyles();
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const query = useInfiniteQuery({
    queryKey: ["club-member-rows", id, uid, tab, term],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const access = await loadClubMembership(id, uid);
      if (!access.allowed)
        throw new Error("Vous n’avez plus accès à cet espace membre.");
      let request;
      if (tab === "teams") return access.memberships;
      if (tab === "rankings") {
        if (!access.primaryTeam) return [];
        request = supabase
          .from("team_rankings")
          .select(
            "id,season,competition_name,rank,points,played,won,drawn,lost,goals_for,goals_against,goal_difference",
          )
          .eq("team_id", access.primaryTeam.id)
          .order("season", { ascending: false });
      } else {
        const result = await supabase.rpc("get_native_member_roster", {
          p_club_id: id,
          p_search: term,
          p_offset: pageParam,
          p_limit: 30,
        });
        if (result.error) throw result.error;
        return result.data as any[];
      }
      const result = await request.order("id").range(pageParam, pageParam + 29);
      if (result.error) throw result.error;
      return result.data as any[];
    },
    getNextPageParam: (last, pages) =>
      tab !== "teams" && tab !== "calendar" && last.length === 30
        ? pages.length * 30
        : undefined,
  });
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );
  const rows = query.data?.pages.flat() || [];
  return (
    <>
      {tab === "roster" && (
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Nom, pseudo ou rôle"
        />
      )}
      <Button
        title="Actualiser"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!rows.length && (
            <Empty
              title={
                tab === "rankings"
                  ? "Aucun classement disponible pour votre équipe"
                  : "Aucun élément disponible"
              }
            />
          )}
          {tab !== "calendar" &&
            rows.map((row: any) => (
              <View key={row.id} style={s.card}>
                {tab === "teams" ? (
                  <>
                    <Text style={s.h2}>{row.team.name}</Text>
                    <Text style={s.small}>
                      {row.team.category} ·{" "}
                      {row.status === "approved"
                        ? "Approuvée"
                        : row.status === "pending"
                          ? "En attente"
                          : "Non approuvée"}
                      {row.is_primary ? " · Équipe principale" : ""}
                    </Text>
                  </>
                ) : tab === "rankings" ? (
                  <>
                    <Text style={s.h2}>
                      {row.competition_name || "Championnat"} · {row.season}
                    </Text>
                    <Text style={s.text}>
                      Rang {row.rank ?? "–"} · {row.points ?? "–"} points
                    </Text>
                    <Text style={s.small}>
                      {row.played ?? "–"} joués · {row.won ?? "–"} victoires ·{" "}
                      {row.drawn ?? "–"} nuls · {row.lost ?? "–"} défaites
                    </Text>
                    <Text style={s.small}>
                      {row.goals_for ?? "–"} buts pour ·{" "}
                      {row.goals_against ?? "–"} contre · Diff.{" "}
                      {row.goal_difference ?? "–"}
                    </Text>
                  </>
                ) : (
                  <>
                    <Avatar
                      uri={row.profile?.avatar_url}
                      name={
                        row.profile?.full_name ||
                        row.profile?.username ||
                        "Membre"
                      }
                    />
                    <Text style={s.h2}>
                      {row.profile?.full_name ||
                        row.profile?.username ||
                        "Profil indisponible"}
                    </Text>
                    <Text style={s.small}>
                      {row.team.name} · {row.role} {row.position || ""}
                      {row.jersey_number != null
                        ? ` · N° ${row.jersey_number}`
                        : ""}
                    </Text>
                    {!!row.profile?.id && (
                      <Button
                        title="Voir le profil"
                        secondary
                        onPress={() =>
                          router.push(`/profile/${row.profile.id}`)
                        }
                      />
                    )}
                  </>
                )}
              </View>
            ))}
          {!!query.hasNextPage && (
            <Button
              title="Afficher davantage"
              busy={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          )}
        </>
      )}
    </>
  );
}

type CalendarStyles = ReturnType<typeof createMemberCalendarStyles>;

function CalendarEventCard({
  row,
  styles,
  upcoming,
  clubName,
}: {
  row: any;
  styles: CalendarStyles;
  upcoming: boolean;
  clubName: string;
}) {
  const date = new Date(row.sort_date || row.match_date || row.session_date);
  const valid = Number.isFinite(date.getTime());
  const status = row.status || (upcoming ? "scheduled" : "finished");
  const isCancelled = status === "cancelled" || status === "postponed";
  const title =
    row.kind === "training"
      ? row.session_type === "training"
        ? trainingTitle(date, valid)
        : attendanceTypes[row.session_type] || "Séance d’équipe"
      : matchTitle(row, clubName);
  return (
    <View style={styles.eventCard}>
      <View style={styles.dateBlock}>
        <Text style={styles.weekday}>
          {valid ? formatPart(date, "weekday") : "—"}
        </Text>
        <Text style={styles.day}>{valid ? formatPart(date, "day") : "—"}</Text>
        <Text style={styles.month}>
          {valid ? formatPart(date, "month") : "Date"}
        </Text>
        <Text style={styles.time}>
          {valid
            ? date.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "À préciser"}
        </Text>
      </View>
      <View style={styles.separator} />
      <View style={styles.eventBody}>
        {!!isCancelled && (
          <Text style={styles.cancelBadge}>
            {status === "postponed" ? "REPORTÉ" : "ANNULÉ"}
          </Text>
        )}
        {status === "live" && <Text style={styles.liveBadge}>EN DIRECT</Text>}
        <Text style={styles.eventTitle}>{title}</Text>
        {!!(row.team_name || row.category) && (
          <Text style={styles.eventMeta}>{row.team_name || row.category}</Text>
        )}
        {row.kind === "match" && (
          <Text style={styles.eventMeta}>
            {[row.competition, row.venue || "À déterminer"]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        )}
        {!!(
          row.kind === "match" &&
          row.home_score != null &&
          row.away_score != null
        ) && (
          <Text style={styles.score}>
            {row.home_score} - {row.away_score}
          </Text>
        )}
        {!!(upcoming && !isCancelled) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Consulter mes convocations et répondre à mon coach"
            onPress={() => router.push("/member/convocations")}
            style={styles.presentButton}
          >
            <Text style={styles.presentText}>Mes convocations</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function formatPart(date: Date, part: "weekday" | "day" | "month") {
  if (part === "day")
    return date.toLocaleDateString("fr-FR", { day: "2-digit" });
  const value = date.toLocaleDateString("fr-FR", {
    weekday: part === "weekday" ? "short" : undefined,
    month: part === "month" ? "short" : undefined,
  });
  return value.replace(".", "").replace(/^./, (letter) => letter.toUpperCase());
}

function trainingTitle(date: Date, valid: boolean) {
  if (!valid) return "Entraînement";
  return `Entraînement du ${date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })}`;
}

function matchTitle(row: any, clubName: string) {
  const opponent = row.opponent_name || "Adversaire à déterminer";
  const team = row.team_name || clubName;
  if (typeof row.is_home !== "boolean") return `${team} – ${opponent}`;
  return row.is_home ? `${team} – ${opponent}` : `${opponent} – ${team}`;
}

const createMemberCalendarStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    hero: {
      marginHorizontal: -20,
      marginTop: -20,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 26,
      backgroundColor: "#06245C",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroTitle: {
      fontFamily: "Inter-Bold",
      fontSize: 42,
      lineHeight: 48,
      color: "#FFFFFF",
      fontWeight: "900",
      letterSpacing: -1.2,
    },
    heroSubtitle: {
      marginTop: 6,
      fontFamily: "Inter-Regular",
      fontSize: 15,
      color: "rgba(255,255,255,0.78)",
    },
    heroIcon: {
      width: 66,
      height: 66,
      borderRadius: 33,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    calendarPage: {
      gap: 26,
    },
    calendarSection: {
      gap: 14,
    },
    sectionTitle: {
      fontFamily: "Inter-Bold",
      fontSize: 25,
      color: colors.ink,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    eventCard: {
      flexDirection: "row",
      alignItems: "stretch",
      backgroundColor: colors.surface,
      borderRadius: 24,
      paddingVertical: 24,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: "rgba(16,24,40,0.04)",
      shadowColor: "#101828",
      shadowOpacity: 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
      gap: 18,
    },
    dateBlock: {
      width: 82,
      alignItems: "center",
      justifyContent: "center",
    },
    weekday: {
      fontFamily: "Inter-Regular",
      fontSize: 19,
      color: "#98A2B3",
      fontWeight: "600",
    },
    day: {
      fontFamily: "Inter-Bold",
      fontSize: 26,
      color: "#7A8493",
      fontWeight: "900",
      lineHeight: 31,
    },
    month: {
      fontFamily: "Inter-Regular",
      fontSize: 20,
      color: "#98A2B3",
      fontWeight: "600",
    },
    time: {
      marginTop: 8,
      fontFamily: "Inter-Regular",
      fontSize: 16,
      color: "#98A2B3",
    },
    separator: {
      width: 1,
      backgroundColor: colors.border,
      marginVertical: 2,
    },
    eventBody: {
      flex: 1,
      justifyContent: "center",
      gap: 8,
      minWidth: 0,
    },
    eventTitle: {
      fontFamily: "Inter-Bold",
      fontSize: 22,
      lineHeight: 28,
      color: colors.ink,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    eventMeta: {
      fontFamily: "Inter-Regular",
      fontSize: 14,
      color: colors.muted,
      lineHeight: 20,
    },
    cancelBadge: {
      alignSelf: "flex-start",
      overflow: "hidden",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: "#FF7A45",
      color: "#FFFFFF",
      fontFamily: "Inter-Bold",
      fontSize: 13,
      fontWeight: "900",
    },
    liveBadge: {
      alignSelf: "flex-start",
      overflow: "hidden",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.magenta,
      color: "#FFFFFF",
      fontFamily: "Inter-Bold",
      fontSize: 13,
      fontWeight: "900",
    },
    score: {
      fontFamily: "Inter-Bold",
      fontSize: 20,
      color: colors.ink,
      fontWeight: "900",
    },
    presentButton: {
      marginTop: 6,
      alignSelf: "flex-start",
      minHeight: 54,
      borderRadius: 12,
      paddingHorizontal: 28,
      backgroundColor: colors.blue,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    presentText: {
      fontFamily: "Inter-Bold",
      fontSize: 18,
      color: "#FFFFFF",
      fontWeight: "800",
    },
  });
