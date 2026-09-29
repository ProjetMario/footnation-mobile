import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";

type Follower = {
  id: string;
  profile: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    club: string | null;
  } | null;
};
export default function ClubFollowers() {
  const s = useUIStyles();

  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const uid = useAuth().session?.user.id;
  const query = useInfiniteQuery({
    queryKey: ["club-public-followers", clubId, uid],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!clubId) throw new Error("Le club n’a pas été précisé.");
      const result = await supabase
        .from("club_followers")
        .select(
          "id,profile:profiles!club_followers_profile_id_fkey(id,full_name,username,avatar_url,club)",
          { count: "exact" },
        )
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29)
        .returns<Follower[]>();
      if (result.error) throw result.error;
      return { rows: result.data, count: result.count || 0 };
    },
    getNextPageParam: (last, pages) =>
      pages.reduce((sum, page) => sum + page.rows.length, 0) < last.count
        ? pages.length * 30
        : undefined,
  });
  return (
    <Screen title="FootLovers du club">
      <Button
        title="Actualiser les abonnés"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!query.data && (
        <Text style={s.h2}>{query.data.pages[0].count} FootLovers</Text>
      )}
      {query.data?.pages
        .flatMap((page) => page.rows)
        .map((follower) => {
          const name =
            follower.profile?.full_name ||
            follower.profile?.username ||
            "Membre FootNation";
          return (
            <View key={follower.id} style={s.card}>
              <View style={s.row}>
                <Avatar name={name} uri={follower.profile?.avatar_url} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.h2}>{name}</Text>
                  {!!follower.profile?.club && (
                    <Text style={s.subtitle}>{follower.profile.club}</Text>
                  )}
                </View>
              </View>
              {follower.profile ? (
                <Button
                  title="Voir le profil"
                  secondary
                  onPress={() =>
                    router.push(`/profile/${follower.profile!.id}`)
                  }
                />
              ) : (
                <Text style={s.small}>Profil non accessible</Text>
              )}
            </View>
          );
        })}
      {!!(
        query.data && !query.data.pages.flatMap((page) => page.rows).length
      ) && (
        <Empty
          title="Aucun abonné pour le moment"
          description="Les FootLovers qui suivent ce club apparaîtront ici."
        />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Voir les abonnés suivants"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </Screen>
  );
}
