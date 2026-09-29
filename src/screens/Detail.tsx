import {
  ClubDesignProvider,
  ClubSheet,
  ClubLogo,
  useClubBrand,
  useClubUIStyles,
  ClubButton,
} from "../components/ClubDesign";
import { ClubProfileLayout } from "../components/ClubProfileLayout";
import { ClubLiveSection } from "../components/ClubLiveSection";
import { ClubMatchComments } from "../components/ClubMatchComments";
import { canFilmMatch } from "../lib/matchFilming";
import { findClubLogo } from "../lib/clubLogo";
import {
  selectFeaturedClubMatch,
  parseMatchDateTime,
  isFlagshipCategory,
  type Team as FootballTeam,
} from "../lib/clubFeaturedMatch";
import { ClubCommunityPanel } from "../components/ClubCommunityPanel";
import { publicClubUrl } from "../lib/professionalContact";
import { Image } from "expo-image";
import Svg, { Circle, ClipPath, Defs, G, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from "react-native-svg";
import qrcode from "qrcode-generator";
import { LinearGradient } from "expo-linear-gradient";
import { ClubManagedMatches } from "../components/ClubManagedMatches";
import { ClubMedia } from "../components/ClubMedia";
import { ClubRoster } from "../components/ClubRoster";
import { ClubAbout } from "../components/ClubAbout";
import { ClubAchievements } from "../components/ClubAchievements";
import { ClubPublicInformation } from "../components/ClubPublicInformation";
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { ClubFootball } from "./ClubFootball";
import { useAuth } from "../lib/auth";
import React, { useEffect, useMemo, useState } from "react";
import {
  Linking,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, requireBackend } from "../lib/supabase";
import {
  Building2,
  CalendarDays,
  Camera,
  ChevronRight,
  CircleDot,
  Grid3X3,
  MapPin,
  Newspaper,
  Radio,
  Share2,
  Shield,
  Shirt,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react-native";
import {
  Avatar,
  Banner,
  Button,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { AuthGate } from "../components/AuthGate";
import { Application } from "./OpportunityActions";
import { opportunityTypes } from "./Opportunities";
import {
  signature,
  useTheme,
  useThemedStyles,
  type ThemeColors,
} from "../theme";
export function ClubDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["club", id],
    queryFn: async () => {
      requireBackend();
      const { data, error } = await supabase
        .from("fff_clubs")
        .select("*")
        .eq(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id,
          )
            ? "id"
            : "slug",
          id,
        )
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (query.isPending)
    return (
      <Screen title="Le club">
        <Loading />
      </Screen>
    );
  if (query.isError)
    return (
      <Screen title="Le club">
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      </Screen>
    );
  return (
    <ClubDesignProvider club={query.data}>
      <ClubProfileContent key={query.data.id} club={query.data} />
    </ClubDesignProvider>
  );
}

function ClubProfileContent({ club }: { club: Record<string, any> }) {
  const [clubTab, setClubTab] = useState("infos");
  const [counterPanel, setCounterPanel] = useState<string | null>(null);
  const panelTitles: Record<string, string> = {
    publications: "Publications",
    followers: "FootLovers",
    members: "Membres",
    fans: "Fans",
  };
  return (
    <ClubProfileLayout
      club={club}
      active={clubTab}
      onSelect={setClubTab}
      onCounter={(key) =>
        key === "publications"
          ? setClubTab("publications")
          : setCounterPanel(key)
      }
    >
      <ClubSheet
        visible={counterPanel !== null}
        title={panelTitles[counterPanel || ""] || "Le club"}
        subtitle={club.short_name || club.name}
        onClose={() => setCounterPanel(null)}
      >
        {counterPanel === "publications" ? (
          <ClubMedia
            key="counter-publications"
            id={club.id}
            hideHeading
            fixedMode
          />
        ) : counterPanel ? (
          <ClubCommunityPanel
            key={counterPanel}
            id={club.id}
            name={club.name}
            mode={counterPanel}
            hideHeading
            onOpenProfile={() => setCounterPanel(null)}
          />
        ) : null}
      </ClubSheet>
      {clubTab === "infos" && (
        <>
          <ClubFeaturedMatch
            clubId={club.id}
            clubName={club.short_name || club.name}
            clubLogoUrl={club.logo_url}
          />
          <ClubPublicInformation club={club} />
        </>
      )}
      {clubTab === "publications" && (
        <ClubMedia id={club.id} name={club.name} />
      )}
      {clubTab === "teams" && (
        <>
          <ClubFootball
            key="teams"
            id={club.id}
            clubName={club.name}
            clubLogoUrl={club.logo_url}
            contextual
          />
          <ClubRoster id={club.id} />
        </>
      )}
      {clubTab === "matches" && (
        <>
          <ClubFootball
            key="matches"
            id={club.id}
            clubName={club.name}
            clubLogoUrl={club.logo_url}
            initialTab="upcomingMatches"
            contextual
          />
          <ClubManagedMatches id={club.id} name={club.name} />
        </>
      )}
      {clubTab === "live" && <ClubLiveSection clubId={club.id} />}
      {clubTab === "about" && <ClubAbout club={club} />}
      {clubTab === "sport" && (
        <ClubAchievements id={club.id} legacy={club.achievements?.titles} />
      )}
      {clubTab === "qr" && <ClubQrCard club={club as any} />}
      {clubTab === "top" && (
        <ClubCommunityPanel id={club.id} name={club.name} mode="top" />
      )}
    </ClubProfileLayout>
  );
}

type ClubLiveMatch = ClubLandingMatch & {
  opponent_logo_url: string | null;
  home_score: number | null;
  away_score: number | null;
};

function matchWindow() {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 21);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function liveMatchLabel(status: string | null, matchDate: string) {
  const normalized = String(status || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized === "live") return "En direct";
  if (normalized === "finished") return "Terminé";
  if (normalized === "postponed") return "Reporté";
  if (normalized === "cancelled") return "Annulé";
  const date = new Date(matchDate);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now()
    ? "À venir"
    : "À suivre";
}

function ClubLiveMatches({
  clubId,
  clubName,
  clubLogoUrl,
}: {
  clubId: string;
  clubName: string;
  clubLogoUrl?: string | null;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createClubDetailStyles);
  const query = useQuery({
    queryKey: ["club-live-match-strip", clubId],
    queryFn: async () => {
      const { start, end } = matchWindow();
      const { data, error } = await supabase
        .from("club_matches")
        .select(
          "id,opponent_name,opponent_logo_url,category,match_date,is_home,competition,venue,status,home_score,away_score",
        )
        .eq("club_id", clubId)
        .gte("match_date", start)
        .lte("match_date", end)
        .order("match_date", { ascending: true })
        .order("id")
        .limit(30)
        .returns<ClubLiveMatch[]>();
      if (error) throw error;
      const now = Date.now();
      return (data || [])
        .map((match) => ({
          ...match,
          rank:
            match.status === "live"
              ? 0
              : Date.parse(match.match_date) >= now
                ? 1
                : 2,
        }))
        .sort((a, b) => {
          if (a.rank !== b.rank) return a.rank - b.rank;
          if (a.rank === 2)
            return Date.parse(b.match_date) - Date.parse(a.match_date);
          return Date.parse(a.match_date) - Date.parse(b.match_date);
        })
        .slice(0, 8);
    },
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.some((match) => match.status === "live")
        ? 30_000
        : 120_000,
  });
  if (query.isPending) {
    return (
      <View style={styles.liveClubCard}>
        <View style={styles.liveClubHeader}>
          <View style={styles.liveClubTitleRow}>
            <Radio size={18} color="#EF4444" />
            <Text style={styles.liveClubTitle}>Matchs du club</Text>
          </View>
          <ActivityIndicator size="small" color={colors.blue} />
        </View>
      </View>
    );
  }
  if (query.error) {
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  }
  if (!query.data?.length) return null;
  return (
    <View style={styles.liveClubCard}>
      <View style={styles.liveClubHeader}>
        <View style={styles.liveClubTitleRow}>
          <Radio size={18} color="#EF4444" />
          <Text style={styles.liveClubTitle}>Matchs du club en direct</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Actualiser les matchs du club"
          onPress={() => void query.refetch()}
          style={styles.liveRefresh}
        >
          <Text style={styles.liveRefreshText}>
            {query.isFetching ? "Actualisation" : "Actualiser"}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.liveClubSubtitle}>
        Suivez les équipes de {clubName} : directs, prochains matchs et derniers
        résultats.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.liveClubScroller}
      >
        {query.data.map((match) => {
          const label = liveMatchLabel(match.status, match.match_date);
          const live = match.status === "live";
          const home = match.is_home ? clubName : match.opponent_name;
          const away = match.is_home ? match.opponent_name : clubName;
          const homeScore = Number.isInteger(match.home_score)
            ? match.home_score
            : "–";
          const awayScore = Number.isInteger(match.away_score)
            ? match.away_score
            : "–";
          const date = new Date(match.match_date);
          const dateLabel = Number.isFinite(date.getTime())
            ? date.toLocaleString("fr-FR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Date à confirmer";
          return (
            <Pressable
              key={match.id}
              accessibilityRole="button"
              accessibilityLabel={`${home} contre ${away}. ${label}. Score ${homeScore} à ${awayScore}.`}
              onPress={() => router.push(`/club/${clubId}/member`)}
              style={({ pressed }) => [
                styles.liveMatchTile,
                live && styles.liveMatchTileActive,
                { opacity: pressed ? 0.72 : 1 },
              ]}
            >
              <View style={styles.liveTileTop}>
                <View
                  style={[styles.liveBadge, live && styles.liveBadgeActive]}
                >
                  {!!live && <View style={styles.liveBadgeDot} />}
                  <Text
                    style={[
                      styles.liveBadgeText,
                      live && styles.liveBadgeTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
                <Text style={styles.liveDateText}>{dateLabel}</Text>
              </View>
              <View style={styles.liveTeamsRow}>
                <Text style={styles.liveTeamName} numberOfLines={2}>
                  {home}
                </Text>
                <Text style={styles.liveScoreText}>
                  {homeScore} - {awayScore}
                </Text>
                <Text style={styles.liveTeamName} numberOfLines={2}>
                  {away}
                </Text>
              </View>
              <Text style={styles.liveMetaText} numberOfLines={2}>
                {[match.category, match.competition, match.venue]
                  .filter(Boolean)
                  .join(" · ") || "Match du club"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.liveClubActions}>
        <Button
          title="Voir toute la vie sportive"
          secondary
          onPress={() => router.push(`/club/${clubId}/member`)}
        />
        <Button
          title="Filmer un match"
          onPress={() =>
            router.push(`/live?clubId=${encodeURIComponent(clubId)}`)
          }
        />
      </View>
    </View>
  );
}

function ClubQrCard({
  club,
}: {
  club: {
    id: string;
    slug?: string | null;
    name: string;
    logo_url?: string | null;
  };
}) {
  const styles = useThemedStyles(createClubDetailStyles);
  const brand = useClubBrand();
  const { colors } = useTheme();
  const [error, setError] = useState<unknown>(null);
  const url = publicClubUrl(club);
  const { width } = useWindowDimensions();
  const qr = useMemo(() => {
    // High error correction keeps the code readable beneath the central crest.
    const value = qrcode(0, "H");
    value.addData(url);
    value.make();
    const count = value.getModuleCount();
    let path = "";
    for (let y = 0; y < count; y++)
      for (let x = 0; x < count; x++)
        if (value.isDark(y, x)) path += `M${x + 4} ${y + 4}h1v1h-1z`;
    return { size: count + 8, path };
  }, [url]);
  return (
    <View
      style={[
        styles.clubQrCard,
        {
          flexDirection: width < 600 ? "column" : "row",
          padding: 24,
          borderRadius: 20,
        },
      ]}
    >
      <View
        style={[
          styles.clubQrCopy,
          width < 600 && { flex: undefined, width: "100%" },
        ]}
      >
        <View style={styles.clubQrTitleRow}>
          <View style={[styles.clubQrIcon, { backgroundColor: brand.accent }]}>
            <Shield size={18} color={colors.white} />
          </View>
          <Text style={styles.clubQrTitle}>QR code du club</Text>
        </View>
        <Text style={styles.clubQrText}>
          Faites scanner ce code pour ouvrir la vitrine du club et rejoindre sa
          communauté.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Partager le QR code du club"
          onPress={() => {
            setError(null);
            void Share.share({
              title: "Club FootNation",
              message: `${club.name} sur FootNation\n${url}`,
            }).catch(setError);
          }}
          style={({ pressed }) => [
            styles.clubQrButton,
            { opacity: pressed ? 0.72 : 1 },
          ]}
        >
          <Share2 size={17} color={colors.blue} />
          <Text style={styles.clubQrButtonText}>Partager</Text>
        </Pressable>
        {!!error && (
          <Text accessibilityRole="alert" style={styles.clubQrError}>
            Le partage n’est pas disponible. Réessayez.
          </Text>
        )}
      </View>
      <View style={styles.clubQrFrame}>
        <View style={{ width: 210, height: 210 }}>
          <Svg
            width={210}
            height={210}
            viewBox="0 0 210 210"
            accessibilityLabel={`QR code de la vitrine ${club.name}`}
            accessibilityRole="image"
          >
            <Defs>
              <SvgLinearGradient id="clubQrBall" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={brand.accent} />
                <Stop offset="1" stopColor={colors.blue} />
              </SvgLinearGradient>
              <ClipPath id="clubQrBallClip">
                <Circle cx={105} cy={105} r={96} />
              </ClipPath>
            </Defs>
            <Circle cx={105} cy={105} r={100} fill="url(#clubQrBall)" />
            <G
              clipPath="url(#clubQrBallClip)"
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity={0.48}
              strokeWidth={5}
            >
              <Path d="M105 9c22 23 34 52 34 96s-12 73-34 96M105 9c-22 23-34 52-34 96s12 73 34 96" />
              <Path d="M14 76c24 15 54 21 91 21s67-6 91-21M14 134c24-15 54-21 91-21s67 6 91 21" />
              <Path d="M42 36c12 16 22 33 28 52M168 36c-12 16-22 33-28 52M42 174c12-16 22-33 28-52M168 174c-12-16-22-33-28-52" />
            </G>
            <Circle cx={105} cy={105} r={82} fill="#FFFFFF" />
            <Circle
              cx={105}
              cy={105}
              r={91}
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity={0.68}
              strokeWidth={3}
              strokeDasharray="6 4"
            />
            <G transform={`translate(27 27) scale(${156 / qr.size})`}>
              <Path d={qr.path} fill={brand.accent} />
            </G>
          </Svg>
          {!!club.logo_url && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { alignItems: "center", justifyContent: "center" },
              ]}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ClubLogo uri={club.logo_url} name={club.name} size={34} />
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function ClubStat({
  value,
  label,
  onPress,
}: {
  value?: number | null;
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createClubDetailStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value ?? "Nombre indisponible"} ${label}`}
      onPress={onPress}
      style={[styles.stat, { minHeight: 48 }]}
    >
      <Text style={styles.statValue}>{value ?? "—"}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}
type ClubLandingMatch = {
  id: string;
  opponent_name: string;
  opponent_logo_url?: string | null;
  category: string | null;
  match_date: string;
  is_home: boolean;
  competition: string | null;
  venue: string | null;
  status: string | null;
};

function ClubFeaturedMatch({
  clubId,
  clubName,
  clubLogoUrl,
}: {
  clubId: string;
  clubName: string;
  clubLogoUrl?: string | null;
}) {
  const { colors } = useTheme();
  const s = useClubUIStyles();
  const brand = useClubBrand();
  const styles = useThemedStyles(createClubDetailStyles);
  const { session } = useAuth();
  const [clock, setClock] = useState(Date.now());
  const [filmingError, setFilmingError] = useState<Error | null>(null);
  const [votesOpen, setVotesOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["club-featured-seniors-match", clubId],
    queryFn: async () => {
      const now = new Date(Date.now() - 3600000).toISOString();
      const result = await supabase
        .from("club_matches")
        .select(
          "id,opponent_name,opponent_logo_url,category,match_date,is_home,competition,venue,status",
        )
        .eq("club_id", clubId)
        .or(`match_date.gte.${now},status.eq.live`)
        .order("match_date", { ascending: true })
        .order("id")
        .limit(50)
        .returns<ClubLandingMatch[]>();
      const external = await supabase.functions.invoke("club-details", {
        body: { clubId },
      });
      const details = external.data;
      const teams: FootballTeam[] = details?.teams || [];
      const selected =
        !external.error && !details?.error
          ? selectFeaturedClubMatch(
              teams,
              [
                ...(details?.upcomingMatches || []),
                ...(details?.pastMatches || []),
              ],
              new Date(Date.now() - 3600000),
            )
          : null;
      const local = (result.data || []).filter(
        (match) =>
          match.status !== "postponed" &&
          match.status !== "cancelled" &&
          match.status !== "finished",
      );
      const seniorLocal = local.find((match) =>
        isFlagshipCategory(match.category || ""),
      );
      let imported: ClubLandingMatch | null = null;
      if (selected) {
        const homeTeam = teams.find((team) => team.id === selected.homeTeam.id);
        const awayTeam = teams.find((team) => team.id === selected.awayTeam.id);
        const isHome = !!homeTeam;
        const opponent = isHome ? selected.awayTeam : selected.homeTeam;
        imported = {
          id: selected.id,
          opponent_name: opponent.name,
          opponent_logo_url: opponent.logo || null,
          category:
            (homeTeam || awayTeam)?.category ||
            (homeTeam || awayTeam)?.shortName ||
            null,
          match_date: parseMatchDateTime(
            selected.date,
            selected.time,
          )!.toISOString(),
          is_home: isHome,
          competition: selected.competition || null,
          venue: selected.venue || null,
          status: selected.status,
        };
      }
      const seniors = [
        seniorLocal,
        imported && isFlagshipCategory(imported.category || "")
          ? imported
          : null,
      ]
        .filter((match): match is ClubLandingMatch => !!match)
        .sort((a, b) => Date.parse(a.match_date) - Date.parse(b.match_date));
      const featured = seniors[0] || imported || local[0];
      if (featured) {
        if (!featured.opponent_logo_url)
          featured.opponent_logo_url = await findClubLogo(
            featured.opponent_name,
          );
        return featured;
      }
      if (external.error || details?.error)
        throw external.error || new Error(details.error);
      if (result.error) throw result.error;
      return null;
    },
  });
  const prediction = useQuery({
    queryKey: ["club-match-prediction", query.data?.id, session?.user.id],
    enabled: !!query.data,
    queryFn: async () => {
      const matchId = query.data!.id;
      const stats = await supabase
        .from("match_prediction_stats")
        .select("*")
        .eq("match_id", matchId)
        .maybeSingle();
      if (stats.error) throw stats.error;
      let own: string | null = null;
      if (session) {
        const ownResult = await supabase
          .from("match_predictions")
          .select("prediction")
          .eq("match_id", matchId)
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (ownResult.error) throw ownResult.error;
        own = ownResult.data?.prediction || null;
      }
      return { stats: stats.data, own };
    },
  });
  const voters = useQuery({
    queryKey: ["club-match-prediction-voters", query.data?.id],
    enabled: !!query.data && votesOpen,
    queryFn: async () => {
      const matchId = query.data!.id;
      const votes = await supabase
        .from("match_predictions")
        .select("user_id,prediction,created_at")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });
      if (votes.error) throw votes.error;
      const userIds = Array.from(
        new Set((votes.data || []).map((row) => row.user_id).filter(Boolean)),
      );
      const profilesById = new Map<
        string,
        {
          id: string;
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          username: string | null;
          avatar_url: string | null;
        }
      >();
      if (userIds.length) {
        const profiles = await supabase
          .from("profiles")
          .select("id,full_name,first_name,last_name,username,avatar_url")
          .in("id", userIds);
        if (profiles.error) throw profiles.error;
        (profiles.data || []).forEach((profile) =>
          profilesById.set(profile.id, profile),
        );
      }
      return (votes.data || []).map((row) => ({
        ...row,
        profile: profilesById.get(row.user_id),
      }));
    },
  });
  const vote = useMutation({
    mutationFn: async (choice: "home" | "draw" | "away") => {
      if (!session) throw new Error("Connectez-vous pour pronostiquer.");
      if (!query.data) throw new Error("Match indisponible.");
      if (Date.parse(query.data.match_date) <= Date.now())
        throw new Error("Les pronostics sont fermés pour ce match.");
      const result = await supabase
        .from("match_predictions")
        .upsert(
          {
            match_id: query.data.id,
            user_id: session.user.id,
            prediction: choice,
          },
          { onConflict: "match_id,user_id" },
        )
        .select("id")
        .single();
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      void cache.invalidateQueries({
        queryKey: ["club-match-prediction", query.data?.id],
      });
      void cache.invalidateQueries({
        queryKey: ["club-match-prediction-voters", query.data?.id],
      });
    },
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  if (!query.data) return null;
  const match = query.data;
  const home = match.is_home ? clubName : match.opponent_name;
  const away = match.is_home ? match.opponent_name : clubName;
  const homeLogo = match.is_home ? clubLogoUrl : match.opponent_logo_url;
  const awayLogo = match.is_home ? match.opponent_logo_url : clubLogoUrl;
  const date = new Date(match.match_date);
  const closed = Date.parse(match.match_date) <= Date.now();
  const total = prediction.data?.stats?.total_count || 0;
  const meta = [match.competition, match.venue].filter(Boolean).join(" · ");
  return (
    <View style={styles.featuredMatchCard}>
      <LinearGradient
        colors={[brand.hero, brand.heroEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.featuredMatchPoster}
      >
        <View style={styles.featuredMatchTitleRow}>
          <Trophy size={16} color="#D8E2EC" />
          <Text style={styles.featuredMatchEyebrow}>Prochain match</Text>
          <Text style={styles.featuredMatchCategory}>
            {match.category || ""}
          </Text>
        </View>
        <View style={styles.matchPosterScoreboard}>
          <MatchTeamBadge name={home} logoUrl={homeLogo} align="left" />
          <View style={styles.matchTimeBlock}>
            <Text style={styles.matchTime}>
              {date.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <Text style={styles.matchDate}>
              {date.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
          </View>
          <MatchTeamBadge name={away} logoUrl={awayLogo} align="right" />
        </View>
        <View style={styles.featuredMatchMetaBar}>
          <Text style={styles.featuredMatchMetaText}>
            {isSeniorMenFirstTeam(match.category)
              ? "Équipe fanion"
              : match.category || "Football"}
          </Text>
          {!!meta && (
            <Text style={styles.featuredMatchMetaText} numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>
      </LinearGradient>

      <View style={styles.predictionBlock}>
        <Text style={styles.predictionTitle}>Votre pronostic</Text>
        <View style={styles.predictionChoices}>
          {(
            [
              ["home", home, homeLogo],
              ["draw", "Match nul", null],
              ["away", away, awayLogo],
            ] as const
          ).map(([choice, label, logo]) => {
            const selected = prediction.data?.own === choice;
            const count = prediction.data?.stats?.[`${choice}_count`] || 0;
            const percent = total ? Math.round((count * 100) / total) : 33;
            return (
              <Pressable
                key={choice}
                accessibilityRole="button"
                accessibilityLabel={`Pronostiquer ${label}`}
                aria-selected={selected}
                accessibilityState={{
                  selected,
                  disabled: closed || vote.isPending,
                }}
                disabled={closed || vote.isPending}
                onPress={() => vote.mutate(choice)}
                style={[
                  styles.predictionChoice,
                  selected && styles.predictionChoiceSelected,
                ]}
              >
                <View
                  style={[
                    styles.predictionLogoRing,
                    selected && { borderColor: colors.blue },
                  ]}
                >
                  {choice === "draw" ? (
                    <Text style={[styles.drawIcon, { color: brand.accent }]}>
                      N
                    </Text>
                  ) : (
                    <ClubLogo uri={logo} name={label} size={30} />
                  )}
                </View>
                <Text style={styles.predictionChoiceText}>{label}</Text>
                <Text style={styles.predictionPercent}>{percent} %</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voir le détail des votes"
          disabled={!total}
          onPress={() => setVotesOpen(true)}
          style={({ pressed }) => [
            styles.voteCountRow,
            { opacity: !total ? 0.65 : pressed ? 0.7 : 1 },
          ]}
        >
          <Users size={16} color={colors.muted} />
          <Text style={styles.voteCountText}>
            {total} vote{total > 1 ? "s" : ""}
            {total ? " · Voir les pronostics" : ""}
          </Text>
        </Pressable>
        <ClubSheet
          visible={votesOpen}
          title="Les pronostics"
          subtitle={`${home} · ${away}`}
          onClose={() => setVotesOpen(false)}
        >
          {voters.isPending ? (
            <Loading />
          ) : voters.error ? (
            <ErrorState
              error={voters.error}
              retry={() => void voters.refetch()}
            />
          ) : (
            <>
              {(
                [
                  ["home", home],
                  ["draw", "Match nul"],
                  ["away", away],
                ] as const
              ).map(([choice, label]) => {
                const rows =
                  voters.data?.filter((row) => row.prediction === choice) || [];
                return (
                  <View key={choice} style={styles.voteGroup}>
                    <View style={styles.voteGroupHeader}>
                      <Text style={styles.voteGroupTitle}>{label}</Text>
                      <Text style={styles.voteGroupCount}>
                        {rows.length} vote{rows.length > 1 ? "s" : ""}
                      </Text>
                    </View>
                    {rows.length
                      ? rows.map((row) => {
                          const name =
                            row.profile?.full_name ||
                            [row.profile?.first_name, row.profile?.last_name]
                              .filter(Boolean)
                              .join(" ") ||
                            row.profile?.username ||
                            "Utilisateur FootNation";
                          return (
                            <Pressable
                              key={`${row.user_id}:${row.prediction}`}
                              accessibilityRole="button"
                              accessibilityLabel={`Voir le profil de ${name}`}
                              onPress={() => {
                                setVotesOpen(false);
                                router.push(`/profile/${row.user_id}`);
                              }}
                              style={({ pressed }) => [
                                styles.votePersonRow,
                                { opacity: pressed ? 0.7 : 1 },
                              ]}
                            >
                              <Avatar
                                uri={row.profile?.avatar_url}
                                name={name}
                                size={34}
                              />
                              <Text style={styles.votePersonName}>{name}</Text>
                              <ChevronRight size={18} color={colors.muted} />
                            </Pressable>
                          );
                        })
                      : null}
                  </View>
                );
              })}
            </>
          )}
        </ClubSheet>
        {!session && (
          <ClubButton
            title="Se connecter pour pronostiquer"
            onPress={() =>
              router.push({
                pathname: "/login",
                params: { next: `/club/${clubId}` },
              })
            }
          />
        )}
        {!!closed && <Text style={s.small}>Pronostics fermés</Text>}
        {!!prediction.error && <ErrorState error={prediction.error} />}
        {!!vote.error && <ErrorState error={vote.error} />}
      </View>
      <View style={styles.featuredActions}>
        <Text style={[s.small, { textAlign: "center" }]}>
          Filmer le match · de 1 h avant à 1 h après le coup d’envoi
        </Text>
        {!!filmingError && <ErrorState error={filmingError} />}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <ClubButton
              title="Filmer le match"
              disabled={!canFilmMatch(match.match_date, clock)}
              onPress={async () => {
                if (!canFilmMatch(match.match_date)) return;
                setFilmingError(null);
                try {
                  await Linking.openURL(
                    `https://www.foot-nation.com/live/broadcast/${encodeURIComponent(clubId)}?match=${encodeURIComponent(match.id)}&title=${encodeURIComponent(`${home} vs ${away}`)}&date=${encodeURIComponent(match.match_date)}&time=${encodeURIComponent(match.match_date)}`,
                  );
                } catch {
                  setFilmingError(
                    new Error("Impossible d’ouvrir l’écran de diffusion."),
                  );
                }
              }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <ClubButton
              secondary
              title={commentsOpen ? "Masquer les commentaires" : "Commenter"}
              onPress={() => setCommentsOpen((value) => !value)}
            />
          </View>
        </View>
        {commentsOpen && <ClubMatchComments matchId={match.id} />}
      </View>
    </View>
  );
}

function MatchTeamBadge({
  name,
  logoUrl,
  align,
}: {
  name: string;
  logoUrl?: string | null;
  align: "left" | "right";
}) {
  const styles = useThemedStyles(createClubDetailStyles);
  return (
    <View style={styles.posterTeam}>
      <ClubLogo uri={logoUrl} name={name} size={60} />
      <Text
        style={[
          styles.posterTeamName,
          align === "left" ? styles.posterTeamLeft : styles.posterTeamRight,
        ]}
      >
        {name}
      </Text>
    </View>
  );
}

function isSeniorMenFirstTeam(category: string | null | undefined) {
  const normalized = String(category || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const isSenior = normalized.includes("senior");
  const isMale =
    normalized.includes("masculin") ||
    normalized.includes("homme") ||
    /\bm\s*1\b/.test(normalized) ||
    normalized.includes("senior m");
  const isFirst =
    /\b1\b/.test(normalized) ||
    /\bm\s*1\b/.test(normalized) ||
    normalized.includes("equipe premiere") ||
    normalized.includes("premiere");
  return isSenior && isMale && isFirst;
}

const createClubDetailStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    stat: {
      alignItems: "center",
      flex: 1,
      gap: 3,
      borderLeftWidth: 1,
      borderLeftColor: "rgba(255,255,255,0.12)",
    },
    statValue: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 23,
      lineHeight: 29,
      fontWeight: "800",
    },
    statLabel: {
      color: "rgba(255,255,255,0.68)",
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
    },
    clubQrCard: {
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      shadowColor: "#101828",
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    clubQrCopy: { flex: 1, minWidth: 0, gap: 10 },
    clubQrTitleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
    clubQrIcon: {
      width: 34,
      height: 34,
      borderRadius: 13,
      backgroundColor: colors.deepBlue,
      alignItems: "center",
      justifyContent: "center",
    },
    clubQrTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "900",
      flexShrink: 1,
    },
    clubQrText: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 20,
    },
    clubQrButton: {
      alignSelf: "flex-start",
      minHeight: 44,
      borderRadius: 14,
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderWidth: 1.5,
      borderColor: colors.blue,
      backgroundColor: colors.surface,
    },
    clubQrButtonText: {
      color: colors.blue,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "900",
    },
    clubQrFrame: {
      width: 226,
      height: 226,
      borderRadius: 113,
      padding: 8,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 0,
      borderColor: colors.border,
    },
    clubQrError: {
      color: colors.danger,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 17,
    },
    featuredMatchCard: {
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      gap: 0,
      backgroundColor: colors.surface,
      shadowColor: "#101828",
      shadowOpacity: 0.04,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    featuredMatchPoster: { padding: 20, gap: 22 },
    featuredMatchTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    featuredMatchEyebrow: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "800",
      flexShrink: 1,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    featuredMatchCategory: {
      marginLeft: "auto",
      maxWidth: "40%",
      flexShrink: 1,
      textAlign: "right",
      color: "rgba(255,255,255,0.88)",
      fontFamily: "Inter-Bold",
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.8,
    },
    matchPosterScoreboard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    posterTeam: { flex: 1, minWidth: 0, alignItems: "center", gap: 8 },
    posterTeamName: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      lineHeight: 19,
      fontWeight: "700",
      width: "100%",
    },
    posterTeamLeft: { textAlign: "center" },
    posterTeamRight: { textAlign: "center" },
    matchTimeBlock: {
      width: 96,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    matchTime: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 36,
      lineHeight: 42,
      fontWeight: "900",
      letterSpacing: -1.2,
    },
    matchDate: {
      color: "rgba(255,255,255,0.74)",
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 16,
      textAlign: "center",
      textTransform: "capitalize",
    },
    featuredMatchMetaBar: {
      marginHorizontal: -20,
      marginBottom: -20,
      minHeight: 44,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      backgroundColor: "rgba(15,23,42,0.62)",
    },
    featuredMatchMetaText: {
      color: "rgba(255,255,255,0.82)",
      fontFamily: "Inter-Bold",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
      flexShrink: 1,
    },
    predictionBlock: {
      gap: 14,
      padding: 18,
      backgroundColor: colors.surface,
    },
    predictionTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "900",
      textAlign: "center",
    },
    predictionChoices: { flexDirection: "row", gap: 8 },
    predictionChoice: {
      flex: 1,
      minWidth: 0,
      minHeight: 124,
      paddingVertical: 10,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingHorizontal: 6,
      backgroundColor: colors.surface,
    },
    predictionChoiceSelected: {
      borderColor: colors.blue,
      backgroundColor: colors.accentSoft,
    },
    predictionLogoRing: {
      width: 40,
      height: 40,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      backgroundColor: colors.white,
    },
    predictionLogo: { width: "100%", height: "100%" },
    drawIcon: {
      color: colors.deepBlue,
      fontFamily: "Inter-Bold",
      fontSize: 20,
      lineHeight: 28,
      fontWeight: "700",
    },
    predictionChoiceText: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
      maxWidth: "100%",
      textAlign: "center",
    },
    predictionPercent: {
      color: colors.blue,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },
    voteCountRow: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    voteCountText: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 18,
    },
    voteGroup: {
      paddingVertical: 16,
      gap: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    voteGroupHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    voteGroupTitle: {
      flex: 1,
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      lineHeight: 21,
      fontWeight: "800",
    },
    voteGroupCount: {
      color: colors.muted,
      fontFamily: "Inter-Bold",
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "900",
    },
    votePersonRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44,
      gap: 10,
      paddingVertical: 4,
    },
    votePersonName: {
      flex: 1,
      color: colors.ink,
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 19,
    },
    featuredActions: {
      gap: 12,
      padding: 18,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    liveClubCard: {
      padding: 16,
      borderRadius: 24,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: "#101828",
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    liveClubHeader: {
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    liveClubTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    liveClubTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "900",
      flexShrink: 1,
    },
    liveClubSubtitle: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 20,
    },
    liveRefresh: {
      minHeight: 34,
      borderRadius: 17,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(59,130,246,0.12)",
    },
    liveRefreshText: {
      color: colors.blue,
      fontFamily: "Inter-Bold",
      fontSize: 12,
      fontWeight: "800",
    },
    liveClubScroller: {
      gap: 10,
      paddingRight: 4,
    },
    liveMatchTile: {
      width: 250,
      minHeight: 158,
      borderRadius: 20,
      padding: 14,
      gap: 11,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    liveMatchTileActive: {
      borderColor: "rgba(239,68,68,0.45)",
      backgroundColor: "#FFF1F2",
    },
    liveTileTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    liveBadge: {
      minHeight: 26,
      borderRadius: 13,
      paddingHorizontal: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(59,130,246,0.12)",
    },
    liveBadgeActive: {
      backgroundColor: "#EF4444",
    },
    liveBadgeDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: colors.white,
    },
    liveBadgeText: {
      color: colors.blue,
      fontFamily: "Inter-Bold",
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    liveBadgeTextActive: {
      color: colors.white,
    },
    liveDateText: {
      color: colors.muted,
      fontFamily: "Inter-SemiBold",
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "700",
      flexShrink: 0,
    },
    liveTeamsRow: {
      gap: 7,
    },
    liveTeamName: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "800",
    },
    liveScoreText: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 25,
      lineHeight: 31,
      fontWeight: "900",
    },
    liveMetaText: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 17,
    },
    liveClubActions: {
      gap: 10,
    },
    clubTabLabelActive: {
      color: colors.white,
    },
  });

export function OpportunityDetail() {
  const s = useUIStyles();

  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["opportunity", id],
    queryFn: async () => {
      requireBackend();
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  return (
    <Screen title="Opportunité">
      <AuthGate>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : (
          <>
            <Banner
              eyebrow={
                opportunityTypes.find(
                  ([v]) => v === query.data.opportunity_type,
                )?.[1] || "OPPORTUNITÉ"
              }
              title={query.data.title}
              description={[
                query.data.location_city,
                query.data.location_department,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
            <Text style={s.text} selectable>
              {query.data.description}
            </Text>
            {!!query.data.target_profile_type && (
              <Text style={s.subtitle}>
                Profil recherché : {query.data.target_profile_type}
              </Text>
            )}
            <Button
              title="Voir le profil de l’auteur"
              onPress={() => router.push(`/profile/${query.data.user_id}`)}
            />
            <Application
              offer={query.data as import("./OpportunityActions").Offer}
            />
          </>
        )}
      </AuthGate>
    </Screen>
  );
}
