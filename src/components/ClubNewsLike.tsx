import { router } from "expo-router";
import { View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { applyNewsLikeIntent } from "../lib/newsLikeIntent";
import { Button, ErrorState } from "./ui";

export function ClubNewsLike({
  newsId,
  clubId,
}: {
  newsId: string;
  clubId: string;
}) {
  const uid = useAuth().session?.user.id;
  return (
    <LikeControl
      key={uid || "anonymous"}
      uid={uid}
      newsId={newsId}
      clubId={clubId}
    />
  );
}
function LikeControl({
  uid,
  newsId,
  clubId,
}: {
  uid?: string;
  newsId: string;
  clubId: string;
}) {
  const cache = useQueryClient();
  const read = async () => {
    const result = await supabase
      .from("club_news_likes")
      .select("id")
      .eq("news_id", newsId)
      .eq("user_id", uid!)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  };
  const query = useQuery({
    queryKey: ["club-news-my-like", clubId, newsId, uid],
    enabled: !!uid,
    queryFn: read,
  });
  const change = useMutation({
    mutationFn: async (intent: {
      liked: boolean;
      expectedId: string | null;
    }) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!uid || auth.data.user?.id !== uid)
        throw new Error(
          "Votre session a changé. Reconnectez-vous avant de réagir.",
        );
      const parent = await supabase
        .from("club_news")
        .select("id")
        .eq("id", newsId)
        .eq("club_id", clubId)
        .eq("is_published", true)
        .maybeSingle();
      if (parent.error) throw parent.error;
      if (!parent.data)
        throw new Error(
          "Cette actualité n’est plus disponible. Actualisez le fil du club.",
        );
      await applyNewsLikeIntent(
        {
          read,
          insert: async () => {
            const result = await supabase
              .from("club_news_likes")
              .insert({ news_id: newsId, user_id: uid });
            if (result.error) throw result.error;
          },
          remove: async (id) => {
            const result = await supabase
              .from("club_news_likes")
              .delete()
              .eq("id", id)
              .eq("news_id", newsId)
              .eq("user_id", uid)
              .select("id");
            if (result.error) throw result.error;
            return result.data.length === 1;
          },
        },
        intent.liked,
        intent.expectedId,
      );
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({
          queryKey: ["club-news-my-like", clubId, newsId],
        }),
        cache.invalidateQueries({ queryKey: ["club-public-news", clubId] }),
        cache.invalidateQueries({ queryKey: ["club-public-media", clubId] }),
      ]);
    },
  });
  if (!uid)
    return (
      <Button
        title="Se connecter pour aimer"
        secondary
        onPress={() => router.push({ pathname: "/login", params: { next: `/club/${clubId}` } })}
      />
    );
  return (
    <View style={{ gap: 8 }}>
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!change.error && <ErrorState error={change.error} />}
      {change.isError ? (
        <>
          <Button
            title="Réessayer la même action"
            busy={change.isPending}
            onPress={() => {
              if (change.variables) change.mutate(change.variables);
            }}
          />
          <Button
            title="Annuler et actualiser"
            secondary
            disabled={change.isPending}
            onPress={() => {
              change.reset();
              void query.refetch();
            }}
          />
        </>
      ) : (
        <Button
          title={query.data ? "Retirer ma mention J’aime" : "J’aime"}
          secondary={!query.data}
          busy={change.isPending}
          disabled={query.isFetching || query.isError || !query.isSuccess}
          onPress={() =>
            change.mutate({
              liked: !query.data,
              expectedId: query.data?.id || null,
            })
          }
        />
      )}
    </View>
  );
}
