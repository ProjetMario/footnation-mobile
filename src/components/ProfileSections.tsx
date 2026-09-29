import { PagedMediaViewer } from "./PagedMediaViewer";
import { ShortReelsFrame, type Short } from "../screens/Shorts";
import { ShortComments } from "./ShortComments";
import { displayName } from "../lib/models";
import { getDefaultMusic } from "../data/shortMusicLibrary";
import { MediaGrid } from "./MediaGrid";
import { blockedSocialAuthors } from "../lib/socialVisibility";
import {
  initialVideoCursor,
  mergeVideoPage,
  videoFeedKey,
} from "../lib/videoFeed";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Avatar, Button, Empty, ErrorState, Loading, useUIStyles } from "./ui";

type Team = {
  id: string;
  name: string;
  club_id: string;
  club: { id: string; name: string; logo_url?: string } | null;
};
export function useProfileClubs(
  profileId?: string,
  linkedClubId?: string | null,
) {
  const uid = useAuth().session?.user.id;
  const own = uid === profileId;
  return useQuery({
    enabled: !!uid && !!profileId,
    queryKey: ["profile-teams", uid, profileId, linkedClubId],
    queryFn: async ({ signal }) => {
      const memberships = own
        ? await supabase
            .from("team_members")
            .select(
              "team:teams!inner(id,name,club_id,club:fff_clubs(id,name,logo_url))",
            )
            .eq("profile_id", profileId!)
            .eq("is_active", true)
            .eq("status", "approved")
            .abortSignal(signal)
        : { data: [], error: null };
      if (memberships.error) throw memberships.error;
      const club = linkedClubId
        ? await supabase
            .from("fff_clubs")
            .select("id,name,logo_url")
            .eq("id", linkedClubId)
            .abortSignal(signal)
            .maybeSingle()
        : { data: null, error: null };
      if (club.error) throw club.error;
      const teams = (memberships.data as unknown as { team: Team }[])
        .map((row) => row.team)
        .filter(Boolean);
      return {
        teams,
        club: club.data as {
          id: string;
          name: string;
          logo_url?: string;
        } | null,
      };
    },
  });
}
export function ProfileClubs({
  profileId,
  linkedClubId,
}: {
  profileId: string;
  linkedClubId?: string | null;
}) {
  const s = useUIStyles();
  const own = useAuth().session?.user.id === profileId;
  const query = useProfileClubs(profileId, linkedClubId);
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const { teams, club } = query.data;
  return (
    <View style={s.content}>
      <Text style={s.h2}>{own ? "Mes équipes et mon club" : "Club"}</Text>
      {teams.map((team) => (
        <Pressable
          key={team.id}
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir le calendrier de ${team.name}`}
          onPress={() => router.push(`/club/${team.club_id}/member`)}
          style={s.card}
        >
          <View style={s.row}>
            <Avatar
              uri={team.club?.logo_url}
              name={team.club?.name || team.name}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>{team.name}</Text>
              <Text style={s.text}>{team.club?.name}</Text>
            </View>
          </View>
          <Text style={s.small}>Voir mon calendrier</Text>
        </Pressable>
      ))}
      {!!(club && !teams.some((team) => team.club_id === club.id)) && (
        <Button
          title={club.name}
          secondary
          onPress={() => router.push(`/club/${club.id}`)}
        />
      )}
      {!!(!teams.length && !club) && (
        <Empty
          title="Aucune équipe affichée"
          description={
            own
              ? "Tu peux rejoindre ton équipe avec l’invitation de ton coach."
              : "Ce profil n’affiche pas encore de club."
          }
          action={
            own ? (
              <Button
                title="Retrouver mon invitation"
                onPress={() => router.push("/member/invitations")}
              />
            ) : undefined
          }
        />
      )}
      {!!own && (
        <Button
          title="Mes clubs suivis"
          secondary
          onPress={() => router.push("/my-followed-clubs")}
        />
      )}
    </View>
  );
}

export function ProfileShorts({ profileId }: { profileId: string }) {
  const s = useUIStyles();
  const uid = useAuth().session?.user.id;
  const [opened, setOpened] = useState<string | null>(null);
  const [comments, setComments] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["profile-videos-grid-v2", uid, profileId],
    enabled: !!uid,
    initialPageParam: initialVideoCursor,
    queryFn: async ({ pageParam, signal }) => {
      if ((await blockedSocialAuthors(uid!)).includes(profileId))
        return { items: [] as Short[], next: undefined };
      const source = (
        table: "posts" | "shorts",
        columns: string,
        offset: number,
      ) =>
        supabase
          .from(table)
          .select(columns)
          .eq("user_id", profileId)
          .not("video_url", "is", null)
          .neq("video_url", "")
          .or("moderation_hidden.is.null,moderation_hidden.eq.false")
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 12)
          .abortSignal(signal);
      const [posts, shorts] = await Promise.all([
        source(
          "posts",
          "id,user_id,created_at,content,video_url,image_url,user:profiles!posts_user_id_fkey(id,full_name,username,avatar_url)",
          pageParam.posts,
        ),
        source(
          "shorts",
          "*,user:profiles!shorts_user_id_fkey(id,full_name,username,avatar_url)",
          pageParam.shorts,
        ),
      ]);
      if (posts.error) throw posts.error;
      if (shorts.error) throw shorts.error;
      type PostVideo = Short & {
        content: string | null;
        image_url: string | null;
      };
      const postVideos = (posts.data as unknown as PostVideo[]).map((post) => ({
        ...post,
        origin: "post" as const,
        description: post.content,
        thumbnail_url: post.image_url,
        music_url: getDefaultMusic().audioUrl,
      }));
      return mergeVideoPage(
        postVideos as Short[],
        shorts.data as unknown as Short[],
        pageParam,
      );
    },
    getNextPageParam: (last) => last.next,
  });
  const videos = query.data?.pages.flatMap((page) => page.items) || [];
  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage)
      void query.fetchNextPage();
  };
  return (
    <View style={{ gap: 12 }}>
      {!!opened && (
        <PagedMediaViewer
          items={videos}
          initialKey={opened}
          keyFor={videoFeedKey}
          onClose={() => {
            setOpened(null);
            setComments(null);
          }}
          onLoadMore={loadMore}
          loadingMore={query.isFetchingNextPage}
          renderItem={(video, visible) => (
            <ShortReelsFrame
              short={video}
              visible={visible && !comments}
              showBack
              onBack={() => setOpened(null)}
              profileName={displayName(video.user)}
              onOpenComments={
                video.origin === "short"
                  ? () => setComments(video.id)
                  : undefined
              }
            />
          )}
        />
      )}
      {!!comments && (
        <ShortComments
          shortId={comments}
          open
          onClose={() => setComments(null)}
        />
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : videos.length ? (
        <MediaGrid
          items={videos.map((video) => ({
            id: videoFeedKey(video),
            title: video.description,
            image: video.thumbnail_url,
            video: video.video_url,
          }))}
          onOpen={(item) => setOpened(item.id)}
        />
      ) : (
        <View style={s.content}>
          <Empty
            title="Aucun Short publié"
            description="Les vidéos de ce membre apparaîtront ici."
          />
        </View>
      )}
      {!!query.hasNextPage && (
        <Button
          title="Voir plus de Shorts"
          secondary
          busy={query.isFetchingNextPage}
          onPress={loadMore}
        />
      )}
    </View>
  );
}
