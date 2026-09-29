import {
  initialVideoCursor,
  mergeVideoPage,
  videoFeedKey,
} from "../lib/videoFeed";
import { PostTranslation } from "../components/PostTranslation";
import { contentReportPath } from "../lib/contentReport";
import { notifyNetworkNewContent, notifyPublicationPublished } from "../lib/notificationEvents";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { MediaActionShade } from "../components/MediaActionShade";
import { randomUUID } from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchShortFriends } from "../lib/shortFriends";
import { blockedSocialAuthors } from "../lib/socialVisibility";
import {
  createShortPublication,
  MAX_SHORT_BYTES,
  shortVideoExtension,
} from "../lib/shortPublication";
import { shortPublicationServices } from "../lib/shortPublicationServices";
import { moderateText, MODERATION_ERROR_MESSAGE } from "../lib/moderation";
import { Profile, displayName } from "../lib/models";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  Chip,
  Screen,
  useUIStyles,
} from "../components/ui";
import { ShortVideo } from "../components/ShortVideo";
import { FollowAuthor } from "../components/FollowAuthor";
import { RepostButton } from "../components/RepostButton";
import { repostBackendMissing } from "../lib/postReposts";
import { ShortComments } from "../components/ShortComments";
import { ShortMusicPicker } from "../components/ShortMusicPicker";
import { Image } from "expo-image";
import { useMediaSound } from "../lib/mediaSound";
import { getDefaultMusic, musicLibrary } from "../data/shortMusicLibrary";
import {
  shortClip,
  shortGoals,
  musicFields,
  missingGoalColumn,
  type ShortClip,
} from "../lib/shortEditing";
import { storyPhoto } from "../lib/storyPublication";
import { useTheme } from "../theme";
import { createPageRequestGate, visibleMediaId } from "../lib/mediaFeed";
export interface Short {
  id: string;
  created_at: string;
  origin?: "post" | "short";
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  description: string | null;
  user: Profile | null;
  music?: string | null;
  artist?: string | null;
  music_url?: string | null;
  start_time?: number | null;
  duration?: number | null;
  goal_timestamps?: number[] | null;
  reposted_name?: string | null;
}
const selection =
  "*,user:profiles!shorts_user_id_fkey(id,full_name,username,avatar_url)";
function formatShortCount(value: number) {
  if (value <= 0) return "";
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10} M`;
  if (value >= 1_000) return `${Math.round(value / 100) / 10} K`;
  return String(value);
}

function useShortEngagement(short: Short) {
  const [shareError, setShareError] = useState(false);
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const cache = useQueryClient();
  const isPost = short.origin === "post";
  const likesTable = isPost ? "post_reactions" : "short_likes";
  const contentColumn = isPost ? "post_id" : "short_id";
  const likes = useQuery({
    queryKey: ["short-likes", short.origin || "short", short.id, uid],
    enabled: !!uid,
    queryFn: async () => {
      const [total, mine] = await Promise.all([
        supabase
          .from(likesTable)
          .select("id", { count: "exact", head: true })
          .eq(contentColumn, short.id),
        supabase
          .from(likesTable)
          .select("id")
          .eq(contentColumn, short.id)
          .eq("user_id", uid!)
          .maybeSingle(),
      ]);
      if (total.error) throw total.error;
      if (mine.error) throw mine.error;
      return { count: total.count || 0, id: mine.data?.id };
    },
  });
  const comments = useQuery({
    queryKey: ["short-comments-count", short.origin || "short", short.id, uid],
    enabled: !!uid,
    queryFn: async () => {
      const { count, error } = await supabase
        .from(isPost ? "post_comments" : "short_comments")
        .select("id", { count: "exact", head: true })
        .eq(contentColumn, short.id);
      if (error) throw error;
      return count || 0;
    },
  });
  const toggle = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("Connexion requise");
      const r = likes.data?.id
        ? await supabase
            .from(likesTable)
            .delete()
            .eq("id", likes.data.id)
            .eq("user_id", uid)
        : await supabase.from(likesTable).insert({
            [contentColumn]: short.id,
            user_id: uid,
            ...(isPost ? { reaction_type: "love" } : {}),
          });
      if (r.error) throw r.error;
    },
    onSuccess: async () => {
      await cache.invalidateQueries({
        queryKey: ["short-likes", short.origin || "short", short.id],
      });
      if (isPost) {
        void cache.invalidateQueries({ queryKey: ["posts"] });
        void cache.invalidateQueries({ queryKey: ["post", short.id] });
      }
    },
  });
  const share = () => {
    setShareError(false);
    void Share.share({
      message: isPost
        ? `https://www.foot-nation.com/posts/${short.id}`
        : `https://www.foot-nation.com/shorts?shortId=${short.id}`,
    }).catch(() => setShareError(true));
  };
  return {
    liked: !!likes.data?.id,
    likeCount: likes.isError ? 0 : likes.data?.count || 0,
    commentCount: comments.isError ? 0 : comments.data || 0,
    pending: likes.isPending || toggle.isPending,
    toggleLike: () => toggle.mutate(),
    share,
    shareError,
    toggleError: toggle.isError,
  };
}

