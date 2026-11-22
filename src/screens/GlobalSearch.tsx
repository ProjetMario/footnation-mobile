import * as Location from "expo-location";
import {
  loadExploreContext,
  loadExplorePriority,
  searchWithPriorities,
} from "../lib/exploreRanking";
import type { MapLocation } from "../lib/clubMap";
import { blockedSocialAuthors } from "../lib/socialVisibility";
import {
  exploreDiscoveryOptions,
  exploreHashtags,
  uniqueExploreRows,
} from "../lib/exploreDiscovery";
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
  MapPin,
  Menu,
  Search,
  Shield,
  SlidersHorizontal,
  X,
  Trophy,
  Users,
} from "lucide-react-native";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { router, useLocalSearchParams } from "expo-router";
import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { useDebounced, useProfile } from "../lib/data";
import type { Profile } from "../lib/models";
import {
  searchFootNation,
  searchCategories,
  type SearchCategory,
} from "../lib/globalSearch";
import { AuthGate } from "../components/AuthGate";
import { AccountMenu } from "../components/AccountMenu";
import { Button, Empty, ErrorState, Loading, Screen } from "../components/ui";
function SearchPressable({
  style,
  ...props
}: React.ComponentProps<typeof Pressable>) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { colors } = useTheme();
  return (
    <Pressable
      {...props}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={(state) => [
        typeof style === "function" ? style(state) : style,
        { opacity: state.pressed ? 0.65 : hovered ? 0.8 : 1 },
        focused && { borderColor: colors.blue, borderWidth: 2 },
      ]}
    />
  );
}

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
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 104,
      gap: 16,
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
    },
    header: { gap: 14 },
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
      backgroundColor: colors.surfaceRaised,
    },
    title: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 24,
      lineHeight: 30,
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
      backgroundColor: colors.surfaceRaised,
    },
    searchBox: {
      minHeight: 50,
      borderRadius: 18,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.surface,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      minHeight: 48,
      color: colors.ink,
      fontFamily: "Inter-Regular",
      fontSize: 16,
    },
    filters: { gap: 6 },
    filterPill: {
      minHeight: 44,
      borderRadius: 22,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    filterPillActive: { backgroundColor: colors.accentSoft },
    filterPillText: {
      color: colors.muted,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "700",
    },
    filterPillTextActive: { color: colors.deepBlue },
    featuredWrap: { gap: 24, paddingTop: 6 },
    featuredSection: { gap: 12 },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sectionTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 17,
      lineHeight: 23,
      fontWeight: "800",
    },
    seeAll: {
      color: colors.deepBlue,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "700",
    },
    horizontalCards: { gap: 10 },
    hashtagRow: { gap: 10, paddingRight: 18 },
    hashtagChip: {
      minHeight: 44,
      borderRadius: 999,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    hashtagText: {
      color: colors.deepBlue,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      fontWeight: "800",
    },
    playerCard: {
      width: 108,
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
      borderRadius: 16,
    },
    playerImage: { width: 64, height: 64, borderRadius: 32 },
    playerImageFallback: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceRaised,
    },
    clubCard: {
      width: 108,
      paddingVertical: 6,
      borderRadius: 16,
      alignItems: "center",
      gap: 6,
    },
    clubLogo: { width: 56, height: 56, borderRadius: 12 },
    clubLogoFallback: {
      width: 56,
      height: 56,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceRaised,
    },
    cardName: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "800",
      paddingHorizontal: 10,
      textAlign: "center",
      maxWidth: "100%",
    },
    cardMeta: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 10,
      textAlign: "center",
      maxWidth: "100%",
    },
    opportunityCard: {
      width: 270,
      minHeight: 84,
      borderRadius: 16,
      backgroundColor: colors.surface,
      flexDirection: "row",
      overflow: "hidden",
    },
    opportunityImage: {
      width: 52,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSoft,
    },
    opportunityText: {
      flex: 1,
      minWidth: 0,
      padding: 14,
      justifyContent: "center",
      gap: 8,
    },
    opportunityTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      lineHeight: 21,
      fontWeight: "800",
    },
    opportunityMeta: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 18,
    },
    resultCard: {
      borderRadius: 16,
      padding: 14,
      gap: 7,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    resultKind: {
      color: colors.deepBlue,
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
    resultImage: { width: 48, height: 48, borderRadius: 12 },
    resultText: { flex: 1, minWidth: 0, gap: 4 },
    resultTitle: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "800",
    },
    resultSubtitle: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 13,
      lineHeight: 18,
    },
  });
