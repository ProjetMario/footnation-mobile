import { Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";

type Follow = {
  id: string;
  club: {
    id: string;
    name: string;
    short_name: string | null;
    city: string | null;
    department_code: string | null;
    logo_url: string | null;
  } | null;
};
export default function FollowedClubs() {
  return (
    <Screen title="Mes clubs suivis">
      <AuthGate>
        <ClubList />
      </AuthGate>
    </Screen>
  );
}
function ClubList() {
  const s = useUIStyles();

  const uid = useAuth().session!.user.id;
  const query = useInfiniteQuery({
    queryKey: ["my-followed-clubs", uid],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (auth.data.user?.id !== uid)
        throw new Error(
          "Votre session a changé. Reconnectez-vous pour retrouver vos clubs.",
        );
      const result = await supabase
        .from("club_followers")
        .select(
          "id,club:fff_clubs!club_followers_club_id_fkey(id,name,short_name,city,department_code,logo_url)",
          { count: "exact" },
        )
        .eq("profile_id", uid)
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29)
        .returns<Follow[]>();
      if (result.error) throw result.error;
      return { rows: result.data, count: result.count || 0 };
    },
    getNextPageParam: (last, pages) =>
      pages.reduce((sum, page) => sum + page.rows.length, 0) < last.count
        ? pages.length * 30
        : undefined,
  });
  return (
    <>
      <Button
        title="Découvrir des clubs"
        secondary
        onPress={() => router.push("/clubs")}
      />
      <Button
        title="Actualiser mes abonnements"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!query.data && (
        <Text style={s.h2}>{query.data.pages[0].count} clubs suivis</Text>
      )}
      {query.data?.pages
        .flatMap((page) => page.rows)
        .map((follow) => (
          <View key={follow.id} style={s.card}>
            {follow.club ? (
              <>
                <View style={s.row}>
                  <Avatar
                    name={follow.club.short_name || follow.club.name}
                    uri={follow.club.logo_url}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.h2}>
                      {follow.club.short_name || follow.club.name}
                    </Text>
                    <Text style={s.subtitle}>
                      {[follow.club.city, follow.club.department_code]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                </View>
                <Button
                  title="Voir le club"
                  secondary
                  onPress={() => router.push(`/club/${follow.club!.id}`)}
                />
              </>
            ) : (
              <Text style={s.text}>Ce club n’est plus accessible.</Text>
            )}
          </View>
        ))}
      {!!(
        query.data && !query.data.pages.flatMap((page) => page.rows).length
      ) && (
        <Empty
          title="Vous ne suivez aucun club"
          description="Ouvrez une fiche club et choisissez Suivre ce club pour le retrouver ici."
        />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Voir les clubs suivants"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
