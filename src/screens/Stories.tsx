import { useTranslation } from "../lib/i18n";
import { contentReportPath } from "../lib/contentReport";
import { StoryImage } from "../components/StoryImage";
import { FilteredStoryImage } from "../components/FilteredStoryImage";
import { StoryFilterEditor } from "../components/StoryFilterEditor";
import { ProfileAutocompleteField } from "../components/ProfileAutocompleteField";
import { NativeVideo } from "../components/Video";
import {
  DEFAULT_STORY_FILTERS,
  normalizeStoryFilters,
} from "../lib/storyFilters";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Stop,
} from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Flag, Plus } from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { randomUUID } from "expo-crypto";
import {
  createStoryPublication,
  storyMedia,
  STORY_LIFETIME,
} from "../lib/storyPublication";
import { storyPublicationJournal } from "../lib/storyPublicationStorage";
import { storyPublicationServices } from "../lib/storyPublicationServices";
import { Profile, displayName } from "../lib/models";
import { notifyNetworkNewContent, notifyPublicationPublished } from "../lib/notificationEvents";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { AuthGate } from "../components/AuthGate";
import {
  signature,
  useTheme,
  useThemedStyles,
  type ThemeColors,
} from "../theme";
import {
  activeRailStory,
  buildStoryRail,
  nextRailExpiry,
  type StoryRailEntry,
  type StoryRailProfile,
  type StoryRailSnapshot,
  type StoryRailStory,
} from "../lib/storyRail";
import { isActivityOnline, readProfilesActivity } from "../lib/profilePresence";
type Story = {
  filters?: unknown;
  id: string;
  user_id: string;
  media_url: string;
  caption: string | null;
  location: string | null;
  hashtags: string[] | null;
  created_at: string;
  expires_at: string;
  user: Profile | null;
};
const select = "*,user:profiles!stories_user_id_fkey(id,full_name,avatar_url)";

const STORY_HASHTAG_LIMIT = 10;
const STORY_HASHTAG_TEXT_LIMIT = 300;
const STORY_DEFAULT_HASHTAGS = ["football", "story", "amateur"];
const STORY_KEYWORD_HASHTAGS: [RegExp, string][] = [
  [/(but|goal|marque|scor|frappe|lucarne)/i, "but"],
  [/(match|victoire|défaite|defaite|score|tournoi|championnat)/i, "match"],
  [/(entra[iî]nement|training|séance|seance|exercice)/i, "entrainement"],
  [/(short|vid[eé]o|video|reel|clip)/i, "short"],
  [/(stade|terrain|club|équipe|equipe)/i, "club"],
  [/(supporter|ambiance|tribune)/i, "supporters"],
];
const STORY_STOP_WORDS = new Set([
  "avec",
  "dans",
  "pour",
  "plus",
  "tout",
  "tous",
  "une",
  "des",
  "les",
  "sur",
  "mon",
  "mes",
  "notre",
  "votre",
  "cette",
  "story",
]);

function normalizeStoryHashtag(value: string) {
  return value
    .replace(/^#+/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 32);
}

function parseStoryHashtags(value: string) {
  return value
    .split(/\s+/)
    .map(normalizeStoryHashtag)
    .filter(Boolean)
    .slice(0, STORY_HASHTAG_LIMIT);
}

function addStoryHashtag(value: string, tag: string) {
  const next = [...parseStoryHashtags(value)];
  const normalized = normalizeStoryHashtag(tag);
  if (!normalized) return value;
  if (!next.some((item) => item.toLowerCase() === normalized.toLowerCase()))
    next.push(normalized);
  return next
    .slice(0, STORY_HASHTAG_LIMIT)
    .map((item) => `#${item}`)
    .join(" ")
    .slice(0, STORY_HASHTAG_TEXT_LIMIT);
}

function storyHashtagSuggestions({
  caption,
  location,
  mediaKind,
  current,
}: {
  caption: string;
  location: string;
  mediaKind?: "image" | "video";
  current: string;
}) {
  const seen = new Set(parseStoryHashtags(current).map((tag) => tag.toLowerCase()));
  const suggestions: string[] = [];
  const add = (value: string) => {
    const tag = normalizeStoryHashtag(value);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key) || suggestions.some((item) => item.toLowerCase() === key)) return;
    suggestions.push(tag);
  };
  for (const part of location.split(/[·,\-]/)) add(part.trim());
  for (const [pattern, tag] of STORY_KEYWORD_HASHTAGS)
    if (pattern.test(caption)) add(tag);
  for (const word of caption.match(/[\p{L}\p{N}]{4,}/gu) || []) {
    const normalized = normalizeStoryHashtag(word);
    if (!STORY_STOP_WORDS.has(normalized.toLowerCase())) add(normalized);
  }
  if (mediaKind === "video") add("short");
  for (const tag of STORY_DEFAULT_HASHTAGS) add(tag);
  return suggestions.slice(0, 10);
}
function storyDateLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "À l’instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function useStories() {
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: ["stories", session?.user.id],
    enabled: !!session,
    initialPageParam: 0,
    refetchInterval: 60000,
    queryFn: async ({ pageParam }) => {
      const blocked = await supabase
        .from("user_blocks")
        .select("blocker_id,blocked_id")
        .or(
          `blocker_id.eq.${session!.user.id},blocked_id.eq.${session!.user.id}`,
        );
      if (blocked.error) throw blocked.error;
      const ids = (blocked.data || []).map((b) =>
        b.blocker_id === session!.user.id ? b.blocked_id : b.blocker_id,
      );
      let q = supabase
        .from("stories")
        .select(select)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam * 30, pageParam * 30 + 29);
      if (ids.length) q = q.not("user_id", "in", `(${ids.join(",")})`);
      const { data, error } = await q;
      if (error) throw error;
      return data as Story[];
    },
    getNextPageParam: (last, _pages, p) =>
      last.length === 30 ? p + 1 : undefined,
  });
}
const railProfileFields =
  "id,full_name,username,avatar_url,is_private,is_suspended,suspended_until";
