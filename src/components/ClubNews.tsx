import {
  ClubButton as Button,
  useClubUIStyles as useUIStyles,
  ClubSectionHeading,
} from "./ClubDesign";
import { ClubNewsLike } from "./ClubNewsLike";
import { ClubNewsComments } from "./ClubNewsComments";
import { useState } from "react";
import { Share, Text, View } from "react-native";
import { Image } from "expo-image";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { NativeVideo } from "./Video";
import { Avatar, Empty, ErrorState, Loading } from "./ui";

export type News = {
  id: string;
  title: string | null;
  excerpt: string | null;
  content: string;
  media_urls: string[] | null;
  media_type: string | null;
  likes_count: number | null;
  likes: { count: number }[];
  comments_count: number | null;
  comments: { count: number }[];
  is_pinned: boolean;
  source_type: string | null;
  source_team_id: string | null;
  created_at: string;
  source_team: { name: string | null } | null;
  author: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

export function ClubNews({
  id,
  name,
  teamId,
  title = "Les actualités du club",
}: {
  id: string;
  name: string;
  teamId?: string | null;
  title?: string;
}) {
  const s = useUIStyles();

  const uid = useAuth().session?.user.id;
  const query = useInfiniteQuery({
    queryKey: ["club-public-news", id, teamId || null, uid],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let request = supabase
        .from("club_news")
        .select(
          "id,title,excerpt,content,media_urls,media_type,likes_count,comments_count,is_pinned,source_type,source_team_id,created_at,comments:club_news_comments(count),likes:club_news_likes(count),author:profiles(full_name,username,avatar_url),source_team:teams(name)",
        )
        .eq("club_id", id)
        .eq("is_published", true);

      if (teamId) request = request.eq("source_team_id", teamId);

      const result = await request
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 19)
        .returns<News[]>();
      if (result.error) throw result.error;
      return result.data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 20 ? pages.length * 20 : undefined,
  });
  return (
    <>
      <ClubSectionHeading
        title={title}
        busy={query.isFetching}
        refresh={() => void query.refetch()}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages.flat().map((item) => (
        <NewsCard key={item.id} item={item} clubId={id} clubName={name} />
      ))}
      {!!(query.data && !query.data.pages.flat().length) && (
        <Empty
          title="Aucune actualité publiée"
          description={
            teamId
              ? "Les publications des membres de cette équipe apparaîtront ici."
              : "Les nouvelles du club apparaîtront ici."
          }
        />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Voir les actualités précédentes"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
export function NewsCard({
  item,
  clubId,
  clubName,
}: {
  item: News;
  clubId: string;
  clubName: string;
}) {
  const s = useUIStyles();

  const [expanded, setExpanded] = useState(true);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareError, setShareError] = useState<unknown>(null);
  const authorName =
    item.author?.full_name || item.author?.username || clubName;
  const sourceLabel = item.source_team?.name
    ? `Publication membre · ${item.source_team.name}`
    : item.source_type === "member_post" ||
        item.source_type === "team_member_post"
      ? "Publication d’un membre"
      : null;
  return (
    <View style={s.card}>
      <View style={s.row}>
        <Avatar name={authorName} uri={item.author?.avatar_url} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.text}>{authorName}</Text>
          <Text style={s.small}>
            {new Date(item.created_at).toLocaleDateString("fr-FR")}
          </Text>
        </View>
      </View>
      {!!item.is_pinned && <Text style={s.small}>Épinglée par le club</Text>}
      {!!sourceLabel && <Text style={s.small}>{sourceLabel}</Text>}
      {!!item.title && <Text style={s.h2}>{item.title}</Text>}
      {!!item.excerpt && <Text style={s.subtitle}>{item.excerpt}</Text>}
      <Text style={s.text} numberOfLines={expanded ? undefined : 7} selectable>
        {item.content}
      </Text>
      {!!(
        item.content &&
        (item.content.length > 280 || item.content.split("\n").length > 7)
      ) && (
        <Button
          title={expanded ? "Réduire" : "Lire la suite"}
          secondary
          onPress={() => setExpanded(!expanded)}
        />
      )}
      {(item.media_urls || []).map((uri, index) =>
        item.media_type === "video" ? (
          <NativeVideo
            key={`${index}:${uri}`}
            uri={uri}
            style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 12 }}
          />
        ) : (
          <Image
            key={`${index}:${uri}`}
            source={{ uri }}
            accessibilityLabel={`Photo ${index + 1} de l’actualité du club`}
            contentFit="contain"
            style={{ width: "100%", aspectRatio: 1, borderRadius: 12 }}
          />
        ),
      )}
      <Text style={s.small}>
        {item.likes?.[0]?.count ?? item.likes_count ?? 0} mentions J’aime ·{" "}
        {item.comments?.[0]?.count ?? item.comments_count ?? 0} commentaires
      </Text>
      <ClubNewsLike newsId={item.id} clubId={clubId} />
      <Button
        title="Partager l’actualité"
        secondary
        onPress={() => {
          setShareError(null);
          void Share.share({
            message: `${item.title || clubName}\n\n${item.content}\n\nhttps://www.foot-nation.com/club/${encodeURIComponent(clubId)}`,
          }).catch(setShareError);
        }}
      />
      {!!shareError && <ErrorState error={shareError} />}
      <Button
        title={
          commentsOpen ? "Masquer les commentaires" : "Lire les commentaires"
        }
        secondary
        onPress={() => setCommentsOpen(!commentsOpen)}
      />
      {!!commentsOpen && <ClubNewsComments newsId={item.id} clubId={clubId} />}
    </View>
  );
}
