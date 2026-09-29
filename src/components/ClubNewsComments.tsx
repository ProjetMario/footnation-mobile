import {
  commentTextRejected,
  COMMENT_MODERATION_MESSAGE,
} from "../lib/commentModeration";
import {
  ClubButton as Button,
  useClubUIStyles as useUIStyles,
} from "./ClubDesign";
import { useState } from "react";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { Text, View } from "react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Avatar, Empty, ErrorState, Field, Loading } from "./ui";

type Comment = {
  id: string;
  content: string;
  created_at: string;
  author: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};
export function ClubNewsComments({
  newsId,
  clubId,
}: {
  newsId: string;
  clubId: string;
}) {
  const s = useUIStyles();

  const uid = useAuth().session?.user.id;
  const query = useInfiniteQuery({
    queryKey: ["club-public-news-comments", clubId, newsId, uid],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const result = await supabase
        .from("club_news_comments")
        .select(
          "id,content,created_at,author:profiles(full_name,username,avatar_url),news:club_news!inner(id)",
          { count: "exact" },
        )
        .eq("news_id", newsId)
        .eq("news.club_id", clubId)
        .eq("news.is_published", true)
        .order("created_at")
        .order("id")
        .range(pageParam, pageParam + 29)
        .returns<Comment[]>();
      if (result.error) throw result.error;
      return { rows: result.data, count: result.count || 0 };
    },
    getNextPageParam: (last, pages) =>
      pages.reduce((sum, page) => sum + page.rows.length, 0) < last.count
        ? pages.length * 30
        : undefined,
  });
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.h2}>Commentaires</Text>
      <CommentComposer
        key={uid || "anonymous"}
        uid={uid}
        newsId={newsId}
        clubId={clubId}
      />
      <Button
        title="Actualiser les commentaires"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!query.data && (
        <Text style={s.small}>{query.data.pages[0].count} commentaires</Text>
      )}
      {query.data?.pages
        .flatMap((page) => page.rows)
        .map((comment) => {
          const name =
            comment.author?.full_name ||
            comment.author?.username ||
            "Membre FootNation";
          return (
            <View key={comment.id} style={s.card}>
              <View style={s.row}>
                <Avatar name={name} uri={comment.author?.avatar_url} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.text}>{name}</Text>
                  <Text style={s.small}>
                    {new Date(comment.created_at).toLocaleString("fr-FR")}
                  </Text>
                </View>
              </View>
              <Text style={s.text} selectable>
                {comment.content}
              </Text>
            </View>
          );
        })}
      {!!(
        query.data && !query.data.pages.flatMap((page) => page.rows).length
      ) && (
        <Empty
          title="Aucun commentaire à afficher"
          description="Les commentaires disponibles apparaîtront ici."
        />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Voir les commentaires suivants"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </View>
  );
}

function CommentComposer({
  uid,
  newsId,
  clubId,
}: {
  uid?: string;
  newsId: string;
  clubId: string;
}) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [draft, setDraft] = useState("");
  const [proposal, setProposal] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const [sent, setSent] = useState(false);
  const send = useMutation({
    mutationFn: async (comment: { id: string; content: string }) => {
      if (commentTextRejected(comment.content))
        throw new Error(COMMENT_MODERATION_MESSAGE);
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!uid || auth.data.user?.id !== uid)
        throw new Error(
          "Votre session a changé. Reconnectez-vous avant de commenter.",
        );
      const result = await supabase.rpc("create_native_club_news_comment", {
        p_id: comment.id,
        p_news_id: newsId,
        p_club_id: clubId,
        p_content: comment.content,
      });
      if (result.error) throw result.error;
      if (result.data !== comment.id)
        throw new Error("L’envoi n’a pas pu être confirmé. Réessayez.");
    },
    onSuccess: () => {
      setDraft("");
      setProposal(null);
      setSent(true);
      void cache.invalidateQueries({
        queryKey: ["club-public-news-comments", clubId, newsId],
      });
      void cache.invalidateQueries({ queryKey: ["club-public-news", clubId] });
      void cache.invalidateQueries({ queryKey: ["club-public-media", clubId] });
    },
  });
  if (!uid)
    return (
      <Button
        title="Se connecter pour commenter"
        secondary
        onPress={() =>
          router.push({
            pathname: "/login",
            params: { next: `/club/${clubId}` },
          })
        }
      />
    );
  return (
    <View style={{ gap: 12 }}>
      <Field
        label="Votre commentaire"
        value={draft}
        multiline
        maxLength={10000}
        editable={!proposal && !send.isPending}
        onChangeText={(value) => {
          setDraft(value);
          setSent(false);
          send.reset();
        }}
      />
      {!!sent && <Text style={s.text}>Votre commentaire a été publié.</Text>}
      {!!send.error && <ErrorState error={send.error} />}
      {proposal ? (
        <>
          <Text style={s.small}>
            Ce commentaire sera public sur l’actualité du club.
          </Text>
          <Button
            title="Publier le commentaire"
            busy={send.isPending}
            onPress={() => send.mutate(proposal)}
          />
          <Button
            title="Modifier le texte"
            secondary
            disabled={send.isPending}
            onPress={() => {
              setProposal(null);
              send.reset();
            }}
          />
        </>
      ) : (
        <Button
          title="Préparer le commentaire"
          disabled={!draft.trim()}
          onPress={() => {
            setSent(false);
            setProposal({ id: randomUUID(), content: draft.trim() });
          }}
        />
      )}
    </View>
  );
}
