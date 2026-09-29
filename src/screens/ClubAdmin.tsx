import { EventTeamField } from "../components/EventTeamField";
import {
  loadCalendarEditorContext,
  requireCalendarEventAccess,
} from "../lib/calendarManagement";
import ClubAttendanceSessions, {
  requireAttendanceAdmin,
} from "./ClubAttendanceSessions";
import { loadClubMatchTotals } from "../lib/clubMatchTotals";
import { randomUUID } from "expo-crypto";
import { createProContent } from "../lib/proContentSave";
import ClubCompetitions from "./ClubCompetitions";
import ClubAttendance from "./ClubAttendance";
import { clubFieldValue } from "../lib/clubFieldValue";
import ClubSettings from "./ClubSettings";
import ClubOrganization from "./ClubOrganization";
import ImportClubTeams from "./ImportClubTeams";
import ClubStats from "./ClubStats";
import ClubPeople, { peopleSections } from "./ClubPeople";
import { loadClubAdminAccess, requireClubAdmin } from "../lib/clubAccess";
import { invalidateClubRecord } from "../lib/clubAdminCache";
import ClubInformation, { informationSections } from "./ClubInformation";
import React, { useMemo, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Switch,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  BarChart3,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Crown,
  Dumbbell,
  FileText,
  Import,
  Newspaper,
  Settings,
  ShieldCheck,
  Target,
  Trophy,
  UserCog,
  Users,
  Upload,
  Video,
  Megaphone,
  MessageCircle,
  Building2,
} from "lucide-react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Banner,
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { DateField } from "../components/DateField";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { clubSections, type ClubSection } from "../lib/clubSections";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";

const specializedSections: Record<string, { title: string }> = {
  "coach-kit": { title: "Sac du coach" },
  "import-clubs": { title: "Importer des équipes" },
  attendance: { title: "Présences" },
  sessions: { title: "Entraînements et séances" },
  competitions: { title: "Compétitions" },
};

const statusLabels: Record<string, string> = {
  scheduled: "Programmé",
  live: "En cours",
  finished: "Terminé",
  cancelled: "Annulé",
  postponed: "Reporté",
  present: "Présent",
  absent: "Absent",
  late: "En retard",
  excused: "Excusé",
  pending: "En attente",
};

const ClubAdminAccess = React.createContext(false);

