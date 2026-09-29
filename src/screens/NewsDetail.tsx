import React, { useRef, useState } from "react";
import { FlatList, Linking, Share, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase, requireBackend } from "../lib/supabase";
import {
  commentTextRejected,
  COMMENT_MODERATION_MESSAGE,
} from "../lib/commentModeration";
import {
  Avatar,
  Button,
  Chip,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import type { NewsReactionType } from "../types/news";

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  profiles: {
    id: string;
    full_name?: string;
    username?: string;
    avatar_url?: string;
  } | null;
};
const reactions: [NewsReactionType, string][] = [
  ["like", "J’aime"],
  ["fire", "Passionnant"],
  ["wow", "Surprenant"],
];
export default function NewsDetail() {
  const s = useUIStyles();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const cache = useQueryClient();
  const list = useRef<FlatList<Comment>>(null);
  const [content, setContent] = useState("");
  const [reply, setReply] = useState<Comment | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const article = useQuery({
    queryKey: ["news-item", id],
    queryFn: async () => {
      requireBackend();
      const { data, error } = await supabase
        .from("news_cache")
        .select("id,title,description,source_name,published_at,url,image_url")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const comments = useInfiniteQuery({
    queryKey: ["news-comments", id],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("news_comments")
        .select(
          "id,content,created_at,parent_id,user_id,profiles:user_id(id,full_name,username,avatar_url)",
        )
        .eq("news_id", id)
        .order("created_at")
        .order("id")
        .range(pageParam, pageParam + 29);
      if (error) throw error;
      return (data ?? []) as unknown as Comment[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const reactionQuery = useQuery({
    queryKey: ["news-reactions", id, session?.user.id],
    queryFn: async () => {
      const counts = await Promise.all(
        reactions.map(async ([reaction]) => {
          const { count, error } = await supabase
            .from("news_reactions")
            .select("id", { count: "exact", head: true })
            .eq("news_id", id)
            .eq("reaction", reaction);
          if (error) throw error;
          return [reaction, count ?? 0] as const;
        }),
      );
      let own: string | null = null;
      if (session) {
        const { data, error } = await supabase
          .from("news_reactions")
          .select("reaction")
          .eq("news_id", id)
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (error) throw error;
        own = data?.reaction ?? null;
      }
      return { counts: Object.fromEntries(counts), own };
    },
  });
  const mutation = useMutation({
    mutationFn: async (
      action:
        | { type: "comment" }
        | { type: "delete"; id: string }
        | { type: "reaction"; value: NewsReactionType },
    ) => {
      const {
        data: { session: fresh },
      } = await supabase.auth.getSession();
      if (!fresh)
        throw new Error("Connectez-vous pour participer à la discussion.");
      const userId = fresh.user.id;
      if (action.type === "comment") {
        const text = content.trim();
        if (!text || text.length > 3000)
          throw new Error("Saisissez un commentaire de 1 à 3 000 caractères.");
        if (commentTextRejected(text))
          throw new Error(COMMENT_MODERATION_MESSAGE);
        if (reply) {
          const { error } = await supabase
            .from("news_comments")
            .select("id")
            .eq("id", reply.id)
            .eq("news_id", id)
            .single();
          if (error)
            throw new Error(
              "Le commentaire auquel vous répondez n’est plus disponible.",
            );
        }
        const { error } = await supabase.from("news_comments").insert({
          news_id: id,
          user_id: userId,
          content: text,
          parent_id: reply?.id ?? null,
        });
        if (error) throw error;
      } else if (action.type === "delete") {
        const { error } = await supabase
          .from("news_comments")
          .delete()
          .eq("id", action.id)
          .eq("news_id", id)
          .eq("user_id", userId)
          .select("id")
          .single();
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("news_reactions")
          .select("id,reaction")
          .eq("news_id", id)
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        const table = supabase.from("news_reactions");
        const result = data
          ? await (
              data.reaction === action.value
                ? table.delete()
                : table.update({ reaction: action.value })
            )
              .eq("id", data.id)
              .eq("user_id", userId)
              .select("id")
              .single()
          : await table.insert({
              news_id: id,
              user_id: userId,
              reaction: action.value,
            });
        if (result.error) throw result.error;
      }
    },
    onSuccess: (_, action) => {
      if (action.type === "comment") {
        setContent("");
        setReply(null);
      }
      setRemove(null);
      void cache.invalidateQueries({ queryKey: ["news-comments", id] });
      void cache.invalidateQueries({ queryKey: ["news-reactions", id] });
    },
  });
  const [externalError, setExternalError] = useState<Error | null>(null);
  async function openSource() {
    try {
      const url = new URL(article.data!.url);
      if (!["https:", "http:"].includes(url.protocol))
        throw new Error("Lien de l’article invalide.");
      await Linking.openURL(url.toString());
    } catch (error) {
      setExternalError(
        error instanceof Error
          ? error
          : new Error("Impossible d’ouvrir l’article."),
      );
    }
  }
  return (
    <Screen title="Actualité" scroll={false}>
      <FlatList
        ref={list}
        keyboardShouldPersistTaps="handled"
        data={article.data ? (comments.data?.pages.flat() ?? []) : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.content}
        refreshing={article.isRefetching || comments.isRefetching}
        onRefresh={() => {
          void article.refetch();
          void comments.refetch();
          void reactionQuery.refetch();
        }}
        ListHeaderComponent={
          article.isPending ? (
            <Loading />
          ) : article.isError ? (
            <ErrorState
              error={article.error}
              retry={() => void article.refetch()}
            />
          ) : (
            <View style={{ gap: 18 }}>
              {!!article.data.image_url && (
                <Image
                  source={{ uri: article.data.image_url }}
                  style={{ width: "100%", aspectRatio: 1.7, borderRadius: 20 }}
                  contentFit="cover"
                />
              )}
              <Text style={s.small}>
                {article.data.source_name}
                {article.data.published_at
                  ? ` · ${new Date(article.data.published_at).toLocaleDateString("fr-FR")}`
                  : ""}
              </Text>
              <Text style={s.title}>{article.data.title}</Text>
              <Text style={s.text}>{article.data.description}</Text>
              <Button
                title="Lire l’article chez la source"
                onPress={() => void openSource()}
              />
              <Button
                secondary
                title="Partager"
                onPress={() => {
                  void Share.share({
                    message: `${article.data.title}\nhttps://www.foot-nation.com/actu/${encodeURIComponent(id)}`,
                  }).catch((error: Error) => setExternalError(error));
                }}
              />
              {!!externalError && <ErrorState error={externalError} />}
              {reactionQuery.isError ? (
                <ErrorState
                  error={reactionQuery.error}
                  retry={() => void reactionQuery.refetch()}
                />
              ) : (
                <View style={[s.row, { flexWrap: "wrap" }]}>
                  {reactions.map(([value, label]) => (
                    <Chip
                      key={value}
                      selected={reactionQuery.data?.own === value}
                      label={`${label} · ${reactionQuery.data?.counts[value] ?? "…"}`}
                      onPress={() => {
                        if (!session)
                          router.push({
                            pathname: "/login",
                            params: { next: `/actu/${id}` },
                          });
                        else if (!mutation.isPending && reactionQuery.data)
                          mutation.mutate({ type: "reaction", value });
                      }}
                    />
                  ))}
                </View>
              )}
              <Text style={s.h2}>Discussion</Text>
              {session ? (
                <View style={s.card}>
                  {!!reply && (
                    <>
                      <Text style={s.small}>
                        En réponse à{" "}
                        {reply.profiles?.full_name ||
                          reply.profiles?.username ||
                          "un membre"}{" "}
                        : {reply.content.slice(0, 120)}
                      </Text>
                      <Button
                        secondary
                        title="Annuler la réponse"
                        onPress={() => setReply(null)}
                      />
                    </>
                  )}
                  <Field
                    label="Votre commentaire"
                    value={content}
                    onChangeText={setContent}
                    multiline
                    maxLength={3000}
                  />
                  <Button
                    title="Publier le commentaire"
                    busy={mutation.isPending}
                    disabled={!content.trim()}
                    onPress={() => mutation.mutate({ type: "comment" })}
                  />
                </View>
              ) : (
                <Button
                  title="Se connecter pour commenter"
                  onPress={() =>
                    router.push({
                      pathname: "/login",
                      params: { next: `/actu/${id}` },
                    })
                  }
                />
              )}
              {!!mutation.isError && <ErrorState error={mutation.error} />}
              {comments.isPending ? (
                <Loading />
              ) : comments.isError ? (
                <ErrorState
                  error={comments.error}
                  retry={() => void comments.refetch()}
                />
              ) : !comments.data?.pages[0]?.length ? (
                <Text style={s.subtitle}>
                  Soyez le premier à commenter cette actualité.
                </Text>
              ) : null}
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Avatar
                uri={item.profiles?.avatar_url}
                name={item.profiles?.full_name || "Membre"}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.h2}>
                  {item.profiles?.full_name ||
                    item.profiles?.username ||
                    "Membre FootNation"}
                </Text>
                <Text style={s.small}>
                  {new Date(item.created_at).toLocaleString("fr-FR")}
                </Text>
              </View>
            </View>
            {!!item.parent_id && (
              <Text style={s.small}>Réponse à un commentaire</Text>
            )}
            <Text style={s.text}>{item.content}</Text>
            {!!session && (
              <Button
                secondary
                title="Répondre"
                onPress={() => {
                  setReply(item);
                  list.current?.scrollToOffset({ offset: 0, animated: true });
                }}
              />
            )}
            {session?.user.id === item.user_id &&
              (remove === item.id ? (
                <>
                  <Text style={s.text}>
                    Supprimer définitivement ce commentaire ?
                  </Text>
                  <Button
                    title="Confirmer la suppression"
                    busy={mutation.isPending}
                    onPress={() =>
                      mutation.mutate({ type: "delete", id: item.id })
                    }
                  />
                  <Button
                    secondary
                    title="Annuler"
                    onPress={() => setRemove(null)}
                  />
                </>
              ) : (
                <Button
                  secondary
                  title="Supprimer"
                  onPress={() => setRemove(item.id)}
                />
              ))}
          </View>
        )}
        ListFooterComponent={
          article.data && comments.hasNextPage ? (
            <Button
              secondary
              title="Commentaires suivants"
              busy={comments.isFetchingNextPage}
              onPress={() => void comments.fetchNextPage()}
            />
          ) : null
        }
      />
    </Screen>
  );
}
