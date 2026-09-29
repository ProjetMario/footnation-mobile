import React, { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
type ProfileSummary = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  primary_role: string | null;
  club: string | null;
};
type FollowRow = {
  id: string;
  created_at: string;
  profile: ProfileSummary | null;
};
export default function Followers() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{
    profileId?: string;
    direction?: string;
  }>();
  const profileId = params.profileId || session?.user.id;
  return (
    <FollowerContent
      key={`${session?.user.id}:${profileId}:${params.direction}`}
      profileId={profileId}
      initialDirection={
        params.direction === "following" ? "following" : "followers"
      }
    />
  );
}
function FollowerContent({
  profileId,
  initialDirection,
}: {
  profileId?: string;
  initialDirection: "followers" | "following";
}) {
  const s = useUIStyles();

  const { session } = useAuth();
  const uid = session?.user.id;
  const [direction, setDirection] = useState<"followers" | "following">(
    initialDirection,
  );
  const query = useInfiniteQuery({
    queryKey: ["profile-follows", uid, profileId, direction],
    enabled: !!uid && !!profileId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const foreignKey =
        direction === "followers"
          ? "profile_followers_follower_id_fkey"
          : "profile_followers_followed_id_fkey";
      const result = await supabase
        .from("profile_followers")
        .select(
          `id,created_at,profile:profiles!${foreignKey}(id,full_name,username,avatar_url,primary_role,club)`,
          { count: "exact" },
        )
        .eq(
          direction === "followers" ? "followed_id" : "follower_id",
          profileId!,
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (result.error) throw result.error;
      return {
        rows: result.data as unknown as FollowRow[],
        total: result.count,
      };
    },
    getNextPageParam: (last, _pages, offset) =>
      last.rows.length === 30 ? offset + 30 : undefined,
  });
  useFocusEffect(
    useCallback(() => {
      if (uid) void query.refetch();
    }, [uid, query.refetch]),
  );
  const rows = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.rows) || []).map((row) => [
        row.id,
        row,
      ]),
    ).values(),
  ];
  const total = query.data?.pages[0]?.total;
  return (
    <Screen title="FootLovers et abonnements" scroll={false}>
      <AuthGate>
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          contentContainerStyle={s.content}
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <View style={s.row}>
                <Chip
                  label="FootLovers"
                  selected={direction === "followers"}
                  onPress={() => setDirection("followers")}
                />
                <Chip
                  label="Abonnements"
                  selected={direction === "following"}
                  onPress={() => setDirection("following")}
                />
              </View>
              {typeof total === "number" && (
                <Text style={s.subtitle}>
                  {total}{" "}
                  {direction === "followers" ? "FootLovers" : "abonnement(s)"}
                </Text>
              )}
              <Text style={s.small}>
                Ouvrez un profil pour consulter ses informations ou gérer votre
                suivi.
              </Text>
              {!!(query.error && rows.length) && (
                <ErrorState
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              )}
            </View>
          }
          renderItem={({ item }) => {
            const profile = item.profile;
            const name =
              profile?.full_name || profile?.username || "Compte indisponible";
            return (
              <Pressable
                style={s.card}
                accessibilityRole="button"
                accessibilityLabel={name}
                disabled={!profile}
                onPress={() => {
                  if (profile) router.push(`/profile/${profile.id}`);
                }}
              >
                <View style={s.row}>
                  <Avatar uri={profile?.avatar_url} name={name} size={48} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.h2}>{name}</Text>
                    {!!profile && (
                      <Text style={s.subtitle}>
                        {[profile.primary_role, profile.club]
                          .filter(Boolean)
                          .join(" · ") || "Membre FootNation"}
                      </Text>
                    )}
                    {!profile && (
                      <Text style={s.small}>
                        Ce profil n’est plus accessible.
                      </Text>
                    )}
                  </View>
                </View>
                {Number.isFinite(Date.parse(item.created_at)) ? (
                  <Text style={s.small}>
                    Depuis le{" "}
                    {new Date(item.created_at).toLocaleDateString("fr-FR")}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            query.isPending ? (
              <Loading />
            ) : query.isError ? (
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            ) : (
              <Empty
                title={
                  direction === "followers"
                    ? "Aucun FootLover pour le moment"
                    : "Vous ne suivez encore personne"
                }
              />
            )
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <Button
                secondary
                title="Afficher davantage"
                busy={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
              />
            ) : null
          }
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
        />
      </AuthGate>
    </Screen>
  );
}
