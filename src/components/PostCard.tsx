import { PostCommentError, publishPostComment } from "../lib/postComments";
import { formatPublicationDate } from "../lib/publicationDate";
import { usePostCommentDraft } from "../lib/usePostCommentDraft";
import { contentReportPath } from "../lib/contentReport";
import { LikeBurst } from "./LikeBurst";
import { PostShareSheet } from "./PostShareSheet";
import { RepostButton } from "./RepostButton";
import { InlinePostComment } from "./InlinePostComment";
import { CommentActions } from "./CommentActions";
import { PostTranslation } from "./PostTranslation";
import React, { memo, useEffect, useMemo, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MediaActionShade } from "./MediaActionShade";
import { router, useFocusEffect } from "expo-router";
import { useCalls } from "./CallProvider";
import { useSoundtrackPlayer } from "../lib/useSoundtrackPlayer";
import { useMediaSound, registerSoundActivation } from "../lib/mediaSound";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  Bookmark,
  EyeOff,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  Trash2,
  UserMinus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react-native";
import { Avatar, Button, Chip, useUIStyles } from "./ui";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";
import { Post, Profile, displayName } from "../lib/models";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { SavePost } from "./SavePost";
import { UnfollowPostAuthor } from "./UnfollowPostAuthor";
import { FollowAuthor } from "./FollowAuthor";
import { useHiddenPosts } from "../lib/hiddenPosts";
import { NativeVideo } from "./Video";
import type { MediaPlaybackMemory } from "../lib/mediaFeed";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getDefaultMusic } from "../data/shortMusicLibrary";