function ShortReelsAction({
  label,
  count,
  disabled,
  onPress,
  children,
}: {
  label: string;
  count?: string;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        shortStyles.action,
        { opacity: disabled ? 0.5 : pressed ? 0.68 : 1 },
      ]}
    >
      {children}
      {!!count && <Text style={shortStyles.actionCount}>{count}</Text>}
    </Pressable>
  );
}

export function ShortReelsFrame({
  short,
  visible,
  showBack = false,
  onBack,
  profileName,
  mode = "all",
  onModeChange,
  onOpenComments,
}: {
  short: Short;
  visible: boolean;
  showBack?: boolean;
  onBack?: () => void;
  profileName?: string;
  mode?: "all" | "friends";
  onModeChange?: (mode: "all" | "friends") => void;
  onOpenComments?: () => void;
}) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [muted, setMuted] = useMediaSound();
  const engagement = useShortEngagement(short);
  const author = displayName(short.user);
  const goComments =
    onOpenComments ||
    (() =>
      router.push({
        pathname: short.origin === "post" ? "/posts/[id]" : "/shorts/[id]",
        params: { id: short.id, comments: "1" },
      }));
  return (
    <View style={shortStyles.reel}>
      <ShortVideo
        uri={short.video_url}
        autoplay
        musicUri={short.music_url}
        goals={short.goal_timestamps ?? []}
        visible={visible}
        posterUri={short.thumbnail_url}
        controls={false}
        muted={muted}
        style={StyleSheet.absoluteFill}
      />
      <MediaActionShade />
      <View style={shortStyles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showBack ? "Retour" : "Créer un short"}
          onPress={() =>
            onBack
              ? onBack()
              : showBack
                ? router.canGoBack()
                  ? router.back()
                  : router.replace("/shorts")
                : router.push("/shorts/create")
          }
          style={shortStyles.topButton}
        >
          {showBack ? (
            <ArrowLeft size={28} color="#FFFFFF" strokeWidth={2.2} />
          ) : (
            <Text style={shortStyles.createPlus}>+</Text>
          )}
        </Pressable>
        {profileName ? (
          <Text
            numberOfLines={1}
            style={[shortStyles.reelsTitle, { flex: 1, fontSize: 17 }]}
          >
            {profileName}
          </Text>
        ) : (
          (
            [
              ["all", "Reels"],
              ["friends", "Ami(e)s"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === value }}
              onPress={() =>
                onModeChange
                  ? onModeChange(value)
                  : router.replace({
                      pathname: "/shorts",
                      params: { mode: value },
                    })
              }
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text
                style={[
                  shortStyles.reelsTitle,
                  { opacity: mode === value ? 1 : 0.55 },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            muted ? "Activer le son du short" : "Couper le son du short"
          }
          accessibilityState={{ selected: !muted }}
          onPress={() => setMuted(!muted)}
          style={[shortStyles.topButton, { marginLeft: "auto" }]}
        >
          {muted ? (
            <VolumeX size={24} color="#FFFFFF" />
          ) : (
            <Volume2 size={24} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
      <View style={shortStyles.actionRail}>
        <ShortReelsAction
          label={`${engagement.likeCount} j’aime. Aimer ce short.`}
          count={formatShortCount(engagement.likeCount)}
          disabled={engagement.pending}
          onPress={engagement.toggleLike}
        >
          <Heart
            size={35}
            color="#FFFFFF"
            fill={engagement.liked ? colors.magenta : "transparent"}
            strokeWidth={2}
          />
        </ShortReelsAction>
        <ShortReelsAction
          label={`${engagement.commentCount} commentaires. Ouvrir les commentaires.`}
          count={formatShortCount(engagement.commentCount)}
          onPress={goComments}
        >
          <MessageCircle size={34} color="#FFFFFF" strokeWidth={2} />
        </ShortReelsAction>
        {short.origin === "post" ? (
          <RepostButton postId={short.id} overlay />
        ) : (
          <RepostButton shortId={short.id} overlay />
        )}
        <ShortReelsAction label="Partager" onPress={engagement.share}>
          <Send size={33} color="#FFFFFF" strokeWidth={2} />
        </ShortReelsAction>
        <ShortReelsAction
          label="Menu"
          onPress={() =>
            short.user_id !== session?.user.id
              ? router.push(
                  contentReportPath(
                    short.user_id,
                    short.origin === "post" ? "post" : "short",
                    short.id,
                  ),
                )
              : router.push("/shorts/create")
          }
        >
          <MoreHorizontal size={35} color="#FFFFFF" strokeWidth={2.1} />
        </ShortReelsAction>
        <View style={{ position: "relative", paddingBottom: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Voir le profil de ${author}`}
            onPress={() => router.push(`/profile/${short.user_id}`)}
            style={shortStyles.miniAvatar}
          >
            <Avatar uri={short.user?.avatar_url} name={author} size={34} />
          </Pressable>
          <FollowAuthor id={short.user_id} name={author} variant="badge" />
        </View>
      </View>
      <View style={shortStyles.bottomInfo}>
        <LinearGradient
          pointerEvents="none"
          accessible={false}
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.52)", "rgba(0,0,0,0.76)"]}
          locations={[0, 0.45, 1]}
          style={shortStyles.captionShade}
        />
        <View style={shortStyles.authorLine}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Voir le profil de ${author}`}
            onPress={() => router.push(`/profile/${short.user_id}`)}
            style={[
              shortStyles.authorLine,
              { flex: 1, minWidth: 0, minHeight: 44 },
            ]}
          >
            <Avatar uri={short.user?.avatar_url} name={author} size={38} />
            <Text numberOfLines={1} style={shortStyles.authorName}>
              {author}
            </Text>
          </Pressable>
        </View>
        {!!short.reposted_name && (
          <Text style={shortStyles.caption}>
            Republié par {short.reposted_name}
          </Text>
        )}
        {!!short.description && (
          <Pressable accessibilityRole="button" onPress={goComments}>
            <Text numberOfLines={2} style={shortStyles.caption}>
              {short.description}
            </Text>
          </Pressable>
        )}
        <PostTranslation text={short.description} overlay />
        {!!engagement.shareError && (
          <Text accessibilityRole="alert" style={shortStyles.errorText}>
            Le partage n’est pas disponible.
          </Text>
        )}
        {!!engagement.toggleError && (
          <Text accessibilityRole="alert" style={shortStyles.errorText}>
            Réaction non enregistrée.
          </Text>
        )}
      </View>
    </View>
  );
}

export default function Shorts() {
  const { shortId, mode: modeParam } = useLocalSearchParams<{
    shortId?: string;
    mode?: string;
  }>();
  const mode = modeParam === "friends" ? "friends" : "all";
  const changeMode = (value: "all" | "friends") =>
    router.setParams({ mode: value });
  useEffect(() => {
    if (shortId && /^[0-9a-f-]{36}$/i.test(shortId))
      router.replace(`/shorts/${shortId}`);
  }, [shortId]);
  const { colors } = useTheme();
  const s = useUIStyles();

  const { session } = useAuth();
  const [height, setHeight] = useState(660),
    [active, setActive] = useState<string | null>(null);
  const viewability = useRef({
    itemVisiblePercentThreshold: 70,
    minimumViewTime: 150,
  });
  const viewChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: { item: Short; isViewable?: boolean }[];
    }) =>
      setActive((current) =>
        visibleMediaId(
          viewableItems.map((entry) => ({
            ...entry,
            item: { ...entry.item, id: videoFeedKey(entry.item) },
          })),
          current,
        ),
      ),
  );
  const q = useInfiniteQuery({
    queryKey: ["shorts-native", session?.user.id, mode, "all-user-videos"],
    enabled: !!session,
    initialPageParam: initialVideoCursor,
    queryFn: async ({ pageParam }) => {
      const blocked = await blockedSocialAuthors(session!.user.id);
      const reposts = await supabase.rpc("get_video_repost_feed", {
        p_mode: mode,
        p_offset: pageParam.offset,
        p_limit: 12,
      });
      const postSelection =
        "id,user_id,created_at,video_url,image_url,content,user:profiles!posts_user_id_fkey(id,full_name,username,avatar_url)";
      const toPostVideo = (post: {
        id: string;
        user_id: string;
        created_at: string;
        video_url: string;
        image_url: string | null;
        content: string | null;
        user: Profile | Profile[] | null;
      }): Short => ({
        id: post.id,
        user_id: post.user_id,
        created_at: post.created_at,
        video_url: post.video_url,
        thumbnail_url: post.image_url,
        description: post.content,
        user: Array.isArray(post.user) ? post.user[0] || null : post.user,
        origin: "post",
        music_url: getDefaultMusic().audioUrl,
      });
      if (!reposts.error) {
        const entries = reposts.data as {
          content_kind: "post" | "short";
          content_id: string;
          reposted_name: string | null;
        }[];
        if (!entries.length) return { items: [] as Short[], next: undefined };
        const postIds = entries
          .filter((entry) => entry.content_kind === "post")
          .map((entry) => entry.content_id);
        const shortIds = entries
          .filter((entry) => entry.content_kind === "short")
          .map((entry) => entry.content_id);
        const [postRows, shortRows] = await Promise.all([
          postIds.length
            ? supabase.from("posts").select(postSelection).in("id", postIds)
            : { data: [], error: null },
          shortIds.length
            ? supabase.from("shorts").select(selection).in("id", shortIds)
            : { data: [], error: null },
        ]);
        if (postRows.error) throw postRows.error;
        if (shortRows.error) throw shortRows.error;
        const rows: Short[] = [
          ...(postRows.data || []).map(toPostVideo),
          ...((shortRows.data || []) as unknown as Short[]),
        ];
        const byId = new Map(
          rows
            .filter((row) => !blocked.includes(row.user_id))
            .map((row) => [videoFeedKey(row), row]),
        );
        return {
          items: entries.flatMap((entry) => {
            const video = byId.get(`${entry.content_kind}:${entry.content_id}`);
            return video
              ? [{ ...video, reposted_name: entry.reposted_name }]
              : [];
          }),
          next:
            entries.length === 12
              ? { ...pageParam, offset: pageParam.offset + 12 }
              : undefined,
        };
      }
      if (!repostBackendMissing(reposts.error)) throw reposts.error;
      // Before activation, merge the existing readable sources with independent cursors.
      const friends =
        mode === "friends"
          ? [session!.user.id, ...(await fetchShortFriends(session!.user.id))]
          : null;
      if (friends && !friends.length)
        return { items: [] as Short[], next: undefined };
      let postRequest = supabase
        .from("posts")
        .select(postSelection)
        .not("video_url", "is", null)
        .neq("video_url", "")
        .or("moderation_hidden.is.null,moderation_hidden.eq.false")
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam.posts, pageParam.posts + 12);
      let shortRequest = supabase
        .from("shorts")
        .select(selection)
        .not("video_url", "is", null)
        .neq("video_url", "")
        .or("moderation_hidden.is.null,moderation_hidden.eq.false")
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam.shorts, pageParam.shorts + 12);
      if (friends) {
        postRequest = postRequest.in("user_id", friends);
        shortRequest = shortRequest.in("user_id", friends);
      }
      if (blocked.length) {
        postRequest = postRequest.filter(
          "user_id",
          "not.in",
          `(${blocked.join(",")})`,
        );
        shortRequest = shortRequest.filter(
          "user_id",
          "not.in",
          `(${blocked.join(",")})`,
        );
      }
      const [postRows, shortRows] = await Promise.all([
        postRequest,
        shortRequest,
      ]);
      if (postRows.error) throw postRows.error;
      if (shortRows.error) throw shortRows.error;
      return mergeVideoPage(
        (postRows.data || []).map(toPostVideo),
        (shortRows.data || []) as unknown as Short[],
        pageParam,
      );
    },
    getNextPageParam: (last) => last.next,
  });
  const shorts = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages.flatMap((page) => page.items) || []).filter(
      (item) => {
        const key = videoFeedKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      },
    );
  }, [q.data?.pages]);
  const pageGate = useRef(createPageRequestGate());
  const loadMore = (retry = false) =>
    pageGate.current.run(
      {
        key: `${session?.user.id}:${mode}:${shorts.length}:${shorts.at(-1)?.id || ""}`,
        hasNextPage: !!session && q.hasNextPage,
        isFetching: q.isFetching,
        isError: q.isError,
        retry,
      },
      () => q.fetchNextPage(),
    );
  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={shortStyles.screen}
    >
      <AuthGate allowIncomplete>
        <View
          style={{ flex: 1 }}
          onLayout={(e) => {
            const next = e.nativeEvent.layout.height;
            if (Number.isFinite(next) && next > 0) setHeight(next);
          }}
        >
          <FlatList
            key={`${session?.user.id || "guest"}:${mode}`}
            data={shorts}
            extraData={active}
            keyExtractor={videoFeedKey}
            pagingEnabled
            onViewableItemsChanged={viewChanged.current}
            viewabilityConfig={viewability.current}
            windowSize={3}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            getItemLayout={(_data, index) => ({
              length: height,
              offset: height * index,
              index,
            })}
            renderItem={({ item }) => (
              <View style={{ height }}>
                <ShortReelsFrame
                  short={item}
                  visible={active === videoFeedKey(item)}
                  mode={mode}
                  onModeChange={changeMode}
                />
              </View>
            )}
            onEndReached={() => {
              void loadMore();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              shorts.length ? (
                <View style={shortStyles.footerOverlay}>
                  {q.isFetchingNextPage ? (
                    <Loading />
                  ) : q.isError ? (
                    <ErrorState
                      error={q.error}
                      retry={() => {
                        if (q.isFetchNextPageError) void loadMore(true);
                        else void q.refetch();
                      }}
                    />
                  ) : q.hasNextPage ? (
                    <Button
                      title="Afficher plus de Shorts"
                      secondary
                      onPress={() => void loadMore(true)}
                    />
                  ) : null}
                </View>
              ) : null
            }
            ListEmptyComponent={
              q.isPending ? (
                <View style={shortStyles.centerEmpty}>
                  <Loading />
                </View>
              ) : q.isError ? (
                <View style={shortStyles.centerEmpty}>
                  <ErrorState error={q.error} retry={() => void q.refetch()} />
                </View>
              ) : (
                <View style={shortStyles.centerEmpty}>
                  <Empty
                    title={
                      mode === "friends"
                        ? "Aucun short de vos amis pour le moment"
                        : "Aucun short pour le moment"
                    }
                  />
                  {mode === "friends" && (
                    <Button
                      title="Voir tous les Reels"
                      onPress={() => changeMode("all")}
                    />
                  )}
                  <Button
                    title="Créer un short"
                    onPress={() => router.push("/shorts/create")}
                  />
                </View>
              )
            }
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={() => void q.refetch()}
          />
        </View>
      </AuthGate>
    </SafeAreaView>
  );
}
export function ShortDetail() {
  const { id, comments: commentsParam } = useLocalSearchParams<{
    id: string;
    comments?: string;
  }>();
  const { session } = useAuth();
  const [commentsOpen, setCommentsOpen] = useState(commentsParam === "1");
  useEffect(() => setCommentsOpen(commentsParam === "1"), [id, commentsParam]);
  const q = useQuery({
    queryKey: ["short", id, session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shorts")
        .select(selection)
        .eq("id", id)
        .single();
      if (error) throw error;
      const blocked = await blockedSocialAuthors(session!.user.id);
      if (blocked.includes(data.user_id))
        throw new Error("Ce short n’est plus disponible.");
      return data as unknown as Short;
    },
  });
  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={shortStyles.screen}
    >
      <AuthGate>
        {q.isPending ? (
          <View style={shortStyles.centerEmpty}>
            <Loading />
          </View>
        ) : q.isError ? (
          <View style={shortStyles.centerEmpty}>
            <ErrorState error={q.error} retry={() => void q.refetch()} />
          </View>
        ) : (
          <ShortReelsFrame
            short={q.data}
            visible={!commentsOpen}
            showBack
            onOpenComments={() => setCommentsOpen(true)}
          />
        )}
        <ShortComments
          shortId={id}
          open={commentsOpen && q.isSuccess}
          onClose={() => setCommentsOpen(false)}
        />
      </AuthGate>
    </SafeAreaView>
  );
}

const shortStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  reel: { flex: 1, backgroundColor: "#000000", overflow: "hidden" },
  topBar: {
    position: "absolute",
    top: 22,
    left: 14,
    right: 14,
    zIndex: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  topButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  createPlus: {
    color: "#FFFFFF",
    fontSize: 38,
    lineHeight: 40,
    fontFamily: "Inter-Regular",
  },
  reelsTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter-Bold",
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
  },
  friendsTitle: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: "Inter-Bold",
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
  },
  actionRail: {
    position: "absolute",
    right: 13,
    bottom: 142,
    zIndex: 9,
    alignItems: "center",
    gap: 18,
  },
  action: {
    minWidth: 52,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionCount: {
    color: "#FFFFFF",
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 5,
  },
  miniAvatar: {
    padding: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  bottomInfo: {
    position: "absolute",
    left: 16,
    right: 88,
    bottom: 84,
    zIndex: 8,
    gap: 8,
  },
  captionShade: {
    position: "absolute",
    top: -72,
    left: -16,
    right: -88,
    bottom: -84,
  },
  authorLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  authorName: {
    color: "#FFFFFF",
    fontFamily: "Inter-Bold",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    flexShrink: 1,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
  },
  followButton: {
    minHeight: 32,
    paddingHorizontal: 13,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  followText: {
    color: "#FFFFFF",
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    fontWeight: "700",
  },
  caption: {
    color: "#FFFFFF",
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: "rgba(0,0,0,0.65)",
    textShadowRadius: 5,
  },
  errorText: { color: "#FFFFFF", fontFamily: "Inter-SemiBold", fontSize: 12 },
  commentInputBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 22,
    zIndex: 10,
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: "rgba(20,24,28,0.9)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
  },
  commentInput: {
    flex: 1,
    minWidth: 0,
    color: "#FFFFFF",
    fontFamily: "Inter-Regular",
    fontSize: 16,
    paddingVertical: 0,
  },
  footerOverlay: { padding: 16, backgroundColor: "#000000" },
  centerEmpty: {
    flex: 1,
    minHeight: 520,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 16,
    backgroundColor: "#000000",
  },
  detailError: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 90,
    zIndex: 20,
  },
});
export function ShortCreate() {
  const { session } = useAuth();
  const currentAccount = useRef(session?.user.id);
  currentAccount.current = session?.user.id;
  return (
    <Screen title="Créer un short">
      <AuthGate>
        {session ? (
          <ShortCreateContent
            key={session.user.id}
            userId={session.user.id}
            isCurrentAccount={() => currentAccount.current === session.user.id}
          />
        ) : null}
      </AuthGate>
    </Screen>
  );
}