export function ClubAdminGate({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const access = useQuery({
    queryKey: ["club-admin-access", id, session?.user.id],
    enabled: !!session && !!id,
    queryFn: () => loadClubAdminAccess(id, session!.user.id),
  });
  return (
    <AuthGate>
      {access.isPending ? (
        <Loading />
      ) : access.error ? (
        <ErrorState error={access.error} />
      ) : access.data ? (
        <ClubAdminAccess.Provider value={access.data.clubAdmin}>
          {children}
        </ClubAdminAccess.Provider>
      ) : null}
    </AuthGate>
  );
}
export default function ClubAdmin() {
  const uid = useAuth().session?.user.id;
  const { id, section } = useLocalSearchParams<{
    id: string;
    section?: string;
  }>();
  if (
    section &&
    !["settings", "organigramme", "stats"].includes(section) &&
    ![
      specializedSections,
      clubSections,
      informationSections,
      peopleSections,
    ].some((sections) => Object.hasOwn(sections, section))
  )
    return (
      <Screen title="Page introuvable">
        <Empty title="Cette rubrique du club n’existe pas." />
      </Screen>
    );
  return (
    <Screen
      title={
        section
          ? specializedSections[section]?.title ||
            clubSections[section]?.title ||
            informationSections[section]?.title ||
            peopleSections[section]?.title ||
            "Gestion du club"
          : "Administration du club"
      }
    >
      <ClubAdminGate id={id}>
        {section ? (
          section === "coach-kit" ? (
            <CoachKit key={`${uid}:${id}`} id={id} />
          ) : section === "import-clubs" ? (
            <ImportClubTeams key={`${uid}:${id}`} id={id} />
          ) : section === "competitions" ? (
            <ClubCompetitions key={id} id={id} />
          ) : section === "sessions" ? (
            <ClubAttendanceSessions
              key={`${uid}:${id}`}
              id={id}
              onBack={() => router.replace(`/club-admin/${id}/coach-kit`)}
              onOpen={(sessionId) =>
                router.push({
                  pathname: `/club-admin/${id}/attendance`,
                  params: { sessionId },
                })
              }
            />
          ) : section === "attendance" ? (
            <ClubAttendance key={`${uid}:${id}`} id={id} />
          ) : section === "settings" ? (
            <ClubSettings key={`${uid}:${id}`} id={id} />
          ) : section === "organigramme" ? (
            <ClubOrganization key={`${uid}:${id}`} id={id} />
          ) : section === "stats" ? (
            <ClubStats id={id} />
          ) : peopleSections[section] ? (
            <ClubPeople
              key={`${uid}:${id}:${section}`}
              id={id}
              section={section}
            />
          ) : informationSections[section] ? (
            <ClubInformation
              key={`${uid}:${id}:${section}`}
              id={id}
              section={section}
            />
          ) : (
            <ClubRecords
              key={`${uid}/${id}/${section}`}
              id={id}
              section={section}
            />
          )
        ) : (
          <ClubDashboard id={id} />
        )}
      </ClubAdminGate>
    </Screen>
  );
}
function ClubDashboard({ id }: { id: string }) {
  const clubAdmin = React.useContext(ClubAdminAccess);
  const styles = useThemedStyles(createAdminStyles);
  const { colors } = useTheme();

  const query = useQuery({
    queryKey: ["club-admin-name", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fff_clubs")
        .select("name,city,logo_url")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const entries = useMemo(
    () =>
      Object.entries({
        "coach-kit": { title: "Sac du coach" },
        settings: { title: "Paramètres et invitation" },
        organigramme: { title: "Organigramme" },
        stats: { title: "Statistiques" },
        ...peopleSections,
        ...informationSections,
        ...clubSections,
        ...specializedSections,
      }).map(([key, value]) => ({
        key,
        title: value.title,
        icon: sectionIcon(key, colors.blue),
        group: sectionGroup(key),
        description: sectionDescription(key),
      })),
    [colors.blue],
  );
  if (!clubAdmin) return <CoachKit id={id} />;
  const priority = entries.filter((item) =>
    [
      "infos",
      "players",
      "staff",
      "matches",
      "news",
      "publications",
      "shorts",
      "settings",
    ].includes(item.key),
  );
  const groups = ["Piloter", "Communauté", "Contenu", "Sportif", "Réglages"];
  return (
    <View style={styles.dashboard}>
      {!!query.error && <ErrorState error={query.error} />}
      <LinearGradient
        colors={["#06111D", "#071F3D", "#087CFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroBadge}>
            <ShieldCheck size={17} color="#B7DBFF" />
            <Text style={styles.heroBadgeText}>ESPACE CLUB</Text>
          </View>
          <Crown size={27} color="#FFD166" />
        </View>
        <Text style={styles.heroTitle}>{query.data?.name || "Mon club"}</Text>
        <Text style={styles.heroText}>
          {query.data?.city || "Administration"} · gérez l’équipe, les contenus,
          les matchs et les accès du club.
        </Text>
      </LinearGradient>

      <View style={styles.quickHeader}>
        <Text style={styles.sectionHeading}>Actions prioritaires</Text>
        <Text style={styles.sectionHint}>
          Les tâches à utiliser le plus souvent.
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.priorityRail}
      >
        {priority.map((item) => (
          <AdminTile
            key={`priority:${item.key}`}
            compact
            title={item.title}
            description={item.description}
            icon={item.icon}
            onPress={() => router.push(`/club-admin/${id}/${item.key}`)}
          />
        ))}
      </ScrollView>

      {groups.map((group) => {
        const rows = entries.filter((item) => item.group === group);
        if (!rows.length) return null;
        return (
          <View key={group} style={styles.group}>
            <Text style={styles.sectionHeading}>{group}</Text>
            <View style={styles.groupGrid}>
              {rows.map((item) => (
                <AdminTile
                  key={item.key}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                  onPress={() => router.push(`/club-admin/${id}/${item.key}`)}
                />
              ))}
            </View>
          </View>
        );
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voir la page publique du club"
        onPress={() => router.push(`/club/${id}`)}
        style={styles.publicLink}
      >
        <Building2 size={19} color={colors.blue} />
        <Text style={styles.publicLinkText}>Voir la vitrine publique</Text>
        <ChevronRight size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function AdminTile({
  title,
  description,
  icon,
  onPress,
  compact = false,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
  compact?: boolean;
}) {
  const styles = useThemedStyles(createAdminStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        compact ? styles.priorityTile : styles.adminTile,
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={styles.tileIcon}>{icon}</View>
      <View style={styles.tileCopy}>
        <Text style={styles.tileTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.tileDescription} numberOfLines={2}>
          {description}
        </Text>
      </View>
      {!compact && <ChevronRight size={18} color={colors.muted} />}
    </Pressable>
  );
}

function sectionIcon(key: string, color: string) {
  const props = { size: 21, color, strokeWidth: 2 };
  if (key === "coach-kit") return <Dumbbell {...props} />;
  if (["players", "members"].includes(key)) return <Users {...props} />;
  if (["staff", "admins"].includes(key)) return <UserCog {...props} />;
  if (["matches", "competitions"].includes(key)) return <Trophy {...props} />;
  if (["attendance", "convocations"].includes(key))
    return <ClipboardList {...props} />;
  if (["news"].includes(key)) return <Newspaper {...props} />;
  if (["publications", "shorts"].includes(key)) return <Video {...props} />;
  if (["palmares", "stats"].includes(key)) return <BarChart3 {...props} />;
  if (["settings"].includes(key)) return <Settings {...props} />;
  if (["import-clubs"].includes(key)) return <Import {...props} />;
  if (["chat"].includes(key)) return <MessageCircle {...props} />;
  if (["events", "sessions"].includes(key)) return <CalendarDays {...props} />;
  return <FileText {...props} />;
}

function sectionGroup(key: string) {
  if (["settings", "organigramme", "stats", "import-clubs"].includes(key))
    return "Piloter";
  if (["members", "players", "staff", "admins"].includes(key))
    return "Communauté";
  if (["news", "publications", "shorts", "chat"].includes(key))
    return "Contenu";
  if (
    [
      "matches",
      "convocations",
      "attendance",
      "sessions",
      "competitions",
      "palmares",
    ].includes(key)
  )
    return "Sportif";
  return "Réglages";
}

function sectionDescription(key: string) {
  const descriptions: Record<string, string> = {
    "coach-kit": "Tout pour gérer une équipe au quotidien.",
    settings: "Invitations, statuts et paramètres clés.",
    organigramme: "Structure du club et responsabilités.",
    stats: "Indicateurs et activité du club.",
    "import-clubs": "Importer rapidement les équipes.",
    members: "Demandes et membres rattachés.",
    players: "Effectif, postes et profils joueurs.",
    staff: "Coach, staff et encadrement.",
    admins: "Accès administrateurs du club.",
    news: "Actualités visibles sur la vitrine.",
    publications: "Photos et posts du club.",
    shorts: "Vidéos courtes et highlights.",
    chat: "Discussions internes du club.",
    matches: "Matchs, scores et statistiques.",
    convocations: "Listes de joueurs convoqués.",
    attendance: "Présences aux séances.",
    sessions: "Entraînements et rendez-vous d’équipe.",
    competitions: "Championnats et classements.",
    palmares: "Titres, trophées et historique.",
  };
  return descriptions[key] || "Gérer cette section du club.";
}

function CoachKit({ id }: { id: string }) {
  const uid = useAuth().session!.user.id;
  const s = useUIStyles();
  const { colors } = useTheme();
  const styles = useThemedStyles(createCoachStyles);
  const access = useQuery({
    queryKey: ["calendar-editor-teams", id, uid],
    queryFn: () => loadCalendarEditorContext(id, uid),
  });
  if (access.isPending) return <Loading />;
  if (access.error)
    return (
      <ErrorState error={access.error} retry={() => void access.refetch()} />
    );
  if (access.data.clubAllowed) return <ClubCoachKit id={id} />;
  return (
    <View style={styles.page}>
      <Banner
        eyebrow="SAC DU COACH"
        title="Mes équipes"
        description="Préparez les matchs, les entraînements et les convocations de vos équipes."
      />
      <View style={styles.grid}>
        <CoachShortcut
          icon={<CalendarDays size={22} color={colors.blue} />}
          title="Matchs et résultats"
          text="Programmer et mettre à jour"
          onPress={() => router.push(`/club-admin/${id}/matches`)}
        />
        <CoachShortcut
          icon={<ClipboardList size={22} color={colors.blue} />}
          title="Convocations"
          text="Préparer les convocations"
          onPress={() => router.push(`/club-admin/${id}/convocations`)}
        />
        <CoachShortcut
          icon={<Dumbbell size={22} color={colors.blue} />}
          title="Entraînements"
          text="Créer et préparer les séances"
          onPress={() => router.push(`/club-admin/${id}/sessions`)}
        />
      </View>
      {access.data.teams.map((team) => (
        <View key={team.id} style={s.card}>
          <Text style={s.h2}>{team.name}</Text>
          <Text style={s.text}>
            {team.category || "Équipe du club"}
            {team.is_active === false ? " · Archivée" : ""}
          </Text>
          <Button
            secondary
            title="Voir le calendrier de l’équipe"
            onPress={() =>
              router.push(
                `/club/${id}/member?teamId=${encodeURIComponent(team.id)}`,
              )
            }
          />
        </View>
      ))}
    </View>
  );
}

function ClubCoachKit({ id }: { id: string }) {
  const styles = useThemedStyles(createCoachStyles);
  const { colors } = useTheme();
  const uid = useAuth().session!.user.id;
  const overview = useQuery({
    queryKey: ["club-coach-kit", id, uid],
    queryFn: async () => {
      await requireClubAdmin(id);
      const today = new Date().toISOString();
      const read = async <T,>(
        promise: PromiseLike<{
          data: T | null;
          count?: number | null;
          error: unknown;
        }>,
      ) => {
        const result = await promise;
        if (result.error) return { data: null, count: 0, error: result.error };
        return { data: result.data, count: result.count || 0, error: null };
      };
      const [
        totals,
        players,
        matches,
        results,
        convocations,
        sessions,
        videos,
        clubFeed,
        linkedProfiles,
      ] = await Promise.all([
        loadClubMatchTotals(id, () => requireClubAdmin(id)),
        read(
          supabase
            .from("club_players")
            .select("id,name,category,position,is_active", { count: "exact" })
            .eq("club_id", id)
            .eq("is_active", true)
            .order("name")
            .limit(8),
        ),
        read(
          supabase
            .from("club_matches")
            .select(
              "id,opponent_name,category,match_date,venue,status,home_score,away_score,is_home",
            )
            .eq("club_id", id)
            .gte("match_date", today)
            .order("match_date", { ascending: true })
            .limit(3),
        ),
        read(
          supabase
            .from("club_matches")
            .select(
              "id,opponent_name,category,match_date,venue,status,home_score,away_score,is_home",
            )
            .eq("club_id", id)
            .eq("status", "finished")
            .order("match_date", { ascending: false })
            .limit(3),
        ),
        read(
          supabase
            .from("club_convocations")
            .select("id,title,meeting_date,meeting_location,category")
            .eq("club_id", id)
            .gte("meeting_date", today)
            .order("meeting_date", { ascending: true })
            .limit(3),
        ),
        read(
          supabase
            .from("club_attendance_sessions")
            .select("id,session_type,session_date,category,notes")
            .eq("club_id", id)
            .gte("session_date", today)
            .order("session_date", { ascending: true })
            .limit(3),
        ),
        read(
          supabase
            .from("club_shorts")
            .select("id,title,description,created_at,views_count,likes_count")
            .eq("club_id", id)
            .eq("is_published", true)
            .order("created_at", { ascending: false })
            .limit(3),
        ),
        read(
          supabase
            .from("club_publications")
            .select("id,title,content,created_at,published_at,media_type")
            .eq("club_id", id)
            .eq("is_published", true)
            .order("published_at", { ascending: false })
            .limit(3),
        ),
        read(
          supabase
            .from("club_players")
            .select("profile_id")
            .eq("club_id", id)
            .eq("is_active", true)
            .not("profile_id", "is", null)
            .limit(80),
        ),
      ]);
      const criticalError =
        players.error ||
        matches.error ||
        results.error ||
        convocations.error ||
        videos.error ||
        clubFeed.error ||
        linkedProfiles.error;
      const profileIds = Array.from(
        new Set(
          ((linkedProfiles.data || []) as { profile_id: string | null }[])
            .map((row) => row.profile_id)
            .filter(Boolean) as string[],
        ),
      );
      const memberPosts = profileIds.length
        ? await read(
            supabase
              .from("posts")
              .select(
                "id,content,created_at,user_id,video_url,image_url,profiles(full_name,avatar_url)",
              )
              .in("user_id", profileIds)
              .order("created_at", { ascending: false })
              .limit(5),
          )
        : { data: [], count: 0, error: null };
      if (criticalError || memberPosts.error)
        throw criticalError || memberPosts.error;
      return {
        totals,
        players: players.data || [],
        playerCount: players.count || 0,
        matches: matches.data || [],
        results: results.data || [],
        convocations: convocations.data || [],
        sessions: sessions.data || [],
        videos: videos.data || [],
        clubFeed: clubFeed.data || [],
        memberPosts: memberPosts.data || [],
        sessionsUnavailable: !!sessions.error,
      };
    },
  });
  const nextMatch = overview.data?.matches[0];
  const [captureNotice, setCaptureNotice] = useState("");
  const openCameraCapture = async () => {
    setCaptureNotice("");
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setCaptureNotice(
        "Autorisez la caméra pour filmer un entraînement ou un match.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      quality: 0.9,
      videoMaxDuration: 900,
    });
    if (!result.canceled) {
      setCaptureNotice(
        "Vidéo capturée. Ouvrez Shorts du club pour publier le fichier ou ajoutez son lien après upload.",
      );
      router.push(`/club-admin/${id}/shorts`);
    }
  };
  const openVideoImport = async () => {
    setCaptureNotice("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setCaptureNotice(
        "Autorisez la galerie pour importer une vidéo de match ou d’entraînement.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 1,
    });
    if (!result.canceled) {
      setCaptureNotice(
        "Vidéo sélectionnée. Ouvrez Shorts du club pour publier le fichier ou ajoutez son lien après upload.",
      );
      router.push(`/club-admin/${id}/shorts`);
    }
  };
  return (
    <View style={styles.page}>
      <LinearGradient
        colors={["#06111D", "#102F50", "#087CFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroBadge}>
          <Dumbbell size={17} color="#B7DBFF" />
          <Text style={styles.heroBadgeText}>SAC DU COACH</Text>
        </View>
        <Text style={styles.heroTitle}>Ta semaine d’éducateur</Text>
        <Text style={styles.heroText}>
          Prépare les séances, convoque les joueurs, suis les présences, note
          les résultats et garde ton groupe aligné.
        </Text>
      </LinearGradient>

      {!!overview.error && (
        <ErrorState
          error={overview.error}
          retry={() => void overview.refetch()}
        />
      )}
      {overview.isPending ? <Loading /> : null}
      {!!overview.data?.sessionsUnavailable && (
        <Text style={styles.warningText}>
          Les séances sont protégées par les droits de présence du club. Les
          autres données restent disponibles.
        </Text>
      )}

      <View style={styles.grid}>
        <CoachShortcut
          icon={<Users size={22} color={colors.blue} />}
          title="Mon effectif"
          text={`${overview.data?.playerCount || 0} joueurs actifs`}
          onPress={() => router.push(`/club-admin/${id}/players`)}
        />
        <CoachShortcut
          icon={<UserCog size={22} color={colors.blue} />}
          title="Membres"
          text="Joueurs, parents et invitations"
          onPress={() => router.push(`/club-admin/${id}/members`)}
        />
        <CoachShortcut
          icon={<CalendarDays size={22} color={colors.blue} />}
          title="Calendrier"
          text="Matchs et rendez-vous"
          onPress={() => router.push(`/club-admin/${id}/matches`)}
        />
        <CoachShortcut
          icon={<ClipboardList size={22} color={colors.blue} />}
          title="Convocations"
          text="Préparer et envoyer"
          onPress={() => router.push(`/club-admin/${id}/convocations`)}
        />
        <CoachShortcut
          icon={<CheckCircle2 size={22} color={colors.success} />}
          title="Entraînements"
          text="Créer et préparer les séances"
          onPress={() => router.push(`/club-admin/${id}/sessions`)}
        />
        <CoachShortcut
          icon={<CheckCircle2 size={22} color={colors.success} />}
          title="Présences"
          text="Séances et assiduité"
          onPress={() => router.push(`/club-admin/${id}/attendance`)}
        />
        <CoachShortcut
          icon={<Target size={22} color={colors.blue} />}
          title="Résultats"
          text="Scores et stats joueurs"
          onPress={() => router.push(`/club-admin/${id}/matches`)}
        />
        <CoachShortcut
          icon={<MessageCircle size={22} color={colors.blue} />}
          title="Groupe équipe"
          text="Discussion interne"
          onPress={() => router.push(`/club-admin/${id}/chat`)}
        />
        <CoachShortcut
          icon={<Video size={22} color={colors.blue} />}
          title="Vidéos équipe"
          text="Shorts, matchs et highlights"
          onPress={() => router.push(`/club-admin/${id}/shorts`)}
        />
        <CoachShortcut
          icon={<Camera size={22} color={colors.blue} />}
          title="Filmer"
          text="Caméra, import ou VEO"
          onPress={openCameraCapture}
        />
        <CoachShortcut
          icon={<Megaphone size={22} color={colors.blue} />}
          title="Fil équipe"
          text="Infos et publications"
          onPress={() => router.push(`/club-admin/${id}/publications`)}
        />
      </View>

      {!!overview.data && (
        <CoachStatsPanel
          playerCount={overview.data.playerCount}
          totals={overview.data.totals}
          upcomingMatches={overview.data.matches.length}
          upcomingConvocations={overview.data.convocations.length}
          upcomingSessions={overview.data.sessions.length}
          sessionsUnavailable={overview.data.sessionsUnavailable}
          onOpenStats={() => router.push(`/club-admin/${id}/stats`)}
        />
      )}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Prochain match</Text>
          <Pressable onPress={() => router.push(`/club-admin/${id}/matches`)}>
            <Text style={styles.link}>Gérer</Text>
          </Pressable>
        </View>
        {nextMatch ? (
          <View style={styles.matchCard}>
            <Trophy size={24} color="#FFD166" />
            <View style={{ flex: 1 }}>
              <Text style={styles.matchTitle}>
                {nextMatch.is_home ? "À domicile" : "À l’extérieur"} ·{" "}
                {nextMatch.opponent_name}
              </Text>
              <Text style={styles.meta}>
                {formatCoachDate(nextMatch.match_date)} ·{" "}
                {nextMatch.venue || "Lieu à préciser"}
              </Text>
              {!!nextMatch.category && (
                <Text style={styles.meta}>
                  Catégorie : {nextMatch.category}
                </Text>
              )}
            </View>
          </View>
        ) : (
          <Empty
            title="Aucun match à venir"
            description="Ajoutez le prochain match pour préparer la convocation."
          />
        )}
      </View>

      <CoachList
        title="Prochaines convocations"
        empty="Aucune convocation planifiée"
        action="Créer"
        onAction={() => router.push(`/club-admin/${id}/convocations`)}
        rows={(overview.data?.convocations || []).map((item) => ({
          id: item.id,
          title: item.title,
          meta: `${formatCoachDate(item.meeting_date)} · ${item.meeting_location || "Lieu à préciser"}`,
        }))}
      />
      <CoachList
        title="Entraînements et séances"
        empty="Aucune séance à venir"
        action="Créer séance"
        onAction={() => router.push(`/club-admin/${id}/sessions`)}
        rows={(overview.data?.sessions || []).map((item) => ({
          id: item.id,
          title:
            item.session_type === "training"
              ? "Entraînement"
              : item.session_type,
          meta: `${formatCoachDate(item.session_date)}${item.category ? ` · ${item.category}` : ""}`,
        }))}
      />

      <CoachList
        title="Derniers résultats"
        empty="Aucun résultat saisi"
        action="Saisir"
        onAction={() => router.push(`/club-admin/${id}/matches`)}
        rows={(overview.data?.results || []).map((item) => ({
          id: item.id,
          title: `${item.is_home ? "FootNation" : item.opponent_name} ${item.home_score ?? "-"} - ${item.away_score ?? "-"} ${item.is_home ? item.opponent_name : "FootNation"}`,
          meta: `${formatCoachDate(item.match_date)}${item.category ? ` · ${item.category}` : ""}`,
        }))}
      />

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Filmer entraînement ou match</Text>
          <Pressable onPress={() => router.push(`/club-admin/${id}/shorts`)}>
            <Text style={styles.link}>Vidéos</Text>
          </Pressable>
        </View>
        <View style={styles.captureGrid}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filmer avec la caméra"
            onPress={openCameraCapture}
            style={styles.captureButton}
          >
            <Camera size={22} color={colors.blue} />
            <Text style={styles.captureTitle}>Caméra</Text>
            <Text style={styles.captureText}>
              Filmer depuis le téléphone pendant l’entraînement ou le match.
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Importer une vidéo"
            onPress={openVideoImport}
            style={styles.captureButton}
          >
            <Upload size={22} color={colors.blue} />
            <Text style={styles.captureTitle}>Importer</Text>
            <Text style={styles.captureText}>
              Ajouter une vidéo déjà enregistrée depuis la galerie.
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter une vidéo VEO"
            onPress={() => router.push(`/club-admin/${id}/shorts`)}
            style={styles.captureButton}
          >
            <Video size={22} color={colors.blue} />
            <Text style={styles.captureTitle}>VEO</Text>
            <Text style={styles.captureText}>
              Collez le lien VEO, résumé ou analyse vidéo dans les shorts du
              club.
            </Text>
          </Pressable>
        </View>
        {!!captureNotice && (
          <Text style={styles.captureNotice}>{captureNotice}</Text>
        )}
      </View>
      <CoachList
        title="Vidéos de l’équipe"
        empty="Aucune vidéo publiée"
        action="Ajouter"
        onAction={() => router.push(`/club-admin/${id}/shorts`)}
        rows={(overview.data?.videos || []).map((item) => ({
          id: item.id,
          title: item.title || item.description || "Vidéo de l’équipe",
          meta: `${formatCoachDate(item.created_at)} · ${item.views_count || 0} vues · ${item.likes_count || 0} likes`,
        }))}
      />
      <CoachList
        title="Fil de l’équipe"
        empty="Aucune publication club"
        action="Publier"
        onAction={() => router.push(`/club-admin/${id}/publications`)}
        rows={(overview.data?.clubFeed || []).map((item) => ({
          id: item.id,
          title: item.title || item.content || "Publication du club",
          meta: `${formatCoachDate(item.published_at || item.created_at)}${item.media_type ? ` · ${item.media_type}` : ""}`,
        }))}
      />
      <CoachList
        title="Dernières publications des membres"
        empty="Aucune publication récente des joueurs liés"
        action="Voir profils"
        onAction={() => router.push(`/club-admin/${id}/players`)}
        rows={(overview.data?.memberPosts || []).map((item) => {
          const profile = Array.isArray(item.profiles)
            ? item.profiles[0]
            : item.profiles;
          return {
            id: item.id,
            title: profile?.full_name || "Membre de l’équipe",
            meta: `${formatCoachDate(item.created_at)} · ${item.video_url ? "Vidéo" : item.image_url ? "Photo" : "Publication"} · ${item.content || "Sans texte"}`,
          };
        })}
      />
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Messagerie interne équipe</Text>
          <Pressable onPress={() => router.push(`/club-admin/${id}/chat`)}>
            <Text style={styles.link}>Ouvrir</Text>
          </Pressable>
        </View>
        <View style={styles.matchCard}>
          <MessageCircle size={24} color={colors.blue} />
          <View style={{ flex: 1 }}>
            <Text style={styles.matchTitle}>
              Groupe staff, joueurs et membres
            </Text>
            <Text style={styles.meta}>
              Centralise les consignes, absences, convocations et messages de
              match.
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Routine éducateur</Text>
        {[
          "Vérifier les absents et blessés",
          "Créer la séance ou le match de la semaine",
          "Préparer la convocation",
          "Pointer les présences après entraînement",
          "Saisir le score et les stats après match",
          "Publier un résumé pour les familles et le club",
        ].map((item) => (
          <View key={item} style={styles.checkRow}>
            <CheckCircle2 size={18} color={colors.success} />
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CoachShortcut({
  icon,
  title,
  text,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createCoachStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.shortcut, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.shortcutIcon}>{icon}</View>
      <Text style={styles.shortcutTitle}>{title}</Text>
      <Text style={styles.shortcutText}>{text}</Text>
      <ChevronRight
        size={17}
        color={colors.muted}
        style={styles.shortcutArrow}
      />
    </Pressable>
  );
}

function CoachStatsPanel({
  playerCount,
  totals,
  upcomingMatches,
  upcomingConvocations,
  upcomingSessions,
  sessionsUnavailable,
  onOpenStats,
}: {
  playerCount: number;
  totals: Awaited<ReturnType<typeof loadClubMatchTotals>>;
  upcomingMatches: number;
  upcomingConvocations: number;
  upcomingSessions: number;
  sessionsUnavailable: boolean;
  onOpenStats: () => void;
}) {
  const styles = useThemedStyles(createCoachStyles);
  const played = totals.scored || 0;
  const points = totals.wins * 3 + totals.draws;
  const pointsPerMatch = played ? (points / played).toFixed(1) : "0.0";
  const winRate = played ? Math.round((totals.wins / played) * 100) : 0;
  const goalDiff = totals.goalsFor - totals.goalsAgainst;
  const avgFor = played ? (totals.goalsFor / played).toFixed(1) : "0.0";
  const avgAgainst = played ? (totals.goalsAgainst / played).toFixed(1) : "0.0";
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Statistiques détaillées</Text>
        <Pressable onPress={onOpenStats}>
          <Text style={styles.link}>Voir tout</Text>
        </Pressable>
      </View>
      <View style={styles.statsGrid}>
        <CoachStat label="Joueurs actifs" value={playerCount} />
        <CoachStat label="Matchs joués" value={played} />
        <CoachStat label="Victoires" value={totals.wins} />
        <CoachStat label="Nuls" value={totals.draws} />
        <CoachStat label="Défaites" value={totals.losses} />
        <CoachStat label="% victoires" value={`${winRate}%`} />
        <CoachStat label="Points" value={points} />
        <CoachStat label="Pts / match" value={pointsPerMatch} />
        <CoachStat label="Buts marqués" value={totals.goalsFor} />
        <CoachStat label="Buts encaissés" value={totals.goalsAgainst} />
        <CoachStat
          label="Différence"
          value={goalDiff > 0 ? `+${goalDiff}` : goalDiff}
        />
        <CoachStat label="Buts / match" value={avgFor} />
        <CoachStat label="Encaissés / match" value={avgAgainst} />
        <CoachStat label="Matchs à venir" value={upcomingMatches} />
        <CoachStat label="Convocations" value={upcomingConvocations} />
        <CoachStat
          label="Séances à venir"
          value={sessionsUnavailable ? "—" : upcomingSessions}
        />
      </View>
    </View>
  );
}

function CoachStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  const styles = useThemedStyles(createCoachStyles);
  return (
    <View style={styles.statBox}>
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CoachList({
  title,
  rows,
  empty,
  action,
  onAction,
}: {
  title: string;
  rows: { id: string; title: string; meta: string }[];
  empty: string;
  action: string;
  onAction: () => void;
}) {
  const styles = useThemedStyles(createCoachStyles);
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable onPress={onAction}>
          <Text style={styles.link}>{action}</Text>
        </Pressable>
      </View>
      {rows.length ? (
        rows.map((row) => (
          <View key={row.id} style={styles.listRow}>
            <View style={styles.listDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>{row.title}</Text>
              <Text style={styles.meta}>{row.meta}</Text>
            </View>
          </View>
        ))
      ) : (
        <Empty title={empty} />
      )}
    </View>
  );
}

function formatCoachDate(value?: string | null) {
  if (!value) return "Date à préciser";
  return new Date(value).toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const createCoachStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    page: { gap: 16 },
    hero: { borderRadius: 30, padding: 22, gap: 12, overflow: "hidden" },
    heroBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
    },
    heroBadgeText: {
      color: "#EAF3FF",
      fontFamily: "Inter-Bold",
      fontSize: 12,
      letterSpacing: 1.2,
    },
    heroTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 31,
      lineHeight: 37,
      letterSpacing: -0.8,
    },
    heroText: {
      color: "rgba(255,255,255,0.76)",
      fontFamily: "Inter-Regular",
      fontSize: 15,
      lineHeight: 22,
    },
    warningText: {
      color: colors.danger,
      fontFamily: "Inter-SemiBold",
      fontSize: 13,
      lineHeight: 19,
      borderRadius: 16,
      padding: 12,
      backgroundColor: "#FFE8EA",
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    shortcut: {
      width: "48%",
      minWidth: 150,
      flexGrow: 1,
      borderRadius: 22,
      padding: 14,
      gap: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    shortcutIcon: {
      width: 43,
      height: 43,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
    },
    shortcutTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 16,
    },
    shortcutText: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 17,
    },
    shortcutArrow: { position: "absolute", right: 12, top: 16 },
    sectionCard: {
      borderRadius: 24,
      padding: 16,
      gap: 13,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
    },
    statBox: {
      width: "47%",
      minWidth: 130,
      flexGrow: 1,
      borderRadius: 18,
      padding: 12,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statNumber: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 22,
      letterSpacing: -0.4,
    },
    statLabel: {
      color: colors.muted,
      fontFamily: "Inter-SemiBold",
      fontSize: 12,
      lineHeight: 16,
    },
    captureGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
    },
    captureButton: {
      width: "31%",
      minWidth: 125,
      flexGrow: 1,
      borderRadius: 18,
      padding: 12,
      gap: 7,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
    },
    captureTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 15,
    },
    captureText: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 16,
    },
    captureNotice: {
      color: colors.blue,
      fontFamily: "Inter-SemiBold",
      fontSize: 13,
      lineHeight: 19,
      borderRadius: 14,
      padding: 11,
      backgroundColor: colors.accentSoft,
    },
    sectionTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 19,
      letterSpacing: -0.3,
    },
    link: { color: colors.blue, fontFamily: "Inter-Bold", fontSize: 14 },
    matchCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 18,
      padding: 13,
      backgroundColor: colors.surfaceRaised,
    },
    matchTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      lineHeight: 21,
    },
    meta: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 18,
    },
    listRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    listDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.blue,
    },
    listTitle: { color: colors.ink, fontFamily: "Inter-Bold", fontSize: 15 },
    checkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 5,
    },
    checkText: {
      flex: 1,
      color: colors.ink,
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 20,
    },
  });

function ClubRecords({ id, section }: { id: string; section: string }) {
  const s = useUIStyles();

  const uid = useAuth().session!.user.id;
  const config = clubSections[section];
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [deleting, setDeleting] = useState<Record<string, any> | null>(null);
  const cache = useQueryClient();
  const rosterAccess = useQuery({
    queryKey: ["club-roster-action-access", id, uid],
    enabled: ["matches", "convocations"].includes(section),
    queryFn: async () => {
      await requireEditorAccount(uid);
      const result = await supabase.rpc("is_fff_club_admin", { p_club_id: id });
      if (result.error) throw result.error;
      return result.data === true;
    },
  });
  const query = useInfiniteQuery({
    queryKey: ["club-admin-records", id, section, uid],
    enabled: !!config,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const editor = ["matches", "convocations"].includes(section)
        ? await loadCalendarEditorContext(id, uid)
        : null;
      if (!editor && config.fffAdminOnly) await requireAttendanceAdmin(id, uid);
      else if (!editor) await requireClubAdmin(id);
      let request = supabase
        .from(config.table)
        .select("*")
        .eq("club_id", id)
        .order(config.order, { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (editor && !editor.clubAllowed)
        request = request.in(
          "team_id",
          editor.teams.map((team) => team.id),
        );
      const { data, error } = await request;
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const remove = useMutation({
    mutationFn: async (row: Record<string, any>) => {
      await requireEditorAccount(uid);
      if (["matches", "convocations"].includes(section))
        await loadCalendarEditorContext(id, uid);
      else if (config.fffAdminOnly) await requireAttendanceAdmin(id, uid);
      else await requireClubAdmin(id);
      const { error } = await supabase.rpc(
        "mutate_native_club_record_snapshot",
        {
          p_section: section,
          p_club_id: id,
          p_id: row.id,
          p_values: config.softDelete ? { is_active: false } : {},
          p_expected: row,
          p_delete: !config.softDelete,
        },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleting(null);
      invalidateClubRecord(cache, id, section);
    },
  });
  if (!config) return <Empty title="Section introuvable" />;
  if (editing)
    return (
      <ClubRecordEditor
        id={id}
        section={section}
        config={config}
        record={editing}
        close={() => setEditing(null)}
      />
    );
  return (
    <>
      {!config.readonly && (
        <Button
          title="Ajouter"
          disabled={remove.isPending}
          onPress={() => setEditing({})}
        />
      )}
      <Button
        title="Actualiser la liste"
        secondary
        busy={query.isFetching}
        disabled={remove.isPending}
        onPress={() => {
          setDeleting(null);
          remove.reset();
          void query.refetch();
        }}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {["matches", "convocations"].includes(section) &&
        !!rosterAccess.error && (
          <ErrorState
            error={rosterAccess.error}
            retry={() => void rosterAccess.refetch()}
          />
        )}
      {!!remove.error && <ErrorState error={remove.error} />}
      {query.data?.pages.flat().map((row) => (
        <View style={s.card} key={row.id}>
          {!!(section === "players" || section === "staff") && (
            <Text style={s.small}>
              {row.profile_id
                ? "Compte FootNation associé"
                : "Sans compte FootNation associé"}
            </Text>
          )}
          {config.fields.map(
            (field) =>
              row[field.key] != null && (
                <View key={field.key}>
                  <Text style={s.small}>{field.label}</Text>
                  <Text style={field === config.fields[0] ? s.h2 : s.text}>
                    {field.type === "boolean"
                      ? row[field.key]
                        ? "Oui"
                        : "Non"
                      : field.type === "date"
                        ? new Date(row[field.key]).toLocaleString("fr-FR")
                        : statusLabels[String(row[field.key])] ||
                          String(row[field.key])}
                  </Text>
                </View>
              ),
          )}
          {section === "matches" &&
            rosterAccess.data === true &&
            !rosterAccess.error && (
              <Button
                title="Saisir les statistiques des joueurs"
                secondary
                onPress={() => router.push(`/club-admin/${id}/match/${row.id}`)}
              />
            )}
          {section === "convocations" &&
            rosterAccess.data === true &&
            !rosterAccess.error && (
              <Button
                title="Gérer les joueurs convoqués"
                onPress={() =>
                  router.push(`/club-admin/${id}/convocation/${row.id}`)
                }
              />
            )}
          {section === "chat" && (
            <Button
              title="Ouvrir la discussion"
              onPress={() => router.push(`/club-chat/${row.id}`)}
            />
          )}
          {!config.readonly && (
            <>
              <Button
                title="Modifier"
                disabled={remove.isPending}
                secondary
                onPress={() => setEditing(row)}
              />
              {deleting?.id === row.id ? (
                <>
                  <Text style={s.text}>
                    {config.softDelete
                      ? "Retirer cette personne de l’effectif actif ? Son historique sera conservé."
                      : "Supprimer définitivement cet élément ?"}
                  </Text>
                  <Button
                    title={
                      config.softDelete
                        ? "Confirmer le retrait"
                        : "Confirmer la suppression"
                    }
                    busy={remove.isPending}
                    onPress={() => {
                      if (deleting) remove.mutate(deleting);
                    }}
                  />
                  <Button
                    title="Annuler"
                    disabled={remove.isPending}
                    secondary
                    onPress={() => setDeleting(null)}
                  />
                </>
              ) : (
                <Button
                  title={
                    config.softDelete
                      ? "Retirer de l’effectif actif"
                      : "Supprimer"
                  }
                  disabled={
                    remove.isPending ||
                    (!!config.softDelete && row.is_active === false)
                  }
                  secondary
                  onPress={() => {
                    remove.reset();
                    setDeleting(row);
                  }}
                />
              )}
            </>
          )}
        </View>
      ))}
      {!!(query.data && !query.data.pages.flat().length) && (
        <Empty title="Aucun élément" />
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
const createAdminStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    dashboard: { gap: 18 },
    hero: {
      borderRadius: 30,
      padding: 22,
      gap: 12,
      overflow: "hidden",
    },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    heroBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
    },
    heroBadgeText: {
      color: "#EAF3FF",
      fontFamily: "Inter-Bold",
      fontSize: 12,
      letterSpacing: 1.2,
    },
    heroTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 31,
      lineHeight: 37,
      letterSpacing: -0.8,
    },
    heroText: {
      color: "rgba(255,255,255,0.76)",
      fontFamily: "Inter-Regular",
      fontSize: 15,
      lineHeight: 22,
    },
    warningText: {
      color: colors.danger,
      fontFamily: "Inter-SemiBold",
      fontSize: 13,
      lineHeight: 19,
      borderRadius: 16,
      padding: 12,
      backgroundColor: "#FFE8EA",
    },
    quickHeader: { gap: 3 },
    sectionHeading: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 20,
      letterSpacing: -0.3,
    },
    sectionHint: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 13,
    },
    priorityRail: { gap: 10, paddingRight: 8 },
    priorityTile: {
      width: 178,
      minHeight: 150,
      borderRadius: 22,
      padding: 15,
      gap: 11,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    group: { gap: 10 },
    groupGrid: { gap: 10 },
    adminTile: {
      minHeight: 82,
      borderRadius: 20,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tileIcon: {
      width: 45,
      height: 45,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
    },
    tileCopy: { flex: 1, gap: 3 },
    tileTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      lineHeight: 20,
    },
    tileDescription: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 17,
    },
    publicLink: {
      minHeight: 58,
      borderRadius: 18,
      paddingHorizontal: 15,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    publicLinkText: {
      flex: 1,
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 15,
    },
  });

async function requireEditorAccount(uid: string) {
  const result = await supabase.auth.getUser();
  if (result.error) throw result.error;
  if (result.data.user?.id !== uid)
    throw new Error("La session a changé. Rechargez cet écran.");
}
function ClubRecordEditor({
  id,
  section,
  config,
  record,
  close,
}: {
  id: string;
  section: string;
  config: ClubSection;
  record: Record<string, any>;
  close: () => void;
}) {
  const s = useUIStyles();

  const { session } = useAuth();
  const cache = useQueryClient();
  const uid = session!.user.id;
  const [creationId] = useState(randomUUID);
  const [teamId, setTeamId] = useState(record.team_id || "");
  const [publicationDate] = useState(() => new Date().toISOString());
  const [values, setValues] = useState<Record<string, any>>(() =>
    Object.fromEntries(
      config.fields.map((f) => [
        f.key,
        record[f.key] ??
          f.choices?.[0] ??
          (section === "palmares" && f.key === "year"
            ? String(new Date().getFullYear())
            : f.type === "boolean"
              ? ["is_active", "is_home"].includes(f.key)
              : ""),
      ]),
    ),
  );
  const save = useMutation({
    mutationFn: async () => {
      await requireEditorAccount(uid);
      if (["matches", "convocations"].includes(section))
        await requireCalendarEventAccess(id, uid, teamId);
      else if (config.fffAdminOnly) await requireAttendanceAdmin(id, uid);
      else await requireClubAdmin(id);
      const payload: Record<string, any> = {};
      for (const f of config.fields)
        payload[f.key] = clubFieldValue(f, values[f.key]);
      if (["matches", "convocations"].includes(section))
        payload.team_id = teamId || null;
      if (section === "news")
        payload.published_at = values.is_published
          ? record.published_at || publicationDate
          : null;
      if (section === "news" && !record.id)
        payload.author_id = session!.user.id;
      if (section === "convocations" && !record.id)
        payload.created_by = session!.user.id;
      if (record.id) {
        const response = await supabase.rpc(
          "mutate_native_club_record_snapshot",
          {
            p_section: section,
            p_club_id: id,
            p_id: record.id,
            p_values: payload,
            p_expected: record,
            p_delete: false,
          },
        );
        if (response.error) throw response.error;
      } else {
        const row = { ...payload, id: creationId, club_id: id };
        await createProContent(
          {
            read: async (key) => {
              const result = await supabase
                .from(config.table)
                .select(Object.keys(row).join(","))
                .eq("id", key)
                .eq("club_id", id)
                .returns<Record<string, unknown>[]>()
                .maybeSingle();
              if (result.error) throw result.error;
              return result.data;
            },
            insert: async (value) => {
              const result = await supabase.from(config.table).insert(value);
              if (result.error) throw result.error;
            },
          },
          row,
        );
      }
    },
    onSuccess: () => {
      invalidateClubRecord(cache, id, section);
      close();
    },
  });
  return (
    <>
      <Text style={s.h2}>{record.id ? "Modifier" : "Ajouter"}</Text>
      {!!["matches", "convocations"].includes(section) && (
        <EventTeamField
          clubId={id}
          value={teamId}
          disabled={save.isPending}
          onChange={(next, category) => {
            setTeamId(next);
            if (category) setValues((previous) => ({ ...previous, category }));
          }}
        />
      )}
      {config.fields.map((f) => {
        const set = (v: any) =>
          setValues((previous) => ({ ...previous, [f.key]: v }));
        return f.type === "boolean" ? (
          <View key={f.key} style={s.between}>
            <Text style={s.text}>{f.label}</Text>
            <Switch
              accessibilityLabel={f.label}
              value={!!values[f.key]}
              disabled={save.isPending}
              onValueChange={set}
            />
          </View>
        ) : f.type === "date" ? (
          <DateField
            key={f.key}
            label={f.label}
            value={String(values[f.key])}
            onChange={set}
            disabled={save.isPending}
          />
        ) : f.choices ? (
          <View key={f.key} style={{ gap: 8 }}>
            <Text style={s.label}>{f.label}</Text>
            {f.choices.map((choice) => (
              <Chip
                key={choice}
                label={statusLabels[choice] || choice}
                selected={values[f.key] === choice}
                disabled={save.isPending}
                onPress={() => set(choice)}
              />
            ))}
          </View>
        ) : (
          <Field
            key={f.key}
            label={f.label}
            value={String(values[f.key])}
            onChangeText={set}
            editable={!save.isPending}
            multiline={f.type === "long"}
            keyboardType={f.type === "number" ? "number-pad" : "default"}
          />
        );
      })}
      {!!save.error && <ErrorState error={save.error} />}
      <Button
        title="Enregistrer"
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