export const PostCard = memo(function PostCard({
  post,
  mediaVisible = true,
  pageHeight,
  bottomInset = 0,
  onBackToFeed,
  initialCommentsOpen = false,
}: {
  post: Post;
  mediaVisible?: boolean;
  pageHeight?: number;
  bottomInset?: number;
  onBackToFeed?: () => void;
  initialCommentsOpen?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  const { session } = useAuth();
  const cache = useQueryClient();
  const { fontScale } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [picker, setPicker] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen);
  const [likeBurst, setLikeBurst] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const playbackMemory = useMemo(
    () => ({
      current: { seconds: 0, seekRequest: null } as MediaPlaybackMemory,
    }),
    [post.id, post.video_url],
  );
  const hiddenPosts = useHiddenPosts();
  const [hideError, setHideError] = useState(false);
  const [menuError, setMenuError] = useState(false);
  const reaction = post.post_reactions?.find(
    (r) => r.user_id === session?.user.id,
  );
  const react = useMutation({
    mutationFn: async (type: string) => {
      if (!session) throw new Error("Connectez-vous pour réagir.");
      const result =
        reaction?.reaction_type === type
          ? await supabase
              .from("post_reactions")
              .delete()
              .eq("id", reaction.id)
              .eq("user_id", session.user.id)
          : reaction
            ? await supabase
                .from("post_reactions")
                .update({ reaction_type: type })
                .eq("id", reaction.id)
                .eq("user_id", session.user.id)
            : await supabase.from("post_reactions").insert({
                post_id: post.id,
                user_id: session.user.id,
                reaction_type: type,
              });
      if (result.error) throw result.error;
      return (
        reaction?.reaction_type !== type && (type === "love" || type === "like")
      );
    },
    onSuccess: async (celebrate) => {
      if (celebrate) setLikeBurst((sequence) => sequence + 1);
      setPicker(false);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["posts"] }),
        cache.invalidateQueries({ queryKey: ["post", post.id] }),
        cache.invalidateQueries({ queryKey: ["short-likes", "post", post.id] }),
      ]);
    },
  });
  const fullScreen =
    pageHeight !== undefined && Number.isFinite(pageHeight) && pageHeight > 0;
  const hasMedia = !!(post.image_url || post.video_url);
  const compact =
    fullScreen && (pageHeight! - Math.max(0, bottomInset)) / fontScale < 510;
  const readPost = () => {
    if (fullScreen && hasMedia) return;
    if (fullScreen) setDetailsOpen(true);
    else setExpanded((value) => !value);
  };
  const videoVisible =
    mediaVisible &&
    !picker &&
    !detailsOpen &&
    !menuOpen &&
    !commentsOpen &&
    !shareOpen;
  const fallbackTrack = useMemo(() => getDefaultMusic(), []);
  const postMusic = post as Post & {
    music?: string | null;
    artist?: string | null;
    music_url?: string | null;
  };
  const musicUri = postMusic.music_url || fallbackTrack.audioUrl;
  const reactionCount = post.post_reactions?.length || 0;
  const commentCount = post.post_comments?.[0]?.count || 0;
  const canEdit = session?.user.id === post.user_id;
  if (hiddenPosts.ids.includes(post.id)) return null;
  return (
    <View
      style={
        fullScreen
          ? [
              styles.page,
              {
                height: pageHeight,
                paddingBottom: 0,
                paddingTop: 0,
              },
            ]
          : styles.listItem
      }
    >
      <View style={[styles.card, fullScreen ? styles.pageCard : undefined]}>
        {fullScreen ? (
          <>
            {hasMedia ? (
              <PostMedia
                post={post}
                fullScreen
                visible={videoVisible}
                playbackMemory={playbackMemory}
                compact={compact}
                immersive
              />
            ) : (
              <View style={styles.immersiveTextStage}>
                <Text
                  numberOfLines={compact ? 5 : 9}
                  style={styles.immersiveTextContent}
                >
                  {post.content}
                </Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Publication en plein écran. Faites défiler pour voir la suite."
              onPress={readPost}
              style={styles.immersiveOpenTarget}
            />
            <MediaActionShade />
            <View style={styles.immersiveHeader} pointerEvents="box-none">
              <LinearGradient
                pointerEvents="none"
                accessible={false}
                colors={[
                  "rgba(0,0,0,0.78)",
                  "rgba(0,0,0,0.52)",
                  "rgba(0,0,0,0)",
                ]}
                locations={[0, 0.5, 1]}
                style={styles.authorTopShade}
              />
              <PostAuthor
                post={post}
                compact={compact}
                fontScale={fontScale}
                canEdit={canEdit}
                onBackToFeed={onBackToFeed}
                onOpenMenu={() => setMenuOpen(true)}
                overlay
              />
            </View>
            <View
              style={[
                styles.immersiveBottom,
                { bottom: Math.max(66, bottomInset + 62) },
              ]}
            >
              {!hasMedia && (
                <PostCaption
                  post={post}
                  compact={compact}
                  expanded={false}
                  onPress={readPost}
                  overlay
                />
              )}
              {!hasMedia && (
                <View style={styles.immersiveFooter}>
                  <View style={styles.footerRow}>
                    <View style={styles.actionsSlot}>
                      <PostActions
                        onShare={() => setShareOpen(true)}
                        postId={post.id}
                        selected={!!reaction}
                        pending={react.isPending}
                        compact={compact}
                        reactionCount={reactionCount}
                        commentCount={commentCount}
                        onReact={() =>
                          react.mutate(reaction?.reaction_type || "love")
                        }
                        onChooseReaction={() => setPicker(true)}
                        onOpenComments={() => setCommentsOpen(true)}
                      />
                    </View>
                    <PostSoundtrack
                      uri={musicUri}
                      active={videoVisible}
                      compact
                    />
                    {!!(compact && !hasMedia) && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Lire la publication complète"
                        onPress={() => setDetailsOpen(true)}
                        style={styles.readAction}
                      >
                        <Text style={[s.text, styles.readLink]}>Lire</Text>
                      </Pressable>
                    )}
                  </View>
                  {!compact && (
                    <>
                      <PostStats
                        reactionCount={reactionCount}
                        commentCount={commentCount}
                        postId={post.id}
                        onOpenComments={() => setCommentsOpen(true)}
                        onChooseReaction={() => setPicker(true)}
                      />
                    </>
                  )}
                  {!!react.isError && (
                    <Text
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                      numberOfLines={compact ? 1 : undefined}
                      style={[s.small, styles.error]}
                    >
                      Impossible d’enregistrer la réaction. Réessayez.
                    </Text>
                  )}
                </View>
              )}
            </View>
            {!!hasMedia && (
              <>
                <View
                  style={[
                    styles.reelsActionRail,
                    { bottom: Math.max(144, bottomInset + 132) },
                  ]}
                >
                  <ReelsAction
                    label={`J’aime. ${reactionCount} réactions.`}
                    count={formatShortCount(reactionCount)}
                    onPress={() =>
                      react.mutate(reaction?.reaction_type || "love")
                    }
                    onLongPress={() => setPicker(true)}
                    disabled={react.isPending}
                  >
                    <Heart
                      size={35}
                      color={colors.white}
                      fill={reaction ? colors.magenta : "transparent"}
                      strokeWidth={2}
                    />
                  </ReelsAction>
                  <ReelsAction
                    label={`${commentCount} commentaires. Ouvrir les commentaires.`}
                    count={formatShortCount(commentCount)}
                    onPress={() => setCommentsOpen(true)}
                  >
                    <MessageCircle
                      size={34}
                      color={colors.white}
                      strokeWidth={2}
                    />
                  </ReelsAction>
                  <RepostButton postId={post.id} overlay />
                  <ReelsAction
                    label="Partager"
                    count=""
                    onPress={() => setShareOpen(true)}
                  >
                    <Send size={33} color={colors.white} strokeWidth={2} />
                  </ReelsAction>
                  <PostProfileAvatar post={post} size={34} overlay square />
                </View>
                <View
                  style={[
                    styles.reelsBottomInfo,
                    { bottom: Math.max(66, bottomInset + 62) },
                  ]}
                >
                  <LinearGradient
                    pointerEvents="none"
                    accessible={false}
                    colors={[
                      "rgba(0,0,0,0)",
                      "rgba(0,0,0,0.52)",
                      "rgba(0,0,0,0.76)",
                    ]}
                    locations={[0, 0.45, 1]}
                    style={[
                      styles.captionShade,
                      { bottom: -Math.max(66, bottomInset + 62) },
                    ]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Lire la publication complète"
                    onPress={() => setDetailsOpen(true)}
                  >
                    <Text numberOfLines={2} style={styles.reelsCaption}>
                      {post.content}
                      {!!post.hashtags?.length && ` ${post.hashtags.join(" ")}`}
                    </Text>
                  </Pressable>
                  <PostTranslation text={post.content} overlay />
                </View>
                <View
                  style={[
                    styles.soundtrackCorner,
                    { bottom: Math.max(66, bottomInset + 62) },
                  ]}
                >
                  <PostSoundtrack
                    uri={musicUri}
                    active={videoVisible}
                    compact
                    overlay
                  />
                </View>
              </>
            )}
          </>
        ) : (
          <>
            <PostAuthor
              post={post}
              compact={compact}
              fontScale={fontScale}
              canEdit={canEdit}
              onBackToFeed={fullScreen ? onBackToFeed : undefined}
              onOpenMenu={() => setMenuOpen(true)}
            />
            {!!hasMedia ? (
              <PostMedia
                post={post}
                fullScreen={fullScreen}
                visible={videoVisible}
                playbackMemory={playbackMemory}
                compact={compact}
              />
            ) : (
              <PostText
                post={post}
                fullScreen={fullScreen}
                compact={compact}
                expanded={expanded}
                fontScale={fontScale}
                onPress={readPost}
              />
            )}
            {!!hasMedia && (
              <PostCaption
                post={post}
                compact={compact}
                expanded={expanded}
                onPress={readPost}
              />
            )}
            <View
              style={[
                styles.footer,
                compact ? styles.compactFooter : undefined,
              ]}
            >
              <View style={styles.footerRow}>
                <View style={styles.actionsSlot}>
                  <PostActions
                    onShare={() => setShareOpen(true)}
                    postId={post.id}
                    selected={!!reaction}
                    pending={react.isPending}
                    compact={compact}
                    reactionCount={reactionCount}
                    commentCount={commentCount}
                    onReact={() =>
                      react.mutate(reaction?.reaction_type || "love")
                    }
                    onChooseReaction={() => setPicker(true)}
                    onOpenComments={() => setCommentsOpen(true)}
                  />
                </View>
                {!!hasMedia && (
                  <PostSoundtrack uri={musicUri} active={false} compact />
                )}
                {!!(compact && !hasMedia) && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Lire la publication complète"
                    onPress={() => setDetailsOpen(true)}
                    style={styles.readAction}
                  >
                    <Text style={[s.text, styles.readLink]}>Lire</Text>
                  </Pressable>
                )}
              </View>
              {!compact && (
                <>
                  <PostStats
                    reactionCount={reactionCount}
                    commentCount={commentCount}
                    postId={post.id}
                    onChooseReaction={() => setPicker(true)}
                    onOpenComments={() => setCommentsOpen(true)}
                  />
                </>
              )}
              {!!react.isError && (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  numberOfLines={compact ? 1 : undefined}
                  style={[s.small, styles.error]}
                >
                  Impossible d’enregistrer la réaction. Réessayez.
                </Text>
              )}
            </View>
          </>
        )}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "position" : undefined}
          style={
            fullScreen
              ? [
                  styles.inlineComposer,
                  { bottom: Math.max(4, bottomInset + 4) },
                ]
              : { padding: 12 }
          }
        >
          <InlinePostComment postId={post.id} />
        </KeyboardAvoidingView>
        <LikeBurst
          sequence={likeBurst}
          // mediaVisible only selects video playback; photos and text can be liked too.
          active={!detailsOpen && !commentsOpen && !shareOpen}
        />
      </View>

      <Modal
        visible={detailsOpen}
        transparent
        animationType={hasMedia ? "fade" : "slide"}
        onRequestClose={() => setDetailsOpen(false)}
      >
        {hasMedia ? (
          <ReelsPostDetail
            shareOpen={shareOpen}
            onShare={() => setShareOpen(true)}
            onCloseShare={() => setShareOpen(false)}
            likeBurst={likeBurst}
            post={post}
            visible={detailsOpen && !commentsOpen}
            playbackMemory={playbackMemory}
            selected={!!reaction}
            pending={react.isPending}
            reactionCount={reactionCount}
            commentCount={commentCount}
            musicUri={musicUri}
            onClose={() => setDetailsOpen(false)}
            onOpenMenu={() => setMenuOpen(true)}
            onOpenComments={() => setCommentsOpen(true)}
            onReact={() => react.mutate(reaction?.reaction_type || "love")}
            onChooseReaction={() => setPicker(true)}
          />
        ) : (
          <View style={styles.sheetBackdrop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer la publication"
              onPress={() => setDetailsOpen(false)}
              style={styles.sheetDismiss}
            />
            <View
              accessibilityViewIsModal
              onAccessibilityEscape={() => setDetailsOpen(false)}
              style={styles.detailsSheet}
            >
              <View style={styles.sheetTitleRow}>
                <Text
                  accessibilityRole="header"
                  style={[s.h2, styles.sheetTitle]}
                >
                  La publication
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Fermer la publication"
                  onPress={() => setDetailsOpen(false)}
                  style={styles.action}
                >
                  <X size={24} color={colors.ink} />
                </Pressable>
              </View>
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.detailsContent}
              >
                <Text style={[s.h2, styles.detailsAuthor]}>
                  {displayName(post.author)}
                </Text>
                <Text style={[s.small, styles.metadata]}>
                  {authorMetadata(post)}
                </Text>
                <Text style={[s.small, styles.metadata]}>
                  {postDate(post, true)}
                </Text>
                {!!(reactionCount || commentCount) && (
                  <Text style={[s.small, styles.metadata]}>
                    {[
                      reactionCount > 0
                        ? `${reactionCount} réaction${reactionCount === 1 ? "" : "s"}`
                        : "",
                      commentCount > 0
                        ? `${commentCount} commentaire${commentCount === 1 ? "" : "s"}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                )}
                <Text selectable style={[s.text, styles.detailsText]}>
                  {post.content}
                </Text>
                <PostTranslation text={post.content} />
                {!!post.hashtags?.length && (
                  <Text selectable style={[s.text, styles.hashtags]}>
                    {post.hashtags.join(" ")}
                  </Text>
                )}
                <Button
                  title="Voir la publication et les commentaires"
                  secondary
                  onPress={() => {
                    setDetailsOpen(false);
                    router.push(`/posts/${post.id}`);
                  }}
                />
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

      {shareOpen && !detailsOpen && (
        <PostShareSheet
          key={`share:${session?.user.id ?? "guest"}:${post.id}`}
          post={post}
          playbackMemory={playbackMemory}
          onClose={() => setShareOpen(false)}
        />
      )}
      <PostCommentsSheet
        key={`${session?.user.id ?? "guest"}:${post.id}`}
        post={post}
        open={commentsOpen}
        playbackMemory={playbackMemory}
        onClose={() => setCommentsOpen(false)}
      />
      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer le menu contextuel"
            onPress={() => setMenuOpen(false)}
            style={styles.sheetDismiss}
          />
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={() => setMenuOpen(false)}
            style={styles.contextSheet}
          >
            <View style={styles.sheetHandle} />
            {!!menuOpen && (
              <SavePost
                postId={post.id}
                labeled
                onSaved={() => setMenuOpen(false)}
              />
            )}
            <ContextMenuAction
              icon={<Share2 size={23} color={colors.ink} />}
              label="Partager"
              onPress={() => {
                setMenuOpen(false);
                setShareOpen(true);
              }}
            />
            <ContextMenuAction
              icon={<EyeOff size={23} color={colors.ink} />}
              label="Masquer ce contenu"
              onPress={() => {
                setHideError(false);
                void hiddenPosts
                  .hide(post.id)
                  .then(() => setMenuOpen(false))
                  .catch(() => setHideError(true));
              }}
            />
            <ContextMenuAction
              icon={<Flag size={23} color={colors.ink} />}
              label="Signaler"
              onPress={() => {
                setMenuOpen(false);
                router.push(contentReportPath(post.user_id, "post", post.id));
              }}
            />
            {!!(!canEdit && menuOpen) && (
              <UnfollowPostAuthor
                id={post.user_id}
                onDone={() => setMenuOpen(false)}
              />
            )}
            {!!hideError && (
              <Text accessibilityRole="alert" style={[s.small, styles.error]}>
                Impossible de masquer cette publication. Réessayez.
              </Text>
            )}
            {!!canEdit && (
              <>
                <View style={styles.contextDivider} />
                <ContextMenuAction
                  danger
                  icon={<Trash2 size={23} color={colors.danger} />}
                  label="Gérer ma publication"
                  onPress={() => {
                    setMenuOpen(false);
                    router.push(`/post/${post.id}/edit`);
                  }}
                />
              </>
            )}
            {!!menuError && (
              <Text accessibilityRole="alert" style={[s.small, styles.error]}>
                Le partage n’est pas disponible. Réessayez.
              </Text>
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={picker}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer les réactions"
            onPress={() => setPicker(false)}
            style={styles.sheetDismiss}
          />
          <ScrollView
            accessibilityViewIsModal
            onAccessibilityEscape={() => setPicker(false)}
            style={styles.reactionScroll}
            contentContainerStyle={styles.reactionSheet}
          >
            <View style={styles.sheetHandle} />
            <Text accessibilityRole="header" style={s.h2}>
              Votre réaction
            </Text>
            <View style={[s.row, styles.reactionChoices]}>
              {[
                ["like", "👍 J’aime"],
                ["celebrate", "🎉 Celebrate"],
                ["support", "🤝 Support"],
                ["love", "❤️ Love"],
                ["insightful", "💡 Insightful"],
                ["funny", "😄 Funny"],
              ].map(([type, label]) => (
                <Chip
                  key={type}
                  label={label}
                  selected={reaction?.reaction_type === type}
                  disabled={react.isPending}
                  onPress={() => {
                    if (!react.isPending) react.mutate(type);
                  }}
                />
              ))}
            </View>
            {!!react.isError && (
              <Text accessibilityRole="alert" style={[s.text, styles.error]}>
                Impossible d’enregistrer la réaction. Réessayez.
              </Text>
            )}
            <Button title="Fermer" secondary onPress={() => setPicker(false)} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
});

export function PostReelsDetail({
  post,
  initialCommentsOpen = false,
}: {
  post: Post;
  initialCommentsOpen?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  const { session } = useAuth();
  const cache = useQueryClient();
  const [picker, setPicker] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen);
  const [likeBurst, setLikeBurst] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const playbackMemory = useMemo(
    () => ({
      current: { seconds: 0, seekRequest: null } as MediaPlaybackMemory,
    }),
    [post.id, post.video_url],
  );
  const [menuError, setMenuError] = useState(false);
  const [hideError, setHideError] = useState(false);
  const hiddenPosts = useHiddenPosts();
  const fallbackTrack = useMemo(() => getDefaultMusic(), []);
  const postMusic = post as Post & {
    music?: string | null;
    artist?: string | null;
    music_url?: string | null;
  };
  const reaction = post.post_reactions?.find(
    (r) => r.user_id === session?.user.id,
  );
  const react = useMutation({
    mutationFn: async (type: string) => {
      if (!session) throw new Error("Connectez-vous pour réagir.");
      const result =
        reaction?.reaction_type === type
          ? await supabase
              .from("post_reactions")
              .delete()
              .eq("id", reaction.id)
              .eq("user_id", session.user.id)
          : reaction
            ? await supabase
                .from("post_reactions")
                .update({ reaction_type: type })
                .eq("id", reaction.id)
                .eq("user_id", session.user.id)
            : await supabase.from("post_reactions").insert({
                post_id: post.id,
                user_id: session.user.id,
                reaction_type: type,
              });
      if (result.error) throw result.error;
      return (
        reaction?.reaction_type !== type && (type === "love" || type === "like")
      );
    },
    onSuccess: async (celebrate) => {
      if (celebrate) setLikeBurst((sequence) => sequence + 1);
      setPicker(false);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["posts"] }),
        cache.invalidateQueries({ queryKey: ["post", post.id] }),
        cache.invalidateQueries({ queryKey: ["short-likes", "post", post.id] }),
      ]);
    },
  });
  const reactionCount = post.post_reactions?.length || 0;
  const commentCount = post.post_comments?.[0]?.count || 0;
  const canEdit = session?.user.id === post.user_id;
  const musicUri = postMusic.music_url || fallbackTrack.audioUrl;
  if (hiddenPosts.ids.includes(post.id)) return null;
  return (
    <View style={styles.reelsDetailPage}>
      <ReelsPostDetail
        shareOpen={shareOpen}
        onShare={() => setShareOpen(true)}
        onCloseShare={() => setShareOpen(false)}
        likeBurst={likeBurst}
        post={post}
        visible={!commentsOpen}
        playbackMemory={playbackMemory}
        selected={!!reaction}
        pending={react.isPending}
        reactionCount={reactionCount}
        commentCount={commentCount}
        musicUri={musicUri}
        onClose={() => router.back()}
        onOpenMenu={() => setMenuOpen(true)}
        onOpenComments={() => setCommentsOpen(true)}
        onReact={() => react.mutate(reaction?.reaction_type || "love")}
        onChooseReaction={() => setPicker(true)}
      />
      <PostCommentsSheet
        key={`${session?.user.id ?? "guest"}:${post.id}`}
        post={post}
        open={commentsOpen}
        playbackMemory={playbackMemory}
        onClose={() => setCommentsOpen(false)}
      />
      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer le menu contextuel"
            onPress={() => setMenuOpen(false)}
            style={styles.sheetDismiss}
          />
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={() => setMenuOpen(false)}
            style={styles.contextSheet}
          >
            <View style={styles.sheetHandle} />
            {!!menuOpen && (
              <SavePost
                postId={post.id}
                labeled
                onSaved={() => setMenuOpen(false)}
              />
            )}
            <ContextMenuAction
              icon={<Share2 size={23} color={colors.ink} />}
              label="Partager"
              onPress={() => {
                setMenuOpen(false);
                setShareOpen(true);
              }}
            />
            <ContextMenuAction
              icon={<EyeOff size={23} color={colors.ink} />}
              label="Masquer ce contenu"
              onPress={() => {
                setHideError(false);
                void hiddenPosts
                  .hide(post.id)
                  .then(() => setMenuOpen(false))
                  .catch(() => setHideError(true));
              }}
            />
            <ContextMenuAction
              icon={<Flag size={23} color={colors.ink} />}
              label="Signaler"
              onPress={() => {
                setMenuOpen(false);
                router.push(contentReportPath(post.user_id, "post", post.id));
              }}
            />
            {!!(!canEdit && menuOpen) && (
              <UnfollowPostAuthor
                id={post.user_id}
                onDone={() => setMenuOpen(false)}
              />
            )}
            {!!hideError && (
              <Text accessibilityRole="alert" style={[s.small, styles.error]}>
                Impossible de masquer cette publication. Réessayez.
              </Text>
            )}
            {!!canEdit && (
              <>
                <View style={styles.contextDivider} />
                <ContextMenuAction
                  danger
                  icon={<Trash2 size={23} color={colors.danger} />}
                  label="Gérer ma publication"
                  onPress={() => {
                    setMenuOpen(false);
                    router.push(`/post/${post.id}/edit`);
                  }}
                />
              </>
            )}
            {!!menuError && (
              <Text accessibilityRole="alert" style={[s.small, styles.error]}>
                Le partage n’est pas disponible. Réessayez.
              </Text>
            )}
          </View>
        </View>
      </Modal>
      <Modal
        visible={picker}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer les réactions"
            onPress={() => setPicker(false)}
            style={styles.sheetDismiss}
          />
          <ScrollView
            accessibilityViewIsModal
            onAccessibilityEscape={() => setPicker(false)}
            style={styles.reactionScroll}
            contentContainerStyle={styles.reactionSheet}
          >
            <View style={styles.sheetHandle} />
            <Text accessibilityRole="header" style={s.h2}>
              Votre réaction
            </Text>
            <View style={[s.row, styles.reactionChoices]}>
              {[
                ["like", "👍 J’aime"],
                ["celebrate", "🎉 Celebrate"],
                ["support", "🤝 Support"],
                ["love", "❤️ Love"],
                ["insightful", "💡 Insightful"],
                ["funny", "😄 Funny"],
              ].map(([type, label]) => (
                <Chip
                  key={type}
                  label={label}
                  selected={reaction?.reaction_type === type}
                  disabled={react.isPending}
                  onPress={() => {
                    if (!react.isPending) react.mutate(type);
                  }}
                />
              ))}
            </View>
            {!!react.isError && (
              <Text accessibilityRole="alert" style={[s.text, styles.error]}>
                Impossible d’enregistrer la réaction. Réessayez.
              </Text>
            )}
            <Button title="Fermer" secondary onPress={() => setPicker(false)} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function formatShortCount(value: number) {
  if (value <= 0) return "";
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10} M`;
  if (value >= 1_000) return `${Math.round(value / 100) / 10} K`;
  return String(value);
}

function ReelsPostDetail({
  shareOpen,
  onShare,
  onCloseShare,
  likeBurst,
  playbackMemory,
  post,
  visible,
  selected,
  pending,
  reactionCount,
  commentCount,
  musicUri,
  onClose,
  onOpenMenu,
  onOpenComments,
  onReact,
  onChooseReaction,
}: {
  shareOpen: boolean;
  onShare: () => void;
  onCloseShare: () => void;
  post: Post;
  likeBurst: number;
  visible: boolean;
  playbackMemory: React.RefObject<MediaPlaybackMemory>;
  selected: boolean;
  pending: boolean;
  reactionCount: number;
  commentCount: number;
  musicUri: string;
  onClose: () => void;
  onOpenMenu: () => void;
  onOpenComments: () => void;
  onReact: () => void;
  onChooseReaction: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityViewIsModal
      onAccessibilityEscape={onClose}
      style={styles.reelsModal}
    >
      <PostMedia
        post={post}
        fullScreen
        visible={visible && !shareOpen}
        playbackMemory={playbackMemory}
        compact
        immersive
      />
      <View style={styles.reelsTopBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer la publication"
          onPress={onClose}
          style={styles.reelsTopAction}
        >
          <ArrowLeft size={28} color={colors.white} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.reelsTitle}>
          Reels
        </Text>
        <Text style={styles.reelsFriends}>Ami(e)s</Text>
      </View>
      <View style={styles.reelsActionRail}>
        <ReelsAction
          label={`J’aime. ${reactionCount} réactions.`}
          count={formatShortCount(reactionCount)}
          onPress={onReact}
          onLongPress={onChooseReaction}
          disabled={pending}
        >
          <Heart
            size={35}
            color={colors.white}
            fill={selected ? colors.magenta : "transparent"}
            strokeWidth={2}
          />
        </ReelsAction>
        <ReelsAction
          label={`${commentCount} commentaires. Ouvrir les commentaires.`}
          count={formatShortCount(commentCount)}
          onPress={onOpenComments}
        >
          <MessageCircle size={34} color={colors.white} strokeWidth={2} />
        </ReelsAction>
        <RepostButton postId={post.id} overlay />
        <ReelsAction label="Partager" count="" onPress={onShare}>
          <Send size={33} color={colors.white} strokeWidth={2} />
        </ReelsAction>
        <PostProfileAvatar
          post={post}
          size={34}
          overlay
          square
          onNavigate={onClose}
        />
      </View>
      <View
        style={[
          styles.reelsBottomInfo,
          { bottom: Math.max(66, insets.bottom + 62) },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          accessible={false}
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.52)", "rgba(0,0,0,0.76)"]}
          locations={[0, 0.45, 1]}
          style={[
            styles.captionShade,
            { bottom: -Math.max(66, insets.bottom + 62) },
          ]}
        />
        <View style={styles.reelsAuthorLine}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Voir le profil de ${displayName(post.author)}`}
            onPress={() => {
              onClose();
              router.push(`/profile/${post.user_id}`);
            }}
            style={[
              styles.reelsAuthorLine,
              { flex: 1, minWidth: 0, minHeight: 44 },
            ]}
          >
            <Avatar
              uri={post.author?.avatar_url}
              name={displayName(post.author)}
              size={38}
            />
            <Text numberOfLines={1} style={styles.reelsAuthorName}>
              {displayName(post.author)}
            </Text>
          </Pressable>
        </View>
        <PostTimestamp post={post} overlay />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lire la publication complète"
          onPress={() => {
            onClose();
            router.push(`/posts/${post.id}`);
          }}
        >
          <Text numberOfLines={2} style={styles.reelsCaption}>
            {post.content}
            {!!post.hashtags?.length && ` ${post.hashtags.join(" ")}`}
          </Text>
        </Pressable>
        <PostTranslation text={post.content} overlay />
      </View>
      <View
        style={[
          styles.soundtrackCorner,
          { bottom: Math.max(66, insets.bottom + 62) },
        ]}
      >
        <PostSoundtrack
          uri={musicUri}
          active={visible && !shareOpen}
          compact
          overlay
        />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "position" : undefined}
        style={[
          styles.inlineComposer,
          { bottom: Math.max(4, insets.bottom + 4) },
        ]}
      >
        <InlinePostComment postId={post.id} onNavigate={onClose} />
      </KeyboardAvoidingView>
      <LikeBurst sequence={likeBurst} active={visible && !shareOpen} />
      {shareOpen && (
        <PostShareSheet
          post={post}
          playbackMemory={playbackMemory}
          onClose={onCloseShare}
          onNavigate={onClose}
        />
      )}
    </View>
  );
}

function ReelsAction({
  label,
  count,
  disabled,
  onPress,
  onLongPress,
  children,
}: {
  label: string;
  count: string;
  disabled?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.reelsAction,
        { opacity: disabled ? 0.5 : pressed ? 0.68 : 1 },
      ]}
    >
      {children}
      {!!count && <Text style={styles.reelsActionCount}>{count}</Text>}
    </Pressable>
  );
}
function PostSoundtrack({
  uri,
  active,
  compact,
  overlay = false,
}: {
  uri: string;
  active: boolean;
  compact: boolean;
  overlay?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { player, status } = useSoundtrackPlayer(uri);
  const calls = useCalls();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    React.useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [muted, setMuted] = useMediaSound();
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const allowed = active && foreground && focused && !calls.busy;
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setForeground(state !== "background" && state !== "inactive"),
    );
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!player) return;
    player.loop = true;
    player.volume = 0.5;
    player.muted = muted;
    if (!allowed || muted) {
      player.pause();
      return;
    }
    void player.play().catch(() => {});
    return () => player.pause();
  }, [allowed, muted, player]);
  useEffect(() => {
    if (!player || !allowed) return;
    return registerSoundActivation(() => {
      player.muted = false;
      void player.play().catch(() => {});
    });
  }, [player, allowed]);
  const audible = !muted && status.playing && !status.blocked && !status.failed;
  return (
    <Pressable
      accessibilityRole="button"
      testID="post-sound-control"
      accessibilityLabel={
        audible
          ? "Couper la musique"
          : status.failed
            ? "Réessayer la musique"
            : "Activer la musique"
      }
      accessibilityState={{ selected: audible }}
      onPress={() => setMuted(audible)}
      style={({ pressed }) => [
        styles.soundtrack,
        compact ? styles.compactSoundtrack : undefined,
        overlay ? styles.overlaySoundtrack : undefined,
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      {!audible ? (
        <VolumeX size={20} color={overlay ? colors.white : colors.muted} />
      ) : (
        <Volume2 size={20} color={overlay ? colors.white : colors.deepBlue} />
      )}
    </Pressable>
  );
}

function ContextMenuAction({
  icon,
  label,
  danger = false,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.contextAction,
        { opacity: pressed ? 0.62 : 1 },
      ]}
    >
      <View style={styles.contextIcon}>{icon}</View>
      <Text
        style={[
          styles.contextLabel,
          danger ? { color: colors.danger } : undefined,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function authorMetadata(post: Post) {
  return (
    [post.author?.position, post.author?.club].filter(Boolean).join(" · ") ||
    "Communauté FootNation"
  );
}
function postDate(post: Post, full = false) {
  return formatPublicationDate(post.created_at, full);
}

function PostTimestamp({
  post,
  overlay = false,
}: {
  post: Post;
  overlay?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 60_000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  return (
    <Text
      accessibilityLabel={`Publié le ${postDate(post, true)}`}
      style={[
        styles.metadata,
        overlay && styles.overlayMutedText,
        overlay && styles.authorTextShadow,
      ]}
    >
      {formatPublicationDate(post.created_at, false, now)}
    </Text>
  );
}

function PostProfileAvatar({
  post,
  size,
  overlay = false,
  square = false,
  onNavigate,
}: {
  post: Post;
  size: number;
  overlay?: boolean;
  square?: boolean;
  onNavigate?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={{ flexShrink: 0, paddingBottom: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Voir le profil de ${displayName(post.author)}`}
        onPress={() => {
          onNavigate?.();
          router.push(`/profile/${post.user_id}`);
        }}
        style={({ pressed }) => [
          square ? styles.reelsMiniAvatar : styles.avatarRing,
          !square && overlay && styles.overlayAvatarRing,
          { opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <Avatar
          uri={post.author?.avatar_url}
          name={displayName(post.author)}
          size={size}
        />
      </Pressable>
      <FollowAuthor
        id={post.user_id}
        name={displayName(post.author)}
        variant="badge"
        onNavigate={onNavigate}
      />
    </View>
  );
}

function PostAuthor({
  post,
  compact,
  fontScale,
  onBackToFeed,
  onOpenMenu,
  overlay = false,
}: {
  post: Post;
  compact: boolean;
  fontScale: number;
  canEdit: boolean;
  onBackToFeed?: () => void;
  onOpenMenu: () => void;
  overlay?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  return (
    <View
      style={[
        styles.header,
        compact ? styles.compactHeader : undefined,
        overlay ? styles.overlayHeader : undefined,
      ]}
    >
      {!!onBackToFeed && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour au fil, aux stories et à la recherche"
          onPress={onBackToFeed}
          style={styles.action}
        >
          <ArrowLeft size={22} color={overlay ? colors.white : colors.ink} />
        </Pressable>
      )}
      <View style={styles.author}>
        <PostProfileAvatar
          post={post}
          size={compact ? 32 : 38}
          overlay={overlay}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Voir le profil de ${displayName(post.author)}. ${authorMetadata(post)}. Publié le ${postDate(post, true)}`}
          onPress={() => router.push(`/profile/${post.user_id}`)}
          style={({ pressed }) => [
            styles.authorCopy,
            {
              minHeight: 44,
              justifyContent: "center",
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              s.h2,
              styles.authorName,
              overlay ? styles.overlayText : undefined,
              overlay ? styles.authorTextShadow : undefined,
            ]}
          >
            {displayName(post.author)}
          </Text>
          <View style={styles.authorMetadataRow}>
            {!!(!compact || fontScale < 1.7) && (
              <Text
                numberOfLines={1}
                style={[
                  s.small,
                  styles.metadata,
                  overlay ? styles.overlayMutedText : undefined,
                  overlay ? styles.authorTextShadow : undefined,
                ]}
              >
                {authorMetadata(post)} ·
              </Text>
            )}
            <PostTimestamp post={post} overlay={overlay} />
          </View>
          {!!post.repost && (
            <Text
              numberOfLines={1}
              style={[
                s.small,
                styles.metadata,
                overlay && styles.overlayMutedText,
                overlay && styles.authorTextShadow,
              ]}
            >
              ↻ Republié par {post.repost.name}
            </Text>
          )}
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir le menu de la publication"
        onPress={onOpenMenu}
        style={({ pressed }) => [
          styles.action,
          { opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <MoreHorizontal
          size={24}
          color={overlay ? colors.white : colors.ink}
          strokeWidth={1.9}
        />
      </Pressable>
    </View>
  );
}

function PostCaption({
  post,
  compact,
  expanded,
  onPress,
  overlay = false,
}: {
  post: Post;
  compact: boolean;
  expanded: boolean;
  onPress: () => void;
  overlay?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  return (
    <View
      style={[
        styles.caption,
        compact ? styles.compactCaption : undefined,
        overlay ? styles.overlayCaption : undefined,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lire le texte complet et les hashtags de la publication"
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={styles.captionPressable}
      >
        <Text
          numberOfLines={expanded ? undefined : compact ? 1 : 3}
          style={[
            s.text,
            styles.captionText,
            compact ? styles.compactCaptionText : undefined,
            overlay ? styles.overlayText : undefined,
          ]}
        >
          {post.content}
          {!!post.hashtags?.length && (
            <Text style={styles.hashtags}> {post.hashtags.join(" ")}</Text>
          )}
        </Text>
        <Text
          style={[
            s.small,
            styles.readLink,
            overlay ? styles.overlayMutedText : undefined,
          ]}
        >
          {expanded ? "Moins" : "Lire"}
        </Text>
      </Pressable>
      <PostTranslation text={post.content} overlay={overlay} />
    </View>
  );
}

function PostText({
  post,
  fullScreen,
  compact,
  expanded,
  fontScale,
  onPress,
}: {
  post: Post;
  fullScreen: boolean;
  compact: boolean;
  expanded: boolean;
  fontScale: number;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  const [height, setHeight] = useState(0);
  const lines = Math.max(
    1,
    Math.min(12, Math.floor((height - (compact ? 16 : 69)) / (27 * fontScale))),
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Lire la publication complète"
      accessibilityState={{ expanded: !fullScreen && expanded }}
      onPress={onPress}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.height;
        setHeight((current) => (Math.abs(current - next) > 1 ? next : current));
      }}
      style={[
        styles.textStage,
        fullScreen ? styles.flexBody : undefined,
        compact ? styles.compactTextStage : undefined,
      ]}
    >
      {!compact && <View style={styles.textAccent} />}
      <Text
        numberOfLines={fullScreen ? lines : expanded ? undefined : 7}
        style={[s.text, styles.textContent]}
      >
        {post.content}
        {!!post.hashtags?.length && (
          <Text style={styles.hashtags}> {post.hashtags.join(" ")}</Text>
        )}
      </Text>
      <PostTranslation text={post.content} />
    </Pressable>
  );
}

function PostMedia({
  playbackMemory,
  post,
  fullScreen,
  visible,
  compact,
  immersive = false,
}: {
  post: Post;
  fullScreen: boolean;
  visible: boolean;
  compact: boolean;
  immersive?: boolean;
  playbackMemory?: React.RefObject<MediaPlaybackMemory>;
}) {
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  const [imageFailed, setImageFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const showImage = !!post.image_url && (!fullScreen || !post.video_url);
  return (
    <View
      style={[
        styles.mediaStage,
        fullScreen ? styles.flexBody : undefined,
        immersive ? styles.immersiveMediaStage : undefined,
      ]}
    >
      {!!showImage && (
        <Image
          key={`${post.image_url}:${attempt}`}
          source={{ uri: post.image_url! }}
          contentFit={immersive ? "cover" : "contain"}
          accessibilityLabel={`Photo publiée par ${displayName(post.author)}`}
          onError={() => setImageFailed(true)}
          onLoad={() => setImageFailed(false)}
          style={fullScreen ? styles.mediaFill : styles.imageMedia}
        />
      )}
      {!!post.video_url && (
        <NativeVideo
          uri={post.video_url}
          playbackMemory={playbackMemory}
          posterUri={post.image_url}
          active={fullScreen ? visible : undefined}
          volume={fullScreen ? 0 : 1}
          visible={visible}
          style={fullScreen ? styles.mediaFill : styles.videoMedia}
          contentFit={immersive ? "cover" : "contain"}
          controls={!fullScreen}
        />
      )}
      {!!(showImage && imageFailed) && (
        <View style={styles.imageError}>
          <Text
            accessibilityRole="alert"
            numberOfLines={compact ? 1 : 3}
            style={[s.small, styles.imageErrorText]}
          >
            Cette photo n’est pas disponible pour le moment.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Réessayer de charger la photo"
            onPress={() => {
              setImageFailed(false);
              setAttempt((value) => value + 1);
            }}
            style={styles.retry}
          >
            <Text style={[s.small, styles.retryText]}>Réessayer</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function PostCommentsSheet({
  playbackMemory,
  post,
  open,
  onClose,
}: {
  post: Post;
  open: boolean;
  playbackMemory: React.RefObject<MediaPlaybackMemory>;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { session, profile, profileStatus } = useAuth();
  const cache = useQueryClient();
  const [draft, setDraft] = usePostCommentDraft(session?.user.id, post.id);
  const [previewMuted, setPreviewMuted] = useState(true);
  const insets = useSafeAreaInsets();
  const hasVideo = !!post.video_url;
  const comments = useInfiniteQuery({
    queryKey: ["comments", post.id],
    enabled: open,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("post_comments")
        .select(
          "id,content,created_at,user_id,author:profiles!post_comments_user_id_fkey(id,full_name,username,avatar_url)",
        )
        .eq("post_id", post.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (error) throw error;
      return data as unknown as {
        id: string;
        content: string;
        created_at: string;
        user_id: string;
        author: Profile;
      }[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const sendComment = useMutation({
    mutationFn: (content: string) =>
      publishPostComment(supabase, {
        postId: post.id,
        userId: session?.user.id,
        content,
      }),
    onSuccess: async (_, submitted) => {
      setDraft((current) => (current === submitted ? "" : current));
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["comments", post.id] }),
        cache.invalidateQueries({ queryKey: ["posts"] }),
        cache.invalidateQueries({ queryKey: ["post", post.id] }),
        cache.invalidateQueries({
          queryKey: ["short-comments-count", "post", post.id],
        }),
      ]);
    },
  });
  const recovery =
    sendComment.error instanceof PostCommentError
      ? sendComment.error.recovery
      : !session
        ? "login"
        : profileStatus === "missing"
          ? "profile"
          : null;
  const recover = () => {
    onClose();
    router.push({
      pathname: recovery === "login" ? "/login" : "/profile-setup",
      params: { next: `/posts/${post.id}?comments=1` },
    });
  };
  const allComments = comments.data?.pages.flat() ?? [];
  const emojiRow = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.commentsOverlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer les commentaires"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.commentsKeyboard, { paddingTop: insets.top }]}
        >
          {!!open && (
            <View style={styles.commentPreviewStage}>
              <View
                style={[
                  styles.commentPreviewFrame,
                  !hasVideo && !post.image_url && styles.commentTextPreview,
                ]}
              >
                {hasVideo ? (
                  <NativeVideo
                    uri={post.video_url!}
                    posterUri={post.image_url}
                    playbackMemory={playbackMemory}
                    active
                    muted={previewMuted}
                    controls={false}
                    contentFit="contain"
                    style={[
                      StyleSheet.absoluteFill,
                      { width: "100%", height: "100%", aspectRatio: undefined },
                    ]}
                  />
                ) : post.image_url ? (
                  <Image
                    source={{ uri: post.image_url }}
                    contentFit="contain"
                    accessibilityLabel={`Photo publiée par ${displayName(post.author)}`}
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <>
                    <Text numberOfLines={1} style={styles.commentPreviewAuthor}>
                      {displayName(post.author)}
                    </Text>
                    <ScrollView style={styles.commentPreviewTextScroll}>
                      <Text selectable style={styles.commentPreviewText}>
                        {post.content || "Publication"}
                        {!!post.hashtags?.length &&
                          `\n${post.hashtags.join(" ")}`}
                      </Text>
                    </ScrollView>
                  </>
                )}
              </View>
              {!!hasVideo && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    previewMuted
                      ? "Activer le son de la vidéo"
                      : "Couper le son de la vidéo"
                  }
                  onPress={() => setPreviewMuted((value) => !value)}
                  style={styles.commentVideoSound}
                >
                  {previewMuted ? (
                    <VolumeX size={20} color="#FFFFFF" />
                  ) : (
                    <Volume2 size={20} color="#FFFFFF" />
                  )}
                </Pressable>
              )}
            </View>
          )}
          <View
            accessibilityViewIsModal
            style={[styles.commentsSheet, { paddingBottom: insets.bottom }]}
          >
            <View style={styles.commentsHandle} />
            <View style={styles.commentsHeaderRow}>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={styles.commentsHeaderChoice}
              >
                <Text style={styles.commentsHeaderTitle}>Pour vous</Text>
                <Text style={styles.commentsHeaderChevron}>⌄</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={onClose}
                style={styles.commentsCloseAction}
              >
                <X size={22} color={colors.white} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.commentsList}
              contentContainerStyle={styles.commentsListContent}
              keyboardShouldPersistTaps="handled"
            >
              {comments.isPending ? (
                <Text style={styles.commentsMuted}>
                  Chargement des commentaires…
                </Text>
              ) : comments.isError ? (
                <Text accessibilityRole="alert" style={styles.commentsMuted}>
                  Impossible de charger les commentaires.
                </Text>
              ) : allComments.length ? (
                allComments.map((comment) => (
                  <View key={comment.id} style={styles.commentRowDark}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Voir le profil de ${displayName(comment.author)}`}
                      onPress={() => {
                        onClose();
                        router.push(`/profile/${comment.user_id}`);
                      }}
                    >
                      <Avatar
                        uri={comment.author?.avatar_url}
                        name={displayName(comment.author)}
                        size={42}
                      />
                    </Pressable>
                    <View style={styles.commentBodyDark}>
                      <Text style={styles.commentNameDark}>
                        {displayName(comment.author)}{" "}
                        <Text style={styles.commentAgeDark}>
                          {new Date(comment.created_at).toLocaleDateString(
                            "fr-FR",
                            { day: "numeric", month: "short" },
                          )}
                        </Text>
                      </Text>
                      <Text style={styles.commentTextDark}>
                        {comment.content}
                      </Text>
                      <CommentActions
                        key={`${session?.user.id ?? "guest"}:${comment.id}`}
                        comment={comment}
                        postId={post.id}
                        dark
                      />
                      <View style={styles.commentMetaRowDark}>
                        <Text style={styles.commentMetaDark}>Répondre</Text>
                        <Text style={styles.commentMetaDark}>
                          Voir la traduction
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Aimer ce commentaire"
                      style={styles.commentLikeDark}
                    >
                      <Heart size={22} color="#AEB6C2" strokeWidth={2} />
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text style={styles.commentsMuted}>
                  Sois le premier à commenter.
                </Text>
              )}
              {!!comments.hasNextPage && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void comments.fetchNextPage()}
                  style={styles.commentsMoreButton}
                >
                  <Text style={styles.commentsMoreText}>
                    Voir plus de commentaires
                  </Text>
                </Pressable>
              )}
            </ScrollView>
            <View style={styles.commentComposerPanel}>
              <View style={styles.commentEmojiRow}>
                {emojiRow.map((emoji) => (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={`Ajouter ${emoji}`}
                    onPress={() => setDraft((value) => `${value}${emoji}`)}
                    style={styles.commentEmojiButton}
                  >
                    <Text style={styles.commentEmoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.commentInputRowDark}>
                <Avatar
                  uri={profile?.avatar_url}
                  name={displayName(profile)}
                  size={44}
                />
                <View style={styles.commentInputPillDark}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={`Ajoutez un commentaire pour ${displayName(post.author).split(" ")[0] || "ce profil"}…`}
                    placeholderTextColor="#8E98A6"
                    multiline
                    maxLength={3000}
                    style={styles.commentTextInputDark}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Publier le commentaire"
                    disabled={!draft.trim() || sendComment.isPending}
                    onPress={() => sendComment.mutate(draft)}
                    style={({ pressed }) => [
                      styles.commentSendButtonDark,
                      {
                        opacity:
                          !draft.trim() || sendComment.isPending
                            ? 0.35
                            : pressed
                              ? 0.65
                              : 1,
                      },
                    ]}
                  >
                    <Send size={18} color={colors.white} />
                  </Pressable>
                </View>
              </View>
              {!!sendComment.isError && (
                <Text accessibilityRole="alert" style={styles.commentErrorDark}>
                  {sendComment.error.message}
                </Text>
              )}
              {!!(recovery === "login" || recovery === "profile") && (
                <View style={{ gap: 8 }}>
                  {!sendComment.isError && (
                    <Text style={styles.commentErrorDark}>
                      {recovery === "profile"
                        ? "Enregistrez votre profil pour commenter. Votre texte est conservé."
                        : "Connectez-vous pour commenter."}
                    </Text>
                  )}
                  <Button
                    title={
                      recovery === "profile"
                        ? "Compléter mon profil"
                        : "Se reconnecter"
                    }
                    onPress={recover}
                  />
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function PostActions({
  postId,
  selected,
  pending,
  compact,
  reactionCount,
  commentCount,
  onReact,
  onChooseReaction,
  onOpenComments,
  onShare,
}: {
  postId: string;
  selected: boolean;
  pending: boolean;
  compact: boolean;
  reactionCount: number;
  commentCount: number;
  onReact: () => void;
  onChooseReaction: () => void;
  onOpenComments?: () => void;
  onShare: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  return (
    <View>
      <View style={styles.actions}>
        <View style={styles.actionGroup}>
          <Pressable
            accessibilityLabel={`J’aime. ${reactionCount} réaction${reactionCount === 1 ? "" : "s"}.`}
            accessibilityHint="Maintenez pour choisir une autre réaction."
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: pending }}
            accessibilityActions={[
              { name: "longpress", label: "Choisir une réaction" },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === "longpress" && !pending)
                onChooseReaction();
            }}
            disabled={pending}
            onLongPress={onChooseReaction}
            onPress={onReact}
            style={({ pressed }) => [
              styles.action,
              compact ? styles.compactAction : undefined,
              { opacity: pending ? 0.45 : pressed ? 0.65 : 1 },
            ]}
          >
            <Heart
              size={27}
              color={selected ? colors.magenta : colors.ink}
              fill={selected ? colors.magenta : "transparent"}
              strokeWidth={1.8}
            />
            {!!(compact && reactionCount > 0) && (
              <Text style={[s.small, styles.compactCount]}>
                {reactionCount}
              </Text>
            )}
          </Pressable>
          <Pressable
            accessibilityLabel={`${commentCount} commentaire${commentCount === 1 ? "" : "s"}. Ouvrir les commentaires.`}
            accessibilityRole="button"
            onPress={() => {
              if (onOpenComments) onOpenComments();
              else router.push(`/posts/${postId}`);
            }}
            style={({ pressed }) => [
              styles.action,
              compact ? styles.compactAction : undefined,
              { opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <MessageCircle size={26} color={colors.ink} strokeWidth={1.8} />
            {!!(compact && commentCount > 0) && (
              <Text style={[s.small, styles.compactCount]}>{commentCount}</Text>
            )}
          </Pressable>
          <RepostButton postId={postId} />
          <Pressable
            accessibilityLabel="Partager"
            accessibilityRole="button"
            onPress={onShare}
            style={({ pressed }) => [
              styles.action,
              { opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Send size={25} color={colors.ink} strokeWidth={1.8} />
          </Pressable>
        </View>
        <SavePost postId={postId} />
      </View>
    </View>
  );
}

function PostStats({
  reactionCount,
  commentCount,
  postId,
  onChooseReaction,
  onOpenComments,
}: {
  reactionCount: number;
  commentCount: number;
  postId: string;
  onChooseReaction: () => void;
  onOpenComments?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const s = useUIStyles();
  if (!reactionCount && !commentCount) return null;
  return (
    <View style={styles.stats}>
      {reactionCount > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${reactionCount} réactions. Choisir une réaction.`}
          onPress={onChooseReaction}
          style={styles.statAction}
        >
          <Text numberOfLines={1} style={[s.small, styles.reactionCount]}>
            {reactionCount} réaction{reactionCount === 1 ? "" : "s"}
          </Text>
        </Pressable>
      )}
      {commentCount > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${commentCount} commentaires. Ouvrir les commentaires.`}
          onPress={() => {
            if (onOpenComments) onOpenComments();
            else router.push(`/posts/${postId}`);
          }}
          style={styles.statAction}
        >
          <Text numberOfLines={1} style={[s.small, styles.metadata]}>
            {commentCount} commentaire{commentCount === 1 ? "" : "s"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    page: {
      paddingHorizontal: 0,
      paddingTop: 0,
      flexShrink: 0,
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    listItem: { paddingBottom: 12, backgroundColor: colors.background },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      overflow: "hidden",
    },
    pageCard: { flex: 1, minHeight: 0, borderWidth: 0, borderRadius: 0 },
    immersiveTextStage: {
      flex: 1,
      backgroundColor: "#07182E",
      justifyContent: "center",
      paddingHorizontal: 28,
      paddingTop: 90,
      paddingBottom: 270,
    },
    immersiveTextContent: {
      color: "#FFFFFF",
      fontSize: 28,
      lineHeight: 38,
      fontWeight: "700",
    },
    immersiveHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 5,
      paddingTop: 8,
    },
    authorTopShade: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: -64,
    },
    authorTextShadow: {
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    immersiveBottom: {
      position: "absolute",
      left: 0,
      right: 0,
      zIndex: 5,
      paddingHorizontal: 10,
      gap: 6,
    },
    immersiveFooter: {
      borderRadius: 24,
      backgroundColor: "rgba(255,255,255,0.9)",
      paddingHorizontal: 8,
      paddingVertical: 2,
      shadowColor: "#000000",
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    immersiveOpenTarget: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 3,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    compactHeader: { paddingVertical: 4, paddingHorizontal: 8, gap: 5 },
    overlayHeader: { backgroundColor: "transparent" },
    author: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    authorCopy: { flex: 1, minWidth: 0, gap: 1 },
    authorMetadataRow: { flexDirection: "row", flexWrap: "wrap", columnGap: 4 },
    authorName: {
      fontFamily: "Inter-SemiBold",
      color: colors.ink,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
    },
    avatarRing: {
      padding: 2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 24,
      backgroundColor: colors.surfaceRaised,
    },
    overlayAvatarRing: {
      borderColor: "rgba(255,255,255,0.85)",
      backgroundColor: "rgba(255,255,255,0.22)",
    },
    overlayText: { color: colors.white },
    overlayMutedText: { color: "rgba(255,255,255,0.86)" },
    metadata: {
      color: colors.muted,
      fontSize: 11,
      lineHeight: 16,
      fontFamily: "Inter-Regular",
    },
    caption: {
      minHeight: 44,
      paddingHorizontal: 16,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    captionPressable: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    compactCaption: { paddingHorizontal: 12, paddingBottom: 4 },
    overlayCaption: {
      minHeight: 0,
      paddingHorizontal: 4,
      paddingBottom: 0,
      alignItems: "flex-end",
    },
    captionText: {
      color: colors.ink,
      fontSize: 14,
      lineHeight: 21,
      flex: 1,
      fontFamily: "Inter-Regular",
    },
    compactCaptionText: { fontSize: 13, lineHeight: 18 },
    hashtags: { color: colors.deepBlue },
    readLink: {
      fontFamily: "Inter-SemiBold",
      color: colors.deepBlue,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
    },
    readAction: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    mediaStage: {
      width: "100%",
      backgroundColor: colors.surfaceRaised,
      overflow: "hidden",
      position: "relative",
    },
    immersiveMediaStage: { backgroundColor: "#000000" },
    flexBody: { flex: 1, minHeight: 44 },
    mediaFill: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: "100%",
      height: "100%",
      aspectRatio: undefined,
    },
    imageMedia: {
      width: "100%",
      aspectRatio: 4 / 5,
      backgroundColor: colors.surfaceRaised,
    },
    videoMedia: { width: "100%", aspectRatio: 9 / 16 },
    imageError: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    imageErrorText: { color: colors.muted, flexShrink: 1 },
    retry: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: 10,
      justifyContent: "center",
    },
    retryText: { color: colors.deepBlue, fontWeight: "600" },
    textStage: {
      minHeight: 120,
      paddingHorizontal: 20,
      paddingTop: 32,
      paddingBottom: 24,
      justifyContent: "flex-start",
      backgroundColor: colors.accentSoft,
      overflow: "hidden",
    },
    compactTextStage: { paddingTop: 8, paddingBottom: 8 },
    textAccent: {
      width: 32,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.blue,
      marginBottom: 10,
    },
    textContent: {
      fontFamily: "Inter-Medium",
      color: colors.ink,
      fontSize: 19,
      lineHeight: 27,
      fontWeight: "500",
    },
    soundtrack: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.surfaceRaised,
    },
    compactSoundtrack: { flexShrink: 0 },
    overlaySoundtrack: {
      backgroundColor: "rgba(0,0,0,0.3)",
    },
    soundtrackCorner: {
      position: "absolute",
      right: 17,
      zIndex: 9,
    },
    footer: {
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 4,
      backgroundColor: colors.surface,
    },
    compactFooter: { paddingHorizontal: 8, paddingTop: 2, paddingBottom: 2 },
    footerRow: { flexDirection: "row", alignItems: "center" },
    actionsSlot: { flex: 1 },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    actionGroup: { flexDirection: "row", alignItems: "center", gap: 5 },
    compactAction: { flexDirection: "row", gap: 3, paddingHorizontal: 3 },
    action: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    compactCount: {
      fontFamily: "Inter-SemiBold",
      color: colors.muted,
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "600",
    },
    stats: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    statAction: {
      minHeight: 44,
      minWidth: 44,
      flexShrink: 1,
      justifyContent: "center",
    },
    reactionCount: {
      fontFamily: "Inter-SemiBold",
      color: colors.ink,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
    },
    error: { color: colors.danger, paddingHorizontal: 4, paddingBottom: 6 },

    reelsDetailPage: {
      flex: 1,
      minHeight: "100%",
      backgroundColor: "#000000",
    },
    reelsModal: {
      flex: 1,
      backgroundColor: "#000000",
    },
    reelsTopBar: {
      position: "absolute",
      top: 42,
      left: 14,
      right: 14,
      zIndex: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    reelsTopAction: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
    },
    reelsTitle: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 27,
      lineHeight: 34,
      fontWeight: "800",
    },
    reelsFriends: {
      color: "rgba(255,255,255,0.72)",
      fontFamily: "Inter-Bold",
      fontSize: 24,
      lineHeight: 32,
      fontWeight: "800",
    },
    inlineComposer: {
      position: "absolute",
      left: 16,
      right: 16,
      zIndex: 12,
    },
    reelsActionRail: {
      position: "absolute",
      right: 13,
      bottom: 142,
      zIndex: 9,
      alignItems: "center",
      gap: 10,
    },
    reelsAction: {
      minWidth: 52,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    reelsActionCount: {
      color: colors.white,
      fontFamily: "Inter-SemiBold",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
      textShadowColor: "rgba(0,0,0,0.55)",
      textShadowRadius: 5,
    },
    reelsMiniAvatar: {
      padding: 2,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.7)",
      backgroundColor: "rgba(0,0,0,0.2)",
    },
    reelsBottomInfo: {
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
    },
    reelsAuthorLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    reelsAuthorName: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "800",
      flexShrink: 1,
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowRadius: 6,
    },
    reelsFollowButton: {
      minHeight: 32,
      paddingHorizontal: 13,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.78)",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    reelsFollowText: {
      color: colors.white,
      fontFamily: "Inter-SemiBold",
      fontSize: 13,
      fontWeight: "700",
    },
    reelsCaption: {
      color: colors.white,
      fontFamily: "Inter-Regular",
      fontSize: 14,
      lineHeight: 20,
      textShadowColor: "rgba(0,0,0,0.65)",
      textShadowRadius: 5,
    },
    reelsError: {
      color: colors.white,
      fontFamily: "Inter-SemiBold",
      fontSize: 12,
    },
    commentsOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "#000000",
    },
    commentsKeyboard: {
      flex: 1,
      width: "100%",
      maxWidth: 600,
      alignSelf: "center",
      justifyContent: "flex-end",
    },
    commentPreviewStage: {
      flex: 0.35,
      minHeight: 72,
      maxHeight: 240,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },
    commentPreviewFrame: {
      width: "62%",
      maxWidth: 250,
      height: "100%",
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: "#000000",
    },
    commentTextPreview: {
      width: "86%",
      maxWidth: 420,
      padding: 16,
      gap: 10,
      backgroundColor: "#101D2C",
    },
    commentPreviewAuthor: {
      color: "#AEB6C2",
      fontFamily: "Inter-SemiBold",
      fontSize: 12,
      lineHeight: 18,
    },
    commentPreviewTextScroll: { flex: 1, minHeight: 0 },
    commentPreviewText: {
      color: "#FFFFFF",
      fontFamily: "Inter-SemiBold",
      fontSize: 15,
      lineHeight: 22,
    },
    commentVideoSound: {
      position: "absolute",
      right: 16,
      bottom: 12,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#252B30",
    },
    commentsSheet: {
      flex: 0.65,
      minHeight: 0,
      backgroundColor: "#151A1F",
      borderTopLeftRadius: 34,
      borderTopRightRadius: 34,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.08)",
    },
    commentsHandle: {
      alignSelf: "center",
      width: 80,
      height: 5,
      borderRadius: 999,
      backgroundColor: "#A7B0BA",
      opacity: 0.9,
      marginTop: 14,
      marginBottom: 20,
    },
    commentsHeaderRow: {
      minHeight: 44,
      paddingHorizontal: 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    commentsHeaderChoice: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    commentsHeaderTitle: {
      color: "#AEB6C2",
      fontFamily: "Inter-Bold",
      fontSize: 20,
      lineHeight: 26,
    },
    commentsHeaderChevron: {
      color: "#AEB6C2",
      fontFamily: "Inter-Bold",
      fontSize: 24,
      lineHeight: 26,
    },
    commentsCloseAction: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.07)",
    },
    commentsList: { flex: 1 },
    commentsListContent: {
      paddingHorizontal: 22,
      paddingTop: 16,
      paddingBottom: 18,
      gap: 22,
    },
    commentsMuted: {
      color: "#AEB6C2",
      fontFamily: "Inter-SemiBold",
      fontSize: 16,
      lineHeight: 22,
      textAlign: "center",
      paddingVertical: 28,
    },
    commentRowDark: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      minHeight: 54,
    },
    commentBodyDark: { flex: 1, minWidth: 0, gap: 4 },
    commentNameDark: {
      color: colors.white,
      fontFamily: "Inter-Bold",
      fontSize: 16,
      lineHeight: 21,
    },
    commentAgeDark: {
      color: "#AEB6C2",
      fontFamily: "Inter-SemiBold",
      fontSize: 14,
    },
    commentTextDark: {
      color: colors.white,
      fontFamily: "Inter-Regular",
      fontSize: 17,
      lineHeight: 23,
    },
    commentMetaRowDark: {
      flexDirection: "row",
      alignItems: "center",
      gap: 24,
      paddingTop: 4,
    },
    commentMetaDark: {
      color: "#AEB6C2",
      fontFamily: "Inter-Bold",
      fontSize: 15,
      lineHeight: 20,
    },
    commentLikeDark: {
      width: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    commentsMoreButton: {
      alignSelf: "flex-start",
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 54,
    },
    commentsMoreText: {
      color: "#AEB6C2",
      fontFamily: "Inter-Bold",
      fontSize: 16,
    },
    commentComposerPanel: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "rgba(255,255,255,0.1)",
      paddingTop: 14,
      paddingHorizontal: 22,
      paddingBottom: 20,
      gap: 14,
      backgroundColor: "#151A1F",
    },
    commentEmojiRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    commentEmojiButton: {
      minWidth: 36,
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    commentEmoji: { fontSize: 29, lineHeight: 34 },
    commentInputRowDark: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    commentInputPillDark: {
      flex: 1,
      minHeight: 54,
      borderRadius: 27,
      borderWidth: 1.3,
      borderColor: "#2B333D",
      backgroundColor: "#11161B",
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 18,
      paddingRight: 8,
    },
    commentTextInputDark: {
      flex: 1,
      minHeight: 44,
      maxHeight: 94,
      color: colors.white,
      fontFamily: "Inter-Regular",
      fontSize: 17,
      lineHeight: 22,
      paddingVertical: 10,
      outlineStyle: "none" as never,
    },
    commentSendButtonDark: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#087CFF",
    },
    commentErrorDark: {
      color: "#FF7D88",
      fontFamily: "Inter-SemiBold",
      fontSize: 13,
      lineHeight: 18,
    },
    sheetBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "#00000088",
    },
    sheetDismiss: { flex: 1, minHeight: 44 },
    detailsSheet: {
      maxHeight: "85%",
      flexShrink: 1,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      paddingBottom: 24,
    },
    sheetTitleRow: {
      paddingLeft: 22,
      paddingRight: 12,
      paddingTop: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    sheetTitle: { flex: 1, fontFamily: "Inter-Bold" },
    sheetScroll: { flexShrink: 1 },
    detailsContent: { padding: 22, paddingBottom: 24, gap: 14 },
    detailsAuthor: {
      color: colors.ink,
      fontSize: 17,
      lineHeight: 24,
      fontFamily: "Inter-SemiBold",
    },
    detailsText: {
      color: colors.ink,
      fontSize: 17,
      lineHeight: 26,
      fontFamily: "Inter-Regular",
    },
    detailsImage: {
      width: "100%",
      height: 300,
      borderRadius: 14,
      backgroundColor: colors.surfaceRaised,
    },
    contextSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 34,
      gap: 2,
    },
    contextAction: {
      minHeight: 58,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      paddingHorizontal: 14,
    },
    contextIcon: {
      width: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    contextLabel: {
      color: colors.ink,
      fontFamily: "Inter-Bold",
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "800",
    },
    contextDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    reactionScroll: {
      maxHeight: "80%",
      flexGrow: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    reactionSheet: { padding: 24, paddingBottom: 40, gap: 20 },
    reactionChoices: { flexWrap: "wrap" },
    sheetHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
  });
