import * as Location from "expo-location";
import {
  loadExploreContext,
  loadExplorePriority,
  searchWithPriorities,
} from "../lib/exploreRanking";
import type { MapLocation } from "../lib/clubMap";
import { blockedSocialAuthors } from "../lib/socialVisibility";
import { MediaGrid } from "../components/MediaGrid";
import {
  parseProfileInfoSearchField,
  profileInfoSearchFields,
  type ProfileInfoSearchField,
} from "../lib/profileInfoActions";
import React, { useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  MapPin,
  Menu,
  Search,
  Shield,
  SlidersHorizontal,
  Trophy,
  Users,
} from "lucide-react-native";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useDebounced, useProfile } from "../lib/data";
import type { Profile } from "../lib/models";
import { supabase } from "../lib/supabase";
import {
  searchFootNation,
  searchCategories,
  type SearchCategory,
} from "../lib/globalSearch";
import { AuthGate } from "../components/AuthGate";
import { AccountMenu } from "../components/AccountMenu";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
export default function GlobalSearch() {
  const { session } = useAuth();
  const { q, type, field } = useLocalSearchParams<{
    q?: string;
    type?: string;
    field?: string;
  }>();
  return (
    <SearchContent
      key={`${session?.user.id}/${q}/${type}/${field}`}
      profileField={parseProfileInfoSearchField(field)}
      initial={q || ""}
      category={
        searchCategories.some((item) => item.key === type)
          ? (type as SearchCategory)
          : "all"
      }
    />
  );
}

const createExploreStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#06111D" },
    content: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 104,
      gap: 16,
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
    },
    header: { gap: 18 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    titleLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minWidth: 0,
      flexShrink: 1,
    },
    backIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    title: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 32,
      lineHeight: 38,
      fontWeight: "800",
    },
    titleActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    filterIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    searchBox: {
      minHeight: 58,
      borderRadius: 18,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "#102033",
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      color: colors.white,
      fontFamily: "Inter-Regular",
      fontSize: 16,
    },
    filters: { gap: 10, paddingRight: 18 },
    filterPill: {
      minHeight: 48,
      borderRadius: 16,
      paddingHorizontal: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#102033",
    },
    filterPillActive: { backgroundColor: colors.white },
    filterPillText: {
      color: "rgba(255,255,255,0.72)",
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "700",
    },
    filterPillTextActive: { color: "#06111D" },
    featuredWrap: { gap: 26 },
    featuredSection: { gap: 12 },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 21,
      lineHeight: 27,
      fontWeight: "800",
    },
    seeAll: {
      color: "#3B82F6",
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "700",
    },
    horizontalCards: { gap: 14, paddingRight: 18 },
    hashtagRow: { gap: 10, paddingRight: 18 },
    hashtagChip: {
      minHeight: 42,
      borderRadius: 999,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(59,130,246,0.18)",
      borderWidth: 1,
      borderColor: "rgba(96,165,250,0.35)",
    },
    hashtagText: {
      color: "#BFDBFE",
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "800",
    },
    playerCard: {
      width: 132,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: "#102033",
      paddingBottom: 12,
    },
    playerImage: { width: "100%", height: 112 },
    playerImageFallback: {
      width: "100%",
      height: 112,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#172A42",
    },
    clubCard: {
      width: 132,
      minHeight: 150,
      borderRadius: 16,
      backgroundColor: "#102033",
      padding: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    clubLogo: { width: 70, height: 70 },
    clubLogoFallback: {
      width: 70,
      height: 70,
      borderRadius: 35,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#172A42",
    },
    cardName: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "800",
      paddingHorizontal: 10,
      textAlign: "center",
      maxWidth: "100%",
    },
    cardMeta: {
      color: "rgba(255,255,255,0.58)",
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 10,
      textAlign: "center",
      maxWidth: "100%",
    },
    cardMiniActions: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 18,
      paddingTop: 8,
    },
    miniAction: {
      color: "#38BDF8",
      fontFamily: "Inter-Bold",
      fontSize: 20,
      lineHeight: 22,
      fontWeight: "800",
    },
    opportunityCard: {
      width: 310,
      minHeight: 100,
      borderRadius: 16,
      backgroundColor: "#102033",
      flexDirection: "row",
      overflow: "hidden",
    },
    opportunityImage: {
      width: 118,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#1D4ED8",
    },
    opportunityText: {
      flex: 1,
      minWidth: 0,
      padding: 14,
      justifyContent: "center",
      gap: 8,
    },
    opportunityTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      lineHeight: 21,
      fontWeight: "800",
    },
    opportunityMeta: {
      color: "rgba(255,255,255,0.58)",
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 18,
    },
    resultCard: {
      borderRadius: 16,
      padding: 14,
      gap: 9,
      backgroundColor: "#102033",
    },
    resultKind: {
      color: "#60A5FA",
      fontFamily: "Inter-Bold",
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
    },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    resultImage: { width: 58, height: 58, borderRadius: 14 },
    resultText: { flex: 1, minWidth: 0, gap: 4 },
    resultTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "800",
    },
    resultSubtitle: {
      color: "rgba(255,255,255,0.58)",
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 18,
    },
  });
