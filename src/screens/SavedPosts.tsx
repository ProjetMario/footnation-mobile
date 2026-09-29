import React from "react";
import { Image } from "expo-image";
import { FlatList, Pressable, Text } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
export default function SavedPosts() {
  const s = useUIStyles();

  const { session } = useAuth();
  const q = useInfiniteQuery({
    queryKey: ["saved-posts", session?.user.id],
    enabled: !!session,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("saved_posts")
        .select(
          "id,post_id,collection_name,post:post_id(content,image_url,video_url)",
        )
        .eq("user_id", session!.user.id)
        .order("saved_at", { ascending: false })
        .order("id")
        .range(pageParam * 30, pageParam * 30 + 29);
      if (error) throw error;
      return data as unknown as {
        id: string;
        post_id: string;
        collection_name: string;
        post: {
          content: string | null;
          image_url: string | null;
          video_url: string | null;
        } | null;
      }[];
    },
    getNextPageParam: (last, _pages, p) =>
      last.length === 30 ? p + 1 : undefined,
  });
  return (
    <Screen title="Publications enregistrées" scroll={false}>
      <AuthGate>
        <FlatList
          contentContainerStyle={s.content}
          data={q.data?.pages.flat() || []}
          keyExtractor={(x) => x.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !item.post }}
              disabled={!item.post}
              onPress={() => router.push(`/posts/${item.post_id}`)}
              style={s.card}
            >
              {item.post?.image_url ? (
                <Image
                  source={{ uri: item.post.image_url }}
                  style={{ height: 180, borderRadius: 14 }}
                  contentFit="cover"
                  accessibilityLabel="Photo de la publication enregistrée"
                />
              ) : null}
              <Text style={s.text} numberOfLines={5}>
                {item.post
                  ? item.post.content ||
                    (item.post.video_url
                      ? "Publication vidéo"
                      : item.post.image_url
                        ? "Publication photo"
                        : "Publication enregistrée")
                  : "Publication indisponible"}
              </Text>
              {!item.post && (
                <Text style={s.small}>
                  Cette publication n’existe plus ou n’est plus accessible.
                </Text>
              )}
              <Text style={s.small}>
                {item.collection_name === "default"
                  ? "Favoris"
                  : item.collection_name}
              </Text>
            </Pressable>
          )}
          ListHeaderComponent={
            q.error && q.data ? (
              <ErrorState error={q.error} retry={() => void q.refetch()} />
            ) : null
          }
          ListFooterComponent={
            q.hasNextPage ? (
              <Button
                title="Charger la suite"
                busy={q.isFetchingNextPage}
                onPress={() => void q.fetchNextPage()}
              />
            ) : null
          }
          ListEmptyComponent={
            q.isPending ? (
              <Loading />
            ) : q.isError ? (
              <ErrorState error={q.error} retry={() => void q.refetch()} />
            ) : (
              <Empty
                title="Vos favoris vous attendent ici"
                description="Enregistrez une publication pour la retrouver plus tard."
              />
            )
          }
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetching && !q.isError)
              void q.fetchNextPage();
          }}
          refreshing={q.isRefetching && !q.isFetchingNextPage}
          onRefresh={() => void q.refetch()}
        />
      </AuthGate>
    </Screen>
  );
}