function FeaturedExplore({
  states,
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
  states: Record<
    "players" | "clubs" | "opportunities" | "posts",
    ExploreLoadState
  >;
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
  const { colors } = useTheme();
  return (
    <View style={styles.featuredWrap}>
      {!!hashtags.length && (
        <View style={styles.featuredSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Hashtags</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hashtagRow}
          >
            {hashtags.map((tag) => (
              <SearchPressable
                key={tag}
                accessibilityRole="button"
                accessibilityLabel={`Explorer le hashtag ${tag}`}
                onPress={() => onHashtagPress(tag)}
                style={styles.hashtagChip}
              >
                <Text style={styles.hashtagText}>#{tag}</Text>
              </SearchPressable>
            ))}
          </ScrollView>
        </View>
      )}
      <FeaturedSection
        title="Profils à découvrir"
        href="/search?type=profiles"
        state={states.players}
      >
        {players.map((player) => (
          <SearchPressable
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
                <Users size={30} color={colors.deepBlue} />
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
          </SearchPressable>
        ))}
      </FeaturedSection>
      <FeaturedSection title="Clubs" href="/clubs" state={states.clubs}>
        {clubs.map((club) => (
          <SearchPressable
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
                <Shield size={34} color={colors.deepBlue} />
              </View>
            )}
            <Text style={styles.cardName} numberOfLines={1}>
              {club.short_name || club.name}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {club.city || club.level || club.department_code || "Club"}
            </Text>
          </SearchPressable>
        ))}
      </FeaturedSection>
      {(!!opportunities.length ||
        states.opportunities.pending ||
        !!states.opportunities.error) && (
        <FeaturedSection
          title="Opportunités"
          href="/opportunities"
          state={states.opportunities}
        >
          {opportunities.map((opportunity) => (
            <SearchPressable
              key={opportunity.id}
              accessibilityRole="button"
              accessibilityLabel={opportunity.title}
              onPress={() => router.push(`/opportunity/${opportunity.id}`)}
              style={styles.opportunityCard}
            >
              <View style={styles.opportunityImage}>
                <Trophy size={22} color={colors.deepBlue} />
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
            </SearchPressable>
          ))}
        </FeaturedSection>
      )}
      {(!!posts.length || states.posts.pending || !!states.posts.error) && (
        <View style={styles.featuredSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>À découvrir</Text>
            <SearchPressable
              accessibilityRole="button"
              accessibilityLabel="Voir toutes les publications"
              onPress={() => router.push("/search?type=posts")}
            >
              <Text style={styles.seeAll}>Voir tout</Text>
            </SearchPressable>
          </View>
          <ExploreFeedback state={states.posts} />
          <MediaGrid
            videoPreviews={false}
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
type ExploreLoadState = { pending: boolean; error: unknown; retry: () => void };
function ExploreFeedback({ state }: { state?: ExploreLoadState }) {
  if (state?.error)
    return <ErrorState error={state.error} retry={state.retry} />;
  if (state?.pending) return <Loading />;
  return null;
}
function FeaturedSection({
  title,
  href,
  children,
  state,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
  state?: ExploreLoadState;
}) {
  const styles = useThemedStyles(createExploreStyles);
  return (
    <View style={styles.featuredSection}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <SearchPressable
          accessibilityRole="button"
          accessibilityLabel={`Voir tout ${title}`}
          onPress={() => router.push(href)}
        >
          <Text style={styles.seeAll}>Voir tout</Text>
        </SearchPressable>
      </View>
      <ExploreFeedback state={state} />
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
  const [optionsOpen, setOptionsOpen] = useState(false);
  const term = useDebounced(text);
  const blocked = useQuery({
    queryKey: ["explore-blocks", session?.user.id],
    enabled: !!session,
    staleTime: 30_000,
    queryFn: ({ signal }) => blockedSocialAuthors(session!.user.id, signal),
  });
  const context = useQuery({
    queryKey: [
      "explore-context",
      session?.user.id,
      profile,
      location,
      blocked.data,
    ],
    enabled:
      !!session && blocked.isSuccess && (!!profile || !profileQuery.isPending),
    staleTime: 120_000,
    queryFn: ({ signal }) =>
      loadExploreContext(
        profile || ({ id: session!.user.id } as Profile),
        location,
        signal,
        blocked.data,
      ),
  });
  const priority = useQuery({
    queryKey: ["explore-priority", context.data, term, kind, activeField],
    enabled: !!context.data && !activeField && !term,
    staleTime: 120_000,
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
  // Typed searches start immediately. Personalization enhances browsing without
  // holding the input, general results or independent discovery sections.
  const browsingPriority =
    !term && !activeField && (kind === "clubs" || kind === "profiles")
      ? priority.data?.filter(
          (row) =>
            row.kind !== "profiles" ||
            !blocked.data?.includes(row.id.replace("profiles:", "")),
        )
      : undefined;
  type SearchPage = Awaited<ReturnType<typeof searchFootNation>>;
  const query = useInfiniteQuery<
    SearchPage,
    Error,
    InfiniteData<SearchPage, number>,
    readonly unknown[],
    number
  >({
    queryKey: [
      "global-search",
      session?.user.id,
      term,
      kind,
      activeField,
      browsingPriority,
      blocked.data,
    ],
    enabled: !!session && blocked.isSuccess && (!!term || kind !== "all"),
    initialPageParam: 0,
    staleTime: 60_000,
    placeholderData: (previous, previousQuery) => {
      const key = previousQuery?.queryKey;
      return key?.[1] === session?.user.id &&
        key?.[2] === term &&
        key?.[3] === kind &&
        key?.[4] === activeField &&
        key?.[6] === blocked.data
        ? previous
        : undefined;
    },
    queryFn: ({ pageParam, signal }) =>
      browsingPriority
        ? searchWithPriorities(
            session!.user.id,
            term,
            kind,
            pageParam,
            browsingPriority,
            { blockedAuthors: blocked.data, signal },
          )
        : searchFootNation(
            session!.user.id,
            term,
            kind,
            pageParam,
            activeField,
            !term && kind !== "all",
            [],
            { blockedAuthors: blocked.data, signal },
          ),
    getNextPageParam: (last, _pages, offset) =>
      last.hasMore ? offset + 20 : undefined,
  });
  const options = exploreDiscoveryOptions(
    session?.user.id || "",
    blocked.isSuccess ? blocked.data : undefined,
    !term && kind === "all",
  );
  const players = useQuery(options.players);
  const clubs = useQuery(options.clubs);
  const opportunities = useQuery(options.opportunities);
  const posts = useQuery(options.posts);
  const stories = useQuery(options.stories);
  const featuredPlayers = !blocked.isSuccess
    ? []
    : uniqueExploreRows(
        [
          ...(priority.data || [])
            .filter((row) => row.kind === "profiles")
            .map((row) => ({
              id: row.id.replace("profiles:", ""),
              full_name: row.title,
              username: null,
              avatar_url: row.image,
              position: row.reason || row.subtitle,
              highest_level: null,
              club: null,
            })),
          ...(players.data || []),
        ].filter(
          (row) =>
            !context.data?.following.includes(row.id) &&
            !blocked.data?.includes(row.id),
        ),
        24,
      );
  const featuredClubs = uniqueExploreRows(
    [
      ...(priority.data || [])
        .filter((row) => row.kind === "clubs")
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
    ],
    12,
  );
  const hashtags = exploreHashtags([
    ...(stories.data || []),
    ...(posts.data || []),
  ]);
  const refreshFeatured = () => {
    void players.refetch();
    void clubs.refetch();
    void opportunities.refetch();
    void posts.refetch();
    void stories.refetch();
  };
  const rows = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.rows) || []).map((row) => [
        row.id,
        row,
      ]),
    ).values(),
  ];
  return (
    <Screen title="Rechercher" header={false} scroll={false}>
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
                  <SearchPressable
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                    onPress={() =>
                      router.canGoBack() ? router.back() : router.replace("/")
                    }
                    style={styles.backIcon}
                  >
                    <ArrowLeft size={28} color={colors.ink} strokeWidth={2.4} />
                  </SearchPressable>
                  <Text style={styles.title}>Rechercher</Text>
                </View>
                <View style={styles.titleActions}>
                  <SearchPressable
                    accessibilityRole="button"
                    accessibilityLabel="Options de recherche"
                    accessibilityState={{ expanded: optionsOpen }}
                    onPress={() => setOptionsOpen((open) => !open)}
                    style={styles.filterIcon}
                  >
                    <SlidersHorizontal size={23} color={colors.ink} />
                  </SearchPressable>
                  <SearchPressable
                    accessibilityRole="button"
                    accessibilityLabel="Menu"
                    onPress={() => setAccountMenuOpen(true)}
                    style={styles.filterIcon}
                  >
                    <Menu size={24} color={colors.ink} strokeWidth={2} />
                  </SearchPressable>
                </View>
              </View>
              <View style={styles.searchBox}>
                <Search size={20} color={colors.muted} />
                <TextInput
                  accessibilityLabel="Rechercher sur FootNation"
                  value={text}
                  onChangeText={setText}
                  placeholder="Un nom, un club, un mot-clé…"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  style={styles.searchInput}
                />
                {!!text && (
                  <SearchPressable
                    accessibilityRole="button"
                    accessibilityLabel="Effacer la recherche"
                    onPress={() => setText("")}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={18} color={colors.muted} />
                  </SearchPressable>
                )}
              </View>
              {!!activeField && (kind === "profiles" || kind === "all") && (
                <SearchPressable
                  accessibilityRole="button"
                  accessibilityLabel="Retirer le filtre du profil"
                  onPress={() => setActiveField(undefined)}
                  style={styles.filterPill}
                >
                  <Text style={styles.filterPillText}>
                    {profileInfoSearchFields[activeField]} · {text} ×
                  </Text>
                </SearchPressable>
              )}
              {optionsOpen && (
                <View
                  style={{
                    gap: 8,
                    padding: 12,
                    borderRadius: 16,
                    backgroundColor: colors.surface,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {location
                        ? "Autour de vous · vos affinités"
                        : profile?.city
                          ? `${profile.city} · vos affinités`
                          : "Suggestions selon votre profil"}
                    </Text>
                    <SearchPressable
                      accessibilityRole="button"
                      accessibilityLabel="Classer autour de moi"
                      disabled={locating}
                      onPress={() => void locate()}
                      style={{
                        flexDirection: "row",
                        gap: 6,
                        alignItems: "center",
                        minHeight: 44,
                      }}
                    >
                      <MapPin size={16} color={colors.deepBlue} />
                      <Text style={{ color: colors.deepBlue, fontSize: 13 }}>
                        {locating ? "Localisation…" : "Autour de moi"}
                      </Text>
                    </SearchPressable>
                  </View>
                  {!!locationError && (
                    <Text
                      accessibilityRole="alert"
                      style={{ color: colors.muted, fontSize: 12 }}
                    >
                      {locationError}
                    </Text>
                  )}
                  {!!(context.error || priority.error) && (
                    <SearchPressable
                      accessibilityRole="button"
                      onPress={() => {
                        void context.refetch();
                        void priority.refetch();
                      }}
                    >
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        Suggestions personnalisées indisponibles · Réessayer
                      </Text>
                    </SearchPressable>
                  )}
                  <Button
                    secondary
                    title="Matching avancé"
                    onPress={() => router.push("/matching")}
                  />
                </View>
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filters}
              >
                {searchCategories.map((item) => (
                  <SearchPressable
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
                      {item.label}
                    </Text>
                  </SearchPressable>
                ))}
              </ScrollView>
              {!term && kind === "all" && (
                <FeaturedExplore
                  posts={posts.data || []}
                  states={{
                    players: {
                      pending: players.isPending && !featuredPlayers.length,
                      error: blocked.error || players.error,
                      retry: () => {
                        void blocked.refetch();
                        void players.refetch();
                      },
                    },
                    clubs: {
                      pending: clubs.isPending && !featuredClubs.length,
                      error: clubs.error,
                      retry: () => {
                        void clubs.refetch();
                      },
                    },
                    opportunities: {
                      pending: opportunities.isPending,
                      error: opportunities.error,
                      retry: () => {
                        void opportunities.refetch();
                      },
                    },
                    posts: {
                      pending: posts.isPending,
                      error: blocked.error || posts.error,
                      retry: () => {
                        void blocked.refetch();
                        void posts.refetch();
                      },
                    },
                  }}
                  players={featuredPlayers}
                  clubs={featuredClubs}
                  opportunities={opportunities.data || []}
                  hashtags={hashtags}
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
            <SearchPressable
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
                  <Text style={styles.resultSubtitle} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                  {!!item.reason && (
                    <Text style={{ color: colors.deepBlue, fontSize: 12 }}>
                      {item.reason}
                    </Text>
                  )}
                </View>
              </View>
            </SearchPressable>
          )}
          ListEmptyComponent={
            !term && kind === "all" ? null : blocked.error ? (
              <ErrorState
                error={blocked.error}
                retry={() => void blocked.refetch()}
              />
            ) : query.isPending ? (
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
          refreshing={
            term || kind !== "all"
              ? query.isRefetching && !query.isFetchingNextPage
              : players.isRefetching || clubs.isRefetching
          }
          onRefresh={() => {
            if (term || kind !== "all") void query.refetch();
            else refreshFeatured();
          }}
        />
      </AuthGate>
    </Screen>
  );
}