const railStoryFields = "id,user_id,created_at,expires_at";

async function loadStoryRail(
  uid: string,
  signal: AbortSignal,
): Promise<StoryRailSnapshot> {
  const expiresAfter = new Date().toISOString();
  const readMembers = (withPhoto: boolean) => {
    let query = supabase
      .from("profiles")
      .select(
        railProfileFields,
      )
      .neq("id", uid)
      .or("is_private.eq.false,is_private.is.null")
      .order("full_name")
      .order("id")
      .limit(60);
    if (withPhoto)
      query = query.not("avatar_url", "is", null).neq("avatar_url", "");
    return query.abortSignal(signal);
  };
  // Fetch discovery independently of stories: nested story joins repeat the
  // same work for every suggested profile. Blocks run in this same round trip.
  const [storiesRead, membersRead, photoMembersRead, ownRead, blocksRead] =
    await Promise.all([
      supabase
        .from("stories")
        .select(
          `${railStoryFields},user:profiles!stories_user_id_fkey!inner(${railProfileFields})`,
        )
        .gt("expires_at", expiresAfter)
        .or("is_private.eq.false,is_private.is.null", {
          referencedTable: "user",
        })
        .order("created_at", { ascending: false })
        .order("id")
        .limit(60)
        .abortSignal(signal),
      readMembers(false),
      // A separate photo sample prevents incomplete early-alphabet accounts from
      // using every candidate slot before completed profiles can be considered.
      readMembers(true),
      supabase
        .from("stories")
        .select(railStoryFields)
        .eq("user_id", uid)
        .gt("expires_at", expiresAfter)
        .order("created_at", { ascending: false })
        .order("id")
        .limit(1)
        .abortSignal(signal),
      supabase.from("user_blocks")
        .select("blocker_id,blocked_id")
        .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`)
        .abortSignal(signal),
    ]);
  if (storiesRead.error) throw storiesRead.error;
  if (membersRead.error) throw membersRead.error;
  if (photoMembersRead.error) throw photoMembersRead.error;
  if (ownRead.error) throw ownRead.error;
  if (blocksRead.error) throw blocksRead.error;
  const stories = (storiesRead.data || []) as unknown as (StoryRailStory & {
    user: StoryRailProfile | null;
  })[];
  const members = [
    ...(photoMembersRead.data || []),
    ...(membersRead.data || []),
  ] as unknown as (StoryRailProfile & {
    stories: StoryRailStory[] | null;
  })[];
  const profiles = [
    ...members,
    ...stories.flatMap((story) => (story.user ? [story.user] : [])),
  ];
  return {
    accountId: uid,
    profiles,
    stories: [
      ...stories,
      ...((ownRead.data || []) as StoryRailStory[]),
    ],
    blocks: blocksRead.data || [],
  };
}

function RailCircle({ entry, online }: { entry: StoryRailEntry; online?: boolean }) {
  const t = useTranslation();
  const { colors } = useTheme();
  const storyStyles = useThemedStyles(createStoryStyles);
  const name = displayName(entry.profile);
  const profilePath = entry.own
    ? "/my-profile"
    : `/profile/${encodeURIComponent(entry.profile.id)}`;
  const avatar = (
    <View style={storyStyles.avatarInset}>
      <Avatar uri={entry.profile.avatar_url} name={name} size={56} />
    </View>
  );
  return (
    <View style={storyStyles.circle}>
      <View style={storyStyles.ownAvatar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            entry.story
              ? t("stories.view", { name })
              : t("stories.profile", { name })
          }
          accessibilityHint={entry.story ? t("stories.profileHint") : undefined}
          onPress={() =>
            router.push(
              activeRailStory(entry.story, Date.now())
                ? `/stories/${encodeURIComponent(entry.story!.id)}`
                : profilePath,
            )
          }
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          {entry.story ? (
            <LinearGradient
              colors={signature}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={storyStyles.ring}
            >
              {avatar}
            </LinearGradient>
          ) : (
            <View style={[storyStyles.ring, storyStyles.neutralRing]}>
              {avatar}
            </View>
          )}
        </Pressable>
        {!!online && !entry.own && (
          <View
            accessibilityRole="text"
            accessibilityLabel="En ligne"
            style={storyStyles.onlineDot}
          />
        )}
        {!!entry.own && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("stories.create")}
            onPress={() => router.push("/stories/create")}
            style={({ pressed }) => [
              storyStyles.addTarget,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <LinearGradient
              colors={signature}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={storyStyles.addBadge}
            >
              <Plus size={16} color={colors.white} strokeWidth={3} />
            </LinearGradient>
          </Pressable>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("stories.profile", { name })}
        onPress={() => router.push(profilePath)}
        style={({ pressed }) => [
          storyStyles.nameTarget,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text numberOfLines={1} style={storyStyles.label}>
          {entry.own ? t("stories.own") : name}
        </Text>
      </Pressable>
    </View>
  );
}
export function StoryRail() {
  const t = useTranslation();
  const { colors } = useTheme();
  const s = useUIStyles();
  const storyStyles = useThemedStyles(createStoryStyles);
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const [now, setNow] = useState(Date.now);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setNow(Date.now());
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state === "active") setNow(Date.now());
    });
    return () => listener.remove();
  }, []);
  const enabled = !!uid && focused && active;
  const q = useQuery({
    queryKey: ["stories", uid, "profile-rail"],
    enabled,
    staleTime: 60_000,
    retry: 1,
    refetchInterval: enabled ? 60_000 : false,
    refetchIntervalInBackground: false,
    queryFn: ({ signal }) => loadStoryRail(uid!, signal),
  });
  useEffect(() => {
    if (!enabled) return;
    const expiry = nextRailExpiry(q.data?.stories || [], Date.now());
    if (expiry === null) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(2_147_483_647, Math.max(1, expiry - Date.now() + 10)),
    );
    return () => clearTimeout(timer);
  }, [enabled, q.data, now]);
  const entries = buildStoryRail(
    q.isError ? undefined : q.data,
    uid,
    profile,
    Math.max(now, Date.now()),
  );
  const activityIds = useMemo(
    () => entries.filter((entry) => !entry.own).map((entry) => entry.profile.id),
    [entries],
  );
  const activities = useQuery({
    queryKey: ["story-rail-activities", uid, activityIds.join(",")],
    enabled: enabled && activityIds.length > 0,
    refetchInterval: 15000,
    retry: false,
    queryFn: () => readProfilesActivity(uid!, activityIds),
  });
  const hasOwn = entries.some((entry) => entry.own);
  return (
    <View style={storyStyles.rail}>
      <ScrollView
        key={uid || "guest"}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={storyStyles.railContent}
      >
        {!hasOwn && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("stories.create")}
            onPress={() => router.push(uid ? "/stories/create" : "/login")}
            style={({ pressed }) => [
              storyStyles.circle,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={storyStyles.ownAvatar}>
              <View style={storyStyles.seeAll}>
                <Plus size={24} color={colors.ink} strokeWidth={1.7} />
              </View>
            </View>
            <Text numberOfLines={1} style={storyStyles.label}>
              {t("stories.own")}
            </Text>
          </Pressable>
        )}
        {entries.map((entry) => (
          <RailCircle
            key={entry.profile.id}
            entry={entry}
            online={isActivityOnline(
              activities.data?.[entry.profile.id],
              activities.dataUpdatedAt,
            )}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("stories.all")}
          onPress={() => router.push("/stories")}
          style={({ pressed }) => [
            storyStyles.circle,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={storyStyles.seeAll}>
            <ArrowRight size={24} color={colors.ink} strokeWidth={1.7} />
          </View>
          <Text numberOfLines={1} style={storyStyles.label}>
            {t("stories.viewAll")}
          </Text>
        </Pressable>
      </ScrollView>
      {!!uid &&
        (q.isError ? (
          <View style={storyStyles.status}>
            <Text
              accessibilityLiveRegion="polite"
              style={[s.small, { flex: 1 }]}
            >
              {t("stories.unavailable")}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void q.refetch()}
              style={storyStyles.retry}
            >
              <Text style={storyStyles.retryLabel}>{t("common.retry")}</Text>
            </Pressable>
          </View>
        ) : q.isPaused && !q.data ? (
          <Text accessibilityLiveRegion="polite" style={storyStyles.statusText}>
            Connexion indisponible. Les profils se chargeront au retour du
            réseau.
          </Text>
        ) : q.isPending ? (
          <Text accessibilityLiveRegion="polite" style={storyStyles.statusText}>
            Chargement des profils et stories…
          </Text>
        ) : entries.every((entry) => entry.own) ? (
          <Text style={storyStyles.statusText}>
            Aucun autre profil public à afficher pour le moment.
          </Text>
        ) : null)}
    </View>
  );
}
const createStoryStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    rail: {
      gap: 4,
      paddingTop: 4,
      paddingBottom: 4,
      backgroundColor: colors.surface,
    },
    railContent: { gap: 6, paddingHorizontal: 12 },
    circle: { width: 74, alignItems: "center" },
    ring: { padding: 2, borderRadius: 32 },
    neutralRing: { backgroundColor: colors.border },
    avatarInset: {
      padding: 2,
      borderRadius: 30,
      backgroundColor: colors.surface,
    },
    ownAvatar: {
      height: 64,
      width: 64,
      alignItems: "center",
      justifyContent: "center",
    },
    onlineDot: {
      position: "absolute",
      right: 1,
      bottom: 1,
      width: 17,
      height: 17,
      borderRadius: 9,
      backgroundColor: "#1CC75C",
      borderWidth: 3,
      borderColor: colors.surface,
      zIndex: 7,
    },
    addTarget: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 44,
      height: 44,
      alignItems: "flex-end",
      justifyContent: "flex-end",
    },
    addBadge: {
      height: 24,
      width: 24,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    label: {
      color: colors.ink,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 16,
      paddingVertical: 4,
      maxWidth: 74,
      textAlign: "center",
    },
    nameTarget: {
      minHeight: 24,
      width: 74,
      justifyContent: "center",
      alignItems: "center",
    },
    status: {
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    statusText: {
      color: colors.muted,
      fontFamily: "Inter-Regular",
      fontSize: 12,
      lineHeight: 18,
      paddingHorizontal: 16,
    },
    retry: { minHeight: 44, minWidth: 44, justifyContent: "center" },
    retryLabel: {
      color: colors.deepBlue,
      fontFamily: "Inter-SemiBold",
      fontWeight: "600",
      fontSize: 13,
    },
    seeAll: {
      height: 64,
      width: 64,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
  });
export default function Stories() {
  const s = useUIStyles();
  const q = useStories();
  return (
    <Screen title="Stories" scroll={false}>
      <AuthGate>
        <FlatList
          data={q.data?.pages.flat() || []}
          contentContainerStyle={s.content}
          keyExtractor={(x) => x.id}
          ListHeaderComponent={
            <Button
              title="Créer une story"
              onPress={() => router.push("/stories/create")}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/stories/${item.id}`)}
              style={s.card}
            >
              <View style={s.row}>
                <Avatar
                  uri={item.user?.avatar_url}
                  name={displayName(item.user)}
                />
                <Text style={s.h2}>{displayName(item.user)}</Text>
              </View>
              <FilteredStoryImage
                uri={item.media_url}
                filters={item.filters}
                style={{ width: "100%", aspectRatio: 0.8, borderRadius: 16 }}
                fit="cover"
              />
              {!!item.caption && <Text style={s.text}>{item.caption}</Text>}
            </Pressable>
          )}
          ListEmptyComponent={
            q.isPending ? (
              <Loading />
            ) : q.isError ? (
              <ErrorState error={q.error} retry={() => void q.refetch()} />
            ) : (
              <Empty title="Aucune story pour le moment" />
            )
          }
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
        />
      </AuthGate>
    </Screen>
  );
}

const detailStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10 },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  author: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  authorName: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  time: { color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 1 },
  bottomPanel: { gap: 6, padding: 14, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.42)" },
  caption: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "600" },
  meta: { color: "rgba(255,255,255,0.78)", fontSize: 13 },
  tags: { color: "#69B7FF", fontSize: 14, fontWeight: "700" },
});
export function StoryDetail() {
  const { colors } = useTheme();
  const s = useUIStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const q = useQuery({
    queryKey: ["story", id, session?.user.id],
    enabled: !!session,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stories")
        .select(select)
        .eq("id", id)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error) throw error;
      if (data && data.user_id !== session!.user.id) {
        const uid = session!.user.id;
        const blocks = await supabase
          .from("user_blocks")
          .select("blocker_id")
          .or(
            `and(blocker_id.eq.${uid},blocked_id.eq.${data.user_id}),and(blocker_id.eq.${data.user_id},blocked_id.eq.${uid})`,
          )
          .limit(1);
        if (blocks.error) throw blocks.error;
        if (blocks.data?.length) return null;
      }
      return data as Story | null;
    },
  });
  return (
    <Screen title="Story" header={false} scroll={false}>
      <AuthGate>
        <View style={detailStyles.screen}>
          {q.isPending ? (
            <Loading />
          ) : q.isError ? (
            <ErrorState error={q.error} retry={() => void q.refetch()} />
          ) : !q.data ? (
            <Empty title="Cette story a expiré ou n’est plus disponible" />
          ) : (
            <>
              <StoryImage
                key={`${session!.user.id}/${q.data.id}/${q.data.media_url}`}
                story={q.data}
                uid={session!.user.id}
                fullScreen
              />
              <View pointerEvents="box-none" style={detailStyles.overlay}>
                <View style={detailStyles.topBar}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retour"
                    onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                    style={detailStyles.roundButton}
                  >
                    <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2.4} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Voir le profil de ${displayName(q.data.user)}`}
                    onPress={() => router.push(`/profile/${q.data!.user_id}`)}
                    style={detailStyles.author}
                  >
                    <Avatar
                      uri={q.data.user?.avatar_url}
                      name={displayName(q.data.user)}
                      size={38}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={detailStyles.authorName}>
                        {displayName(q.data.user)}
                      </Text>
                      <Text style={detailStyles.time}>
                        {storyDateLabel(q.data.created_at)}
                      </Text>
                    </View>
                  </Pressable>
                  {q.data.user_id !== session?.user.id && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Signaler ou bloquer"
                      onPress={() =>
                        router.push(
                          contentReportPath(q.data!.user_id, "story", q.data!.id),
                        )
                      }
                      style={detailStyles.roundButton}
                    >
                      <Flag size={21} color="#FFFFFF" />
                    </Pressable>
                  )}
                </View>
                <View style={detailStyles.bottomPanel}>
                  {!!q.data.caption && (
                    <Text style={detailStyles.caption}>{q.data.caption}</Text>
                  )}
                  {!!q.data.location && (
                    <Text style={detailStyles.meta}>{q.data.location}</Text>
                  )}
                  {!!q.data.hashtags?.length && (
                    <Text style={detailStyles.tags}>
                      {q.data.hashtags
                        .map((t) => `#${t.replace(/^#/, "")}`)
                        .join(" ")}
                    </Text>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </AuthGate>
    </Screen>
  );
}
export function StoryCreate() {
  const { session } = useAuth();
  const account = useRef(session?.user.id);
  account.current = session?.user.id;
  const isCurrentAccount = useCallback(
    (userId: string) => account.current === userId,
    [],
  );
  return (
    <Screen title="Créer une story">
      <AuthGate>
        {!!session && (
          <StoryCreateContent
            key={session.user.id}
            userId={session.user.id}
            isCurrentAccount={isCurrentAccount}
          />
        )}
      </AuthGate>
    </Screen>
  );
}