function FeaturedExplore({
  loading,
  error,
  players,
  clubs,
  opportunities,
  posts,
  hashtags,
  onHashtagPress,
}: {
  posts: {
    id: string;
    content: string | null;
    hashtags?: string[] | null;
    image_url: string | null;
    video_url: string | null;
  }[];
  hashtags: string[];
  onHashtagPress: (tag: string) => void;
  loading: boolean;
  error: unknown;
  players: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    position: string | null;
    highest_level: string | null;
    club: string | null;
  }[];
  clubs: {
    id: string;
    name: string;
    short_name: string | null;
    city: string | null;
    department_code: string | null;
    logo_url: string | null;
    level: string | null;
  }[];
  opportunities: {
    id: string;
    title: string;
    location_city: string | null;
    location_department: string | null;
    opportunity_type: string;
  }[];
}) {
  const styles = useThemedStyles(createExploreStyles);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  return (
    <View style={styles.featuredWrap}>
      {!!hashtags.length && (
        <View style={styles.featuredSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Hashtags des stories</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hashtagRow}
          >
            {hashtags.map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="button"
                accessibilityLabel={`Explorer le hashtag ${tag}`}
                onPress={() => onHashtagPress(tag)}
                style={styles.hashtagChip}
              >
                <Text style={styles.hashtagText}>#{tag}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      <FeaturedSection title="Joueurs à suivre" href="/search?type=profiles">
        {players.map((player) => (
          <Pressable
            key={player.id}
            accessibilityRole="button"
            accessibilityLabel={player.full_name || player.username || "Profil"}
            onPress={() => router.push(`/profile/${player.id}`)}
            style={styles.playerCard}
          >
            {player.avatar_url ? (
              <Image
                source={{ uri: player.avatar_url }}
                style={styles.playerImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.playerImageFallback}>
                <Users size={30} color="#60A5FA" />
              </View>
            )}
            <Text style={styles.cardName} numberOfLines={1}>
              {player.full_name || player.username || "Membre"}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {player.position ||
                player.highest_level ||
                player.club ||
                "Joueur"}
            </Text>
            <View style={styles.cardMiniActions}>
              <Text style={[styles.miniAction, { fontSize: 12 }]}>
                Voir le profil →
              </Text>
            </View>
          </Pressable>
        ))}
      </FeaturedSection>
      <FeaturedSection title="Clubs en vue" href="/clubs">
        {clubs.map((club) => (
          <Pressable
            key={club.id}
            accessibilityRole="button"
            accessibilityLabel={club.name}
            onPress={() => router.push(`/club/${club.id}`)}
            style={styles.clubCard}
          >
            {club.logo_url ? (
              <Image
                source={{ uri: club.logo_url }}
                style={styles.clubLogo}
                contentFit="contain"
              />
            ) : (
              <View style={styles.clubLogoFallback}>
                <Shield size={34} color="#60A5FA" />
              </View>
            )}
            <Text style={styles.cardName} numberOfLines={1}>
              {club.short_name || club.name}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {club.city || club.level || club.department_code || "Club"}
            </Text>
          </Pressable>
        ))}
      </FeaturedSection>
      {!!opportunities.length && (
        <FeaturedSection title="Opportunités à venir" href="/opportunities">
          {opportunities.map((opportunity) => (
            <Pressable
              key={opportunity.id}
              accessibilityRole="button"
              accessibilityLabel={opportunity.title}
              onPress={() => router.push(`/opportunity/${opportunity.id}`)}
              style={styles.opportunityCard}
            >
              <View style={styles.opportunityImage}>
                <Trophy size={30} color="#FFFFFF" />
              </View>
              <View style={styles.opportunityText}>
                <Text style={styles.opportunityTitle} numberOfLines={2}>
                  {opportunity.title}
                </Text>
                <Text style={styles.opportunityMeta} numberOfLines={1}>
                  {[opportunity.location_city, opportunity.location_department]
                    .filter(Boolean)
                    .join(" · ") || opportunity.opportunity_type}
                </Text>
              </View>
            </Pressable>
          ))}
        </FeaturedSection>
      )}
      {!!posts.length && (
        <View style={styles.featuredSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>À découvrir</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voir toutes les publications"
              onPress={() => router.push("/search?type=posts")}
            >
              <Text style={styles.seeAll}>Voir tout</Text>
            </Pressable>
          </View>
          <MediaGrid
            items={posts.map((post) => ({
              id: post.id,
              title: post.content,
              image: post.image_url,
              video: post.video_url,
            }))}
            onOpen={(item) => router.push(`/posts/${item.id}`)}
          />
        </View>
      )}
    </View>
  );
}
function FeaturedSection({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(createExploreStyles);
  return (
    <View style={styles.featuredSection}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Voir tout ${title}`}
          onPress={() => router.push(href)}
        >
          <Text style={styles.seeAll}>Voir tout</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalCards}
      >
        {children}
      </ScrollView>
    </View>
  );
}
function SearchContent({
  initial,
  category,
  profileField,
}: {
  initial: string;
  category: SearchCategory;
  profileField?: ProfileInfoSearchField;
}) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const styles = useThemedStyles(createExploreStyles);

  const { session, profile: authProfile } = useAuth();
  const profileQuery = useProfile(session?.user.id);
  const profile = profileQuery.data || authProfile;
  const [location, setLocation] = useState<MapLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [text, setText] = useState(initial);
  const [kind, setKind] = useState(category);
  const [activeField, setActiveField] = useState(profileField);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const term = useDebounced(text);
  const context = useQuery({
    queryKey: ["explore-context", session?.user.id, profile, location],
    enabled: !!session && (!!profile || !profileQuery.isPending),
    staleTime: 60_000,
    queryFn: ({ signal }) =>
      loadExploreContext(
        profile || ({ id: session!.user.id } as Profile),
        location,
        signal,
      ),
  });
  const priority = useQuery({
    queryKey: ["explore-priority", context.data, term, kind, activeField],
    enabled: !!context.data && !activeField,
    queryFn: async ({ signal }) =>
      kind === "all"
        ? (
            await Promise.all([
              loadExplorePriority(context.data!, "profiles", term, signal),
              loadExplorePriority(context.data!, "clubs", term, signal),
            ])
          ).flat()
        : loadExplorePriority(context.data!, kind, term, signal),
  });
  async function locate() {
    if (locating) return;
    setLocating(true);
    setLocationError("");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "La localisation est désactivée. Votre ville de profil reste utilisée.",
        );
      const result = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  "Localisation indisponible. Votre ville de profil reste utilisée.",
                ),
              ),
            15000,
          );
        }),
      ]);
      setLocation({
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      });
    } catch (error) {
      setLocationError(
        error instanceof Error
          ? error.message
          : "La localisation est indisponible.",
      );
    } finally {
      if (timer) clearTimeout(timer);
      setLocating(false);
    }
  }
  const rankingReady =
    !!activeField ||
    context.isError ||
    (context.data && (priority.isSuccess || priority.isError));
  const query = useInfiniteQuery({
    queryKey: [
      "global-search",
      session?.user.id,
      term,
      kind,
      activeField,
      priority.data,
    ],
    enabled: !!session && !!rankingReady && (!!term || kind !== "all"),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      !activeField && (kind === "clubs" || kind === "profiles")
        ? searchWithPriorities(
            session!.user.id,
            term,
            kind,
            pageParam,
            priority.data || [],
          )
        : searchFootNation(
            session!.user.id,
            term,
            kind,
            pageParam,
            activeField,
            !term && kind !== "all",
          ),
    getNextPageParam: (last, _pages, offset) =>
      last.hasMore ? offset + 20 : undefined,
  });
  const featured = useQuery({
    queryKey: ["explore-featured-v2", session?.user.id, priority.data],
    enabled: !!session && !!rankingReady && !term && kind === "all",
    queryFn: async () => {
      const blocked = await blockedSocialAuthors(session!.user.id);
      let playersRequest = supabase
        .from("profiles")
        .select(
          "id,full_name,username,avatar_url,position,highest_level,club,is_suspended,suspended_until",
        )
        .neq("id", session!.user.id)
        .or("primary_role.ilike.joueu%,position.not.is.null")
        .or("account_type.is.null,account_type.eq.personal")
        .or(
          `is_suspended.is.null,is_suspended.eq.false,suspended_until.lte.${new Date().toISOString()}`,
        )
        .order("avatar_url", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("id")
        .limit(24);
      let postsRequest = supabase
        .from("posts")
        .select("id,user_id,content,hashtags,image_url,video_url,created_at")
        .or("moderation_hidden.is.null,moderation_hidden.eq.false")
        .order("created_at", { ascending: false })
        .order("id")
        .limit(12);
      let storiesRequest = supabase
        .from("stories")
        .select("id,user_id,hashtags,expires_at")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true })
        .limit(80);
      if (blocked.length) {
        playersRequest = playersRequest.not(
          "id",
          "in",
          `(${blocked.join(",")})`,
        );
        postsRequest = postsRequest.not(
          "user_id",
          "in",
          `(${blocked.join(",")})`,
        );
        storiesRequest = storiesRequest.not(
          "user_id",
          "in",
          `(${blocked.join(",")})`,
        );
      }
      const [players, clubs, opportunities, posts, stories] = await Promise.all([
        playersRequest,
        supabase
          .from("fff_clubs")
          .select("id,name,short_name,city,department_code,logo_url,level")
          .limit(12),
        supabase
          .from("opportunities")
          .select("id,title,location_city,location_department,opportunity_type")
          .eq("is_active", true)
          .limit(6),
        postsRequest,
        storiesRequest,
      ]);
      if (posts.error) throw posts.error;
      if (stories.error) throw stories.error;
      if (players.error) throw players.error;
      if (clubs.error) throw clubs.error;
      if (opportunities.error) throw opportunities.error;
      const hashtagCounts = new Map<string, number>();
      for (const row of [...(stories.data || []), ...(posts.data || [])])
        for (const tag of row.hashtags || []) {
          const clean = String(tag).replace(/^#/, "").trim();
          if (clean) hashtagCounts.set(clean, (hashtagCounts.get(clean) || 0) + 1);
        }
      return {
        hashtags: [...hashtagCounts.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 16)
          .map(([tag]) => tag),
        players: [
          ...new Map(
            [
              ...(priority.data || [])
                .filter(
                  (row) =>
                    row.kind === "profiles" &&
                    !context.data?.following.includes(
                      row.id.replace("profiles:", ""),
                    ),
                )
                .slice(0, 24)
                .map((row) => ({
                  id: row.id.replace("profiles:", ""),
                  full_name: row.title,
                  username: null,
                  avatar_url: row.image,
                  position: row.reason || row.subtitle,
                  highest_level: null,
                  club: null,
                })),
              ...(players.data || []).filter(
                (row) => !context.data?.following.includes(row.id),
              ),
            ].map((row) => [row.id, row]),
          ).values(),
        ]
          .slice(0, 24)
          .filter((row: any) => {
            const suspended = row.is_suspended === true;
            const until = row.suspended_until
              ? Date.parse(row.suspended_until)
              : NaN;
            return (
              !suspended || (Number.isFinite(until) && until <= Date.now())
            );
          }),
        posts: posts.data || [],
        clubs: [
          ...new Map(
            [
              ...(priority.data || [])
                .filter((row) => row.kind === "clubs")
                .slice(0, 12)
                .map((row) => ({
                  id: row.id.replace("clubs:", ""),
                  name: row.title,
                  short_name: null,
                  city: row.reason || row.subtitle,
                  department_code: null,
                  logo_url: row.image,
                  level: null,
                })),
              ...(clubs.data || []),
            ].map((row) => [row.id, row]),
          ).values(),
        ].slice(0, 12),
        opportunities: opportunities.data || [],
      };
    },
  });
  const rows = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.rows) || []).map((row) => [
        row.id,
        row,
      ]),
    ).values(),
  ];
  return (
    <Screen title="Explorer" header={false} scroll={false}>
      <AccountMenu
        visible={accountMenuOpen}
        onClose={() => setAccountMenuOpen(false)}
      />
      <AuthGate>
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          style={styles.screen}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={styles.titleLeft}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                    onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                    style={styles.backIcon}
                  >
                    <ArrowLeft size={28} color={colors.white} strokeWidth={2.4} />
                  </Pressable>
                  <Text style={styles.title}>Explorer</Text>
                </View>
                <View style={styles.titleActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Filtres avancés"
                    onPress={() => router.push("/matching")}
                    style={styles.filterIcon}
                  >
                    <SlidersHorizontal size={23} color={colors.white} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Menu"
                    onPress={() => setAccountMenuOpen(true)}
                    style={styles.filterIcon}
                  >
                    <Menu size={24} color={colors.white} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.searchBox}>
                <Search size={20} color="rgba(255,255,255,0.58)" />
                <TextInput
                  accessibilityLabel="Rechercher sur FootNation"
                  value={text}
                  onChangeText={setText}
                  placeholder="Joueur, club, opportunité..."
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  style={styles.searchInput}
                />
              </View>
              {!!activeField && (kind === "profiles" || kind === "all") && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retirer le filtre du profil"
                  onPress={() => setActiveField(undefined)}
                  style={styles.filterPill}
                >
                  <Text style={styles.filterPillText}>
                    {profileInfoSearchFields[activeField]} · {text} ×
                  </Text>
                </Pressable>
              )}
              <View style={{ gap: 8 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <Text style={{ color: "#A9B9CD", fontSize: 12 }}>
                    {location
                      ? "Autour de vous · vos affinités"
                      : profile?.city
                        ? `${profile.city} · vos affinités`
                        : "Suggestions selon votre profil"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Classer autour de moi"
                    disabled={locating}
                    onPress={() => void locate()}
                    style={{
                      flexDirection: "row",
                      gap: 6,
                      alignItems: "center",
                      minHeight: 40,
                    }}
                  >
                    <MapPin size={16} color="#60A5FA" />
                    <Text style={{ color: "#60A5FA", fontSize: 13 }}>
                      {locating ? "Localisation…" : "Autour de moi"}
                    </Text>
                  </Pressable>
                </View>
                {!!locationError && (
                  <Text
                    accessibilityRole="alert"
                    style={{ color: "#A9B9CD", fontSize: 12 }}
                  >
                    {locationError}
                  </Text>
                )}
                {!!(context.error || priority.error) && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      void context.refetch();
                      void priority.refetch();
                    }}
                  >
                    <Text style={{ color: "#A9B9CD", fontSize: 12 }}>
                      Suggestions personnalisées indisponibles · Réessayer
                    </Text>
                  </Pressable>
                )}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filters}
              >
                {searchCategories.map((item) => (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: kind === item.key }}
                    onPress={() => setKind(item.key)}
                    style={[
                      styles.filterPill,
                      kind === item.key && styles.filterPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        kind === item.key && styles.filterPillTextActive,
                      ]}
                    >
                      {item.key === "profiles"
                        ? "Joueurs"
                        : item.key === "events"
                          ? "Tournois"
                          : item.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {!term && kind === "all" && (
                <FeaturedExplore
                  posts={featured.data?.posts || []}
                  loading={featured.isPending}
                  error={featured.error}
                  players={featured.data?.players || []}
                  clubs={featured.data?.clubs || []}
                  opportunities={featured.data?.opportunities || []}
                  hashtags={featured.data?.hashtags || []}
                  onHashtagPress={(tag) => {
                    setText(`#${tag}`);
                    setKind("posts");
                    setActiveField(undefined);
                  }}
                />
              )}
              {!!(query.error && rows.length) && (
                <ErrorState
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.resultCard}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={() => router.push(item.link)}
            >
              <Text style={styles.resultKind}>
                {
                  searchCategories.find(
                    (category) => category.key === item.kind,
                  )?.label
                }
              </Text>
              <View style={styles.resultRow}>
                {!!item.image && (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.resultImage}
                    contentFit="cover"
                  />
                )}
                <View style={styles.resultText}>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
                  {!!item.reason && (
                    <Text style={{ color: "#60A5FA", fontSize: 12 }}>
                      {item.reason}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            !term && kind === "all" ? null : query.isPending ? (
              <Loading />
            ) : query.isError ? (
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            ) : (
              <Empty
                title="Aucun résultat"
                description="Essayez un autre mot-clé ou une autre catégorie."
              />
            )
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <Button
                secondary
                title="Afficher davantage de résultats"
                busy={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
              />
            ) : null
          }
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => {
            if (term || kind !== "all") void query.refetch();
            else void featured.refetch();
          }}
        />
      </AuthGate>
    </Screen>
  );
}
