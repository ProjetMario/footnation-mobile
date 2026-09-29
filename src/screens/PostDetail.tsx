import { PostCommentError, publishPostComment } from "../lib/postComments";
import { usePostCommentDraft } from "../lib/usePostCommentDraft";
import React from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Post, Profile } from "../lib/models";
import { displayName } from "../lib/models";
import {
  Avatar,
  Button,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { CommentActions } from "../components/CommentActions";
import { PostCard, PostReelsDetail } from "../components/PostCard";
import { AuthGate } from "../components/AuthGate";
import { useTheme } from "../theme";
export default function PostDetail() {
  const { colors } = useTheme();
  const s = useUIStyles();

  const { id, comments: openComments } = useLocalSearchParams<{
    id: string;
    comments?: string;
  }>();
  const { session } = useAuth();
  const cache = useQueryClient();
  const [comment, setComment] = usePostCommentDraft(session?.user.id, id);
  const post = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "*,author:profiles!posts_user_id_fkey(id,full_name,username,avatar_url),post_comments(count),post_reactions(id,user_id,reaction_type)",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Post;
    },
  });
  const comments = useInfiniteQuery({
    queryKey: ["comments", id],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("post_comments")
        .select(
          "id,content,created_at,user_id,author:profiles!post_comments_user_id_fkey(id,full_name,username,avatar_url)",
        )
        .eq("post_id", id)
        .order("created_at", { ascending: true })
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
  const send = useMutation({
    mutationFn: (content: string) =>
      publishPostComment(supabase, {
        postId: id,
        userId: session?.user.id,
        content,
      }),
    onSuccess: (_, submitted) => {
      setComment((current) => (current === submitted ? "" : current));
      void cache.invalidateQueries({ queryKey: ["comments", id] });
      void cache.invalidateQueries({ queryKey: ["post", id] });
    },
  });
  if (post.isPending)
    return (
      <Screen title="Publication">
        <Loading />
      </Screen>
    );
  if (post.isError)
    return (
      <Screen title="Publication">
        <ErrorState error={post.error} />
      </Screen>
    );
  if (post.data.video_url)
    return (
      <PostReelsDetail
        post={post.data}
        initialCommentsOpen={openComments === "1"}
      />
    );
  return (
    <Screen title="Publication">
      <PostCard post={post.data} initialCommentsOpen={openComments === "1"} />
      <Text style={s.h2}>Commentaires</Text>
      {comments.isError ? (
        <ErrorState error={comments.error} />
      ) : (
        comments.data?.pages.flat().map((c) => (
          <View key={c.id} style={[s.card, s.row]}>
            <Avatar
              uri={c.author?.avatar_url}
              name={displayName(c.author)}
              size={36}
            />
            <View style={{ flex: 1 }}>
              <Text style={[s.text, { fontWeight: "700" }]}>
                {displayName(c.author)}
              </Text>
              <Text style={s.text}>{c.content}</Text>
              <CommentActions comment={c} postId={id} />
            </View>
          </View>
        ))
      )}
      {!!comments.hasNextPage && (
        <Button
          title="Charger les commentaires suivants"
          busy={comments.isFetchingNextPage}
          onPress={() => void comments.fetchNextPage()}
        />
      )}
      <AuthGate>
        <Field
          label="Votre commentaire"
          multiline
          value={comment}
          onChangeText={setComment}
          maxLength={3000}
        />
        {!!send.isError && (
          <Text style={{ color: colors.danger }}>{send.error.message}</Text>
        )}
        {send.error instanceof PostCommentError &&
          ["profile", "login"].includes(send.error.recovery) && (
            <Button
              title={
                send.error.recovery === "profile"
                  ? "Compléter mon profil"
                  : "Se reconnecter"
              }
              onPress={() =>
                router.push({
                  pathname:
                    send.error instanceof PostCommentError &&
                    send.error.recovery === "login"
                      ? "/login"
                      : "/profile-setup",
                  params: { next: `/posts/${id}?comments=1` },
                })
              }
            />
          )}
        <Button
          title="Commenter"
          onPress={() => send.mutate(comment)}
          busy={send.isPending}
          disabled={!comment.trim()}
        />
      </AuthGate>
    </Screen>
  );
}