type StoryAttempt = ReturnType<typeof createStoryPublication>;
function StoryCreateContent({
  userId,
  isCurrentAccount,
}: {
  userId: string;
  isCurrentAccount(userId: string): boolean;
}) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const cache = useQueryClient();
  const { profile } = useAuth();
  const mounted = useRef(true),
    busy = useRef(false),
    picking = useRef(false);
  const attempt = useRef<StoryAttempt | null>(null);
  const [asset, setAsset] = useState<{
    uri: string;
    base64: string;
    kind: "image" | "video";
    mime: string;
  } | null>(null);
  const [filters, setFilters] = useState({ ...DEFAULT_STORY_FILTERS });
  const [caption, setCaption] = useState(""),
    [location, setLocation] = useState(""),
    [hashtags, setHashtags] = useState("");
  const [ready, setReady] = useState(false),
    [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0),
    [actionError, setActionError] = useState("");
  const [working, setWorking] = useState(false),
    [pickerOpen, setPickerOpen] = useState(false);
  const [frozen, setFrozen] = useState(false),
    [persisted, setPersisted] = useState(false),
    [confirmDiscard, setConfirmDiscard] = useState(false);
  const current = () => mounted.current && isCurrentAccount(userId);
  const assertCurrentAccount = () => {
    if (!current())
      throw new Error(
        "Votre session a changé. Revenez au compte de cette story.",
      );
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoadError("");
    void storyPublicationJournal
      .load(userId)
      .then((draft) => {
        if (cancelled || !isCurrentAccount(userId)) return;
        if (draft) {
          attempt.current = createStoryPublication(
            draft,
            storyPublicationJournal,
          );
          setAsset({
            uri: `data:${draft.mime};base64,${draft.base64}`,
            base64: draft.base64,
            kind: draft.mediaKind || (draft.mime.startsWith("video/") ? "video" : "image"),
            mime: draft.mime,
          });
          setCaption(draft.record.caption);
          setLocation(draft.record.location || "");
          setHashtags(draft.record.hashtags.map((tag) => `#${tag}`).join(" "));
          setFilters({ ...draft.record.filters });
          setFrozen(true);
          setPersisted(true);
        } else {
          attempt.current = null;
          setFrozen(false);
          setPersisted(false);
        }
        setActionError("");
        setConfirmDiscard(false);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled && isCurrentAccount(userId))
          setLoadError(
            "Impossible de récupérer la tentative de story conservée sur cet appareil. Aucun envoi n’a été lancé.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [userId, isCurrentAccount, loadVersion]);
  const finish = () => {
    if (!current()) return;
    attempt.current = null;
    void cache.invalidateQueries({ queryKey: ["stories"] });
    router.replace("/stories");
  };
  const save = useMutation({
    mutationFn: async (publication: StoryAttempt) => {
      const services = await storyPublicationServices(
        userId,
        assertCurrentAccount,
      );
      return publication.publish(services);
    },
  });
  const discard = useMutation({
    mutationFn: async (publication: StoryAttempt) => {
      const services = await storyPublicationServices(
        userId,
        assertCurrentAccount,
      );
      return publication.discard(services);
    },
  });
  const pickMedia = async (source: "camera" | "photo" | "video") => {
    if (busy.current || picking.current || attempt.current || !current())
      return;
    picking.current = true;
    setPickerOpen(true);
    setActionError("");
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Autorisez l’accès à la caméra pour prendre une photo.",
          );
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              base64: true,
              quality: 0.8,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: source === "video" ? ["videos"] : ["images"],
              base64: true,
              quality: 0.8,
              videoMaxDuration: 60,
            });
      if (!result.canceled && current()) {
        const picked = result.assets[0];
        if (!picked.base64)
          throw new Error(
            source === "video"
              ? "Cette vidéo ne peut pas être importée depuis cet appareil."
              : "Cette photo ne peut pas être importée depuis cet appareil.",
          );
        const media = storyMedia(picked.base64, picked.mimeType);
        setAsset({
          uri: picked.uri,
          base64: picked.base64,
          kind: media.kind,
          mime: media.mime,
        });
        if (media.kind === "video") setFilters({ ...DEFAULT_STORY_FILTERS });
      }
    } catch (error) {
      if (current())
        setActionError(
          error instanceof Error
            ? error.message
            : source === "camera"
              ? "Impossible d’ouvrir la caméra."
              : "Impossible d’ouvrir la photothèque.",
        );
    } finally {
      picking.current = false;
      if (current()) setPickerOpen(false);
    }
  };
  const publish = async () => {
    if (busy.current || picking.current || !ready || !current()) return;
    busy.current = true;
    setWorking(true);
    setActionError("");
    setConfirmDiscard(false);
    try {
      if (!attempt.current) {
        if (!asset) throw new Error("Sélectionnez une photo ou une vidéo.");
        const id = randomUUID(),
          createdAt = Date.now(),
          media = storyMedia(asset.base64, asset.mime);
        const path = `stories/${userId}-${id}.${media.ext}`;
        attempt.current = createStoryPublication(
          {
            version: 1,
            base64: asset.base64,
            mime: media.mime,
            path,
            mediaKind: media.kind,
            createdAt,
            record: {
              id,
              user_id: userId,
              media_url: supabase.storage.from("avatars").getPublicUrl(path)
                .data.publicUrl,
              caption: caption.trim(),
              location: location.trim() || null,
              hashtags: hashtags
                .split(/\s+/)
                .filter((tag) => tag.startsWith("#") && tag.length > 1)
                .map((tag) => tag.slice(1)),
              filters: media.kind === "image" ? normalizeStoryFilters(filters) : { ...DEFAULT_STORY_FILTERS },
              expires_at: new Date(createdAt + STORY_LIFETIME).toISOString(),
            },
          },
          storyPublicationJournal,
        );
        setFrozen(true);
      }
      // Persist even while offline. React Query's online guard runs only after
      // this local save, so an interrupted app can restore the exact attempt.
      await storyPublicationJournal.save(attempt.current.draft);
      assertCurrentAccount();
      setPersisted(true);
      const storyId = await save.mutateAsync(attempt.current);
      void notifyPublicationPublished({ authorId: userId, contentId: storyId, kind: "story" });
      void notifyNetworkNewContent({
        authorId: userId,
        authorName: profile ? displayName(profile) : null,
        contentId: storyId,
        kind: "story",
      });
      void cache.invalidateQueries({ queryKey: ["notifications", userId] });
      void cache.invalidateQueries({ queryKey: ["notifications", userId, "unread-count"] });
      finish();
    } catch (error) {
      if (current())
        setActionError(
          error instanceof Error
            ? error.message
            : "La publication n’a pas pu être confirmée. Réessayez pour vérifier cette tentative.",
        );
    } finally {
      busy.current = false;
      if (current()) setWorking(false);
    }
  };
  const discardAttempt = async () => {
    if (busy.current || !attempt.current || !current()) return;
    busy.current = true;
    setWorking(true);
    setActionError("");
    try {
      const result = await discard.mutateAsync(attempt.current);
      if (!current()) return;
      if (result.published) {
        finish();
        return;
      }
      attempt.current = null;
      setFrozen(false);
      setPersisted(false);
      setConfirmDiscard(false);
      setAsset(null);
      setCaption("");
      setLocation("");
      setHashtags("");
      setFilters({ ...DEFAULT_STORY_FILTERS });
    } catch (error) {
      if (current())
        setActionError(
          error instanceof Error
            ? error.message
            : "Impossible de vérifier cette tentative. Elle a été conservée.",
        );
    } finally {
      busy.current = false;
      if (current()) setWorking(false);
    }
  };
  const forgetUnreadable = async () => {
    if (busy.current || !current()) return;
    busy.current = true;
    setWorking(true);
    try {
      await storyPublicationJournal.discardUnreadableForAccount(userId);
      if (current()) {
        setConfirmDiscard(false);
        setLoadVersion((value) => value + 1);
      }
    } catch {
      if (current())
        setLoadError("La tentative locale n’a pas pu être effacée. Réessayez.");
    } finally {
      busy.current = false;
      if (current()) setWorking(false);
    }
  };
  const hashtagSuggestions = useMemo(
    () =>
      storyHashtagSuggestions({
        caption,
        location,
        mediaKind: asset?.kind,
        current: hashtags,
      }),
    [asset?.kind, caption, hashtags, location],
  );
  const appendHashtag = (tag: string) => {
    if (attempt.current || busy.current) return;
    setHashtags((value) => addStoryHashtag(value, tag));
  };
  if (!ready)
    return loadError ? (
      <View style={{ gap: 12 }}>
        <Text
          accessibilityRole="alert"
          style={[s.text, { color: colors.danger }]}
        >
          {loadError}
        </Text>
        <Button
          title="Réessayer la récupération"
          secondary
          disabled={working}
          onPress={() => setLoadVersion((value) => value + 1)}
        />
        {!!confirmDiscard && (
          <Text style={s.subtitle}>
            Effacer uniquement cette tentative locale ? Une story éventuellement
            publiée restera en ligne. Son résultat ne pourra plus être vérifié
            depuis ce brouillon.
          </Text>
        )}
        <Button
          title={
            confirmDiscard
              ? "Effacer la tentative locale"
              : "Abandonner la tentative locale"
          }
          secondary
          busy={working}
          onPress={() =>
            confirmDiscard ? void forgetUnreadable() : setConfirmDiscard(true)
          }
        />
      </View>
    ) : (
      <Loading />
    );
  return (
    <>
      <Text style={s.subtitle}>
        {frozen
          ? persisted
            ? "Cette tentative est conservée sur cet appareil. Vérifiez son résultat ou reprenez son envoi. La photo, les réglages et l’expiration restent identiques."
            : "Cette tentative garde les mêmes réglages. Réessayez pour la conserver sur cet appareil et vérifier son envoi."
          : "Partagez un moment avec votre réseau. Votre story sera visible pendant 24h."}
      </Text>
      {!!asset &&
        (asset.kind === "video" ? (
          <NativeVideo
            uri={asset.uri}
            active
            visible
            controls
            contentFit="cover"
            style={{
              width: "100%",
              aspectRatio: 0.8,
              borderRadius: 20,
              overflow: "hidden",
              backgroundColor: "#0F172A",
            }}
          />
        ) : (
          <FilteredStoryImage
            uri={asset.uri}
            filters={filters}
            style={{ width: "100%", aspectRatio: 0.8, borderRadius: 20 }}
          />
        ))}
      {!!asset && asset.kind === "image" && (
        <StoryFilterEditor
          value={filters}
          onChange={(value) => {
            if (!attempt.current && !busy.current) setFilters(value);
          }}
          disabled={frozen || working}
        />
      )}
      <View style={{ gap: 10 }}>
        <Button
          title="Prendre une photo"
          secondary
          onPress={() => void pickMedia("camera")}
          disabled={frozen || working || pickerOpen}
        />
        <Button
          title={asset?.kind === "image" ? "Changer la photo" : "Importer une photo"}
          secondary
          onPress={() => void pickMedia("photo")}
          disabled={frozen || working || pickerOpen}
        />
        <Button
          title={asset?.kind === "video" ? "Changer la vidéo / short" : "Importer une vidéo / short"}
          secondary
          onPress={() => void pickMedia("video")}
          disabled={frozen || working || pickerOpen}
        />
      </View>
      <Field
        label="Légende"
        value={caption}
        onChangeText={(value) => {
          if (!attempt.current && !busy.current) setCaption(value);
        }}
        multiline
        maxLength={2000}
        editable={!frozen && !working}
      />
      <ProfileAutocompleteField
        kind="city"
        label="Lieu"
        value={location}
        onChange={(value) => {
          if (!attempt.current && !busy.current) setLocation(value);
        }}
        onSelect={(city) => {
          if (!attempt.current && !busy.current)
            setLocation(
              [city.name, city.department]
                .filter(Boolean)
                .join(" · ")
                .slice(0, 150),
            );
        }}
        maxLength={150}
        disabled={frozen || working}
      />
      <Field
        label="Hashtags"
        value={hashtags}
        onChangeText={(value) => {
          if (!attempt.current && !busy.current) setHashtags(value);
        }}
        maxLength={300}
        editable={!frozen && !working}
      />
      {!!hashtagSuggestions.length && (
        <View style={{ gap: 8 }}>
          <Text style={[s.small, { fontWeight: "800", color: colors.muted }]}>Suggestions</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {hashtagSuggestions.map((tag) => (
              <Pressable
                key={tag}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter le hashtag ${tag}`}
                disabled={frozen || working}
                onPress={() => appendHashtag(tag)}
                style={({ pressed }) => ({
                  minHeight: 36,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? colors.accentSoft : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: frozen || working ? 0.55 : 1,
                })}
              >
                <Text style={{ color: colors.blue, fontWeight: "800" }}>#{tag}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {!!actionError && (
        <Text
          accessibilityRole="alert"
          style={[s.text, { color: colors.danger }]}
        >
          {actionError}
        </Text>
      )}
      <Button
        title={frozen ? "Vérifier et reprendre" : "Publier ma story"}
        busy={working}
        disabled={!asset || pickerOpen}
        onPress={() => void publish()}
      />
      {!!frozen && (
        <>
          {!!actionError && (
            <Button
              title="Récupérer la tentative conservée"
              secondary
              disabled={working}
              onPress={() => setLoadVersion((value) => value + 1)}
            />
          )}
          {!!confirmDiscard && (
            <Text style={s.subtitle}>
              Abandonner cette tentative locale ? Nous vérifions d’abord si elle
              a été publiée. Aucune story ni photo en ligne ne sera supprimée.
            </Text>
          )}
          <Button
            title={
              confirmDiscard
                ? "Confirmer l’abandon"
                : "Abandonner cette tentative"
            }
            secondary
            disabled={working}
            onPress={() =>
              confirmDiscard ? void discardAttempt() : setConfirmDiscard(true)
            }
          />
        </>
      )}
    </>
  );
}