function ShortCreateContent({
  userId,
  isCurrentAccount,
}: {
  userId: string;
  isCurrentAccount: () => boolean;
}) {
  const { colors } = useTheme();
  const s = useUIStyles();
  const { profile } = useAuth();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("0"),
    [end, setEnd] = useState("");
  const [duration, setDuration] = useState(0),
    [position, setPosition] = useState(0);
  const [previewClip, setPreviewClip] = useState<ShortClip | null>(null),
    [playRequest, setPlayRequest] = useState(0);
  const [goals, setGoals] = useState<number[]>([]),
    [musicId, setMusicId] = useState<string | null>(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [thumbnail, setThumbnail] = useState<{
    uri: string;
    base64: string;
    mime: string;
    ext: string;
  } | null>(null);
  const music = musicLibrary.find((track) => track.id === musicId);
  const goalCapability = useQuery({
    queryKey: ["short-goals-capability", userId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const result = await supabase
        .from("shorts")
        .select("goal_timestamps")
        .eq("user_id", userId)
        .limit(0);
      if (result.error) {
        if (missingGoalColumn(result.error)) return false;
        throw result.error;
      }
      return true;
    },
  });
  const [pickError, setPickError] = useState("");
  const [picking, setPicking] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const attempt = useRef<ReturnType<typeof createShortPublication> | null>(
    null,
  );
  const pending = useRef(false);
  const pickerOpen = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const cache = useQueryClient();
  const assertCurrentAccount = () => {
    if (!mounted.current || !isCurrentAccount())
      throw new Error(
        "Votre session a changé. Revenez au compte de cette publication.",
      );
  };
  const pick = async () => {
    if (attempt.current || pickerOpen.current) return;
    pickerOpen.current = true;
    setPicking(true);
    try {
      setPickError("");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
      });
      if (
        !result.canceled &&
        mounted.current &&
        isCurrentAccount() &&
        !attempt.current
      ) {
        const selected = result.assets[0];
        if ((selected.fileSize || 0) > MAX_SHORT_BYTES)
          throw new Error("Choisissez une vidéo de moins de 50 Mo.");
        shortVideoExtension(selected.mimeType || "video/mp4");
        setAsset(selected);
        setStart("0");
        setEnd("");
        setPreviewClip(null);
        setGoals([]);
        setPosition(0);
        setDuration(
          typeof selected.duration === "number" && selected.duration > 0
            ? selected.duration / 1000
            : 0,
        );
        setThumbnail(null);
      }
    } catch (error) {
      if (mounted.current)
        setPickError(
          error instanceof Error
            ? error.message
            : "Impossible de sélectionner cette vidéo.",
        );
    } finally {
      pickerOpen.current = false;
      if (mounted.current) setPicking(false);
    }
  };
  const pickThumbnail = async () => {
    if (attempt.current || pickerOpen.current || pending.current) return;
    pickerOpen.current = true;
    setPicking(true);
    setPickError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        base64: true,
        quality: 0.8,
      });
      if (
        !result.canceled &&
        mounted.current &&
        isCurrentAccount() &&
        !attempt.current
      ) {
        const photo = result.assets[0],
          format = storyPhoto(photo.base64);
        setThumbnail({ uri: photo.uri, base64: photo.base64!, ...format });
      }
    } catch (error) {
      if (mounted.current)
        setPickError(
          error instanceof Error
            ? error.message
            : "Impossible de choisir la miniature.",
        );
    } finally {
      pickerOpen.current = false;
      if (mounted.current) setPicking(false);
    }
  };
  const preview = () => {
    try {
      const clip = shortClip(start, end, duration);
      shortGoals(goals, clip, duration);
      setPreviewClip(clip);
      setPlayRequest((value) => value + 1);
      setPickError("");
    } catch (error) {
      setPickError(
        error instanceof Error ? error.message : "Vérifiez les bornes.",
      );
    }
  };
  const save = useMutation({
    mutationFn: async () => {
      const publication = attempt.current;
      if (!publication) throw new Error("Sélectionnez une vidéo.");
      const services = await shortPublicationServices(
        userId,
        assertCurrentAccount,
      );
      return publication.publish(services);
    },
    onSuccess: (id) => {
      if (!mounted.current || !isCurrentAccount()) return;
      void notifyPublicationPublished({ authorId: userId, contentId: id, kind: "short" });
      void notifyNetworkNewContent({
        authorId: userId,
        authorName: profile ? displayName(profile) : null,
        contentId: id,
        kind: "short",
      });
      void cache.invalidateQueries({ queryKey: ["shorts-native", userId] });
      void cache.invalidateQueries({ queryKey: ["notifications", userId] });
      void cache.invalidateQueries({ queryKey: ["notifications", userId, "unread-count"] });
      attempt.current = null;
      router.replace("/shorts");
    },
    onSettled: () => {
      pending.current = false;
    },
  });
  const publish = () => {
    if (pending.current || pickerOpen.current || save.isSuccess) return;
    try {
      assertCurrentAccount();
      if (!attempt.current) {
        if (!asset) throw new Error("Sélectionnez une vidéo.");
        if (!moderateText(description).isClean)
          throw new Error(MODERATION_ERROR_MESSAGE);
        const clip = shortClip(start, end, duration),
          markers = shortGoals(goals, clip, duration);
        if (markers.length && !goalCapability.data)
          throw new Error(
            "La disponibilité des repères doit être confirmée avant publication.",
          );
        const mime = asset.mimeType || "video/mp4";
        const id = randomUUID();
        const path = `${userId}-${id}.${shortVideoExtension(mime)}`;
        attempt.current = createShortPublication({
          uri: asset.uri,
          mime,
          path,
          thumbnail: thumbnail
            ? {
                base64: thumbnail.base64,
                mime: thumbnail.mime,
                path: `${userId}-${id}-thumbnail.${thumbnail.ext}`,
              }
            : undefined,
          record: {
            id,
            user_id: userId,
            description: description.trim(),
            ...musicFields(musicId),
            thumbnail_url: thumbnail
              ? supabase.storage
                  .from("shorts")
                  .getPublicUrl(`${userId}-${id}-thumbnail.${thumbnail.ext}`)
                  .data.publicUrl
              : null,
            start_time: clip?.start ?? null,
            duration: clip?.duration ?? null,
            ...(goalCapability.data ? { goal_timestamps: markers } : {}),
            video_url: supabase.storage.from("shorts").getPublicUrl(path).data
              .publicUrl,
          },
        });
        setPreviewClip(clip);
        setFrozen(true);
        setMusicOpen(false);
      }
      setPickError("");
      pending.current = true;
      save.mutate();
    } catch (error) {
      setPickError(
        error instanceof Error
          ? error.message
          : "Impossible de préparer cette publication.",
      );
    }
  };
  return (
    <>
      {!!asset && (
        <ShortVideo
          key={asset.uri}
          uri={asset.uri}
          clip={previewClip}
          musicUri={music?.audioUrl}
          goals={goals}
          visible={!musicOpen && !picking && !save.isPending}
          playRequest={playRequest}
          onProgress={(seconds, total) => {
            setPosition(seconds);
            if (Number.isFinite(total) && total > 0) setDuration(total);
          }}
        />
      )}
      <Text style={s.small}>
        La vidéo originale sera envoyée. Les bornes choisies limitent sa lecture
        ; aucun fichier vidéo découpé ou mixé n’est exporté.
      </Text>
      <Button
        title={asset ? "Changer la vidéo" : "Choisir une vidéo"}
        secondary
        disabled={frozen || picking}
        busy={picking}
        onPress={() => void pick()}
      />
      {!!asset && (
        <View style={s.card}>
          <Text style={s.h2}>Extrait et buts</Text>
          <Text style={s.small}>
            {duration > 0
              ? `Vidéo : ${duration.toFixed(1)} s · position : ${position.toFixed(1)} s`
              : "Chargement de la durée…"}
          </Text>
          <Field
            label="Début dans la vidéo (secondes)"
            value={start}
            keyboardType="decimal-pad"
            editable={!frozen}
            onChangeText={(value) => {
              if (!attempt.current) setStart(value);
            }}
          />
          <Field
            label="Fin dans la vidéo (secondes, vide = fin)"
            value={end}
            keyboardType="decimal-pad"
            editable={!frozen}
            onChangeText={(value) => {
              if (!attempt.current) setEnd(value);
            }}
          />
          <Button
            title="Voir cet extrait"
            secondary
            onPress={preview}
            disabled={picking || save.isPending}
          />
          {goalCapability.isError ? (
            <ErrorState
              error={
                new Error(
                  "Impossible de vérifier la disponibilité des repères de buts.",
                )
              }
              retry={() => void goalCapability.refetch()}
            />
          ) : goalCapability.data === false ? (
            <Text style={s.small}>
              Les repères de buts nécessitent une mise à jour du service avant
              de pouvoir être enregistrés.
            </Text>
          ) : null}
          <Button
            title="Marquer un but à cette position"
            secondary
            disabled={
              frozen ||
              !goalCapability.data ||
              duration <= 0 ||
              goals.length >= 50
            }
            onPress={() => {
              if (!attempt.current) {
                try {
                  setGoals(
                    shortGoals(
                      [...goals, Math.round(position * 10) / 10],
                      shortClip(start, end, duration),
                      duration,
                    ),
                  );
                  setPickError("");
                } catch (error) {
                  setPickError(
                    error instanceof Error ? error.message : "Repère invalide.",
                  );
                }
              }
            }}
          />
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {goals.map((seconds) => (
              <Chip
                key={seconds}
                label={`Retirer le but à ${seconds.toFixed(1)} s`}
                disabled={frozen}
                onPress={() => {
                  if (!attempt.current)
                    setGoals((values) =>
                      values.filter((value) => value !== seconds),
                    );
                }}
              />
            ))}
          </View>
        </View>
      )}
      <Text style={s.h2}>Musique</Text>
      <Text style={s.small}>
        {music
          ? `${music.title} · ${music.artist}`
          : "Son original, sans musique ajoutée"}
      </Text>
      <Button
        title="Choisir une musique"
        secondary
        disabled={frozen || picking}
        onPress={() => setMusicOpen(true)}
      />
      <ShortMusicPicker
        open={musicOpen && !frozen}
        selected={musicId}
        choose={(id) => {
          if (!attempt.current) setMusicId(id);
        }}
        close={() => setMusicOpen(false)}
      />
      <Text style={s.h2}>Miniature</Text>
      {!!thumbnail && (
        <Image
          source={{ uri: thumbnail.uri }}
          contentFit="contain"
          style={{ width: "100%", height: 180, borderRadius: 14 }}
        />
      )}
      <Button
        title={thumbnail ? "Changer la miniature" : "Choisir une miniature"}
        secondary
        disabled={frozen || picking}
        onPress={() => void pickThumbnail()}
      />
      {!!thumbnail && (
        <Button
          title="Retirer la miniature"
          secondary
          disabled={frozen || picking}
          onPress={() => {
            if (!attempt.current) setThumbnail(null);
          }}
        />
      )}
      <Field
        label="Description"
        value={description}
        onChangeText={(value) => {
          if (!attempt.current) setDescription(value);
        }}
        multiline
        maxLength={2000}
        editable={!frozen}
      />
      {!!pickError && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {pickError}
        </Text>
      )}
      {!!save.isError && <ErrorState error={save.error} />}
      {!!(frozen && save.isError) && (
        <Text style={s.small}>
          La vidéo, la miniature, le texte, la musique et les repères de cette
          tentative sont conservés pendant ce formulaire. Réessayez pour
          vérifier son résultat et terminer la publication sans créer de
          doublon.
        </Text>
      )}
      <Button
        title={
          frozen && save.isError ? "Vérifier et réessayer" : "Publier mon short"
        }
        disabled={!asset || picking || save.isSuccess}
        busy={save.isPending}
        onPress={publish}
      />
    </>
  );
}
