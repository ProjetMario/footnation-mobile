import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  Loading,
  MenuRow,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
export default function ProfileViews() {
  return (
    <Screen title="Vues de mon profil">
      <AuthGate>
        <Views />
      </AuthGate>
    </Screen>
  );
}
function Views() {
  const s = useUIStyles();

  const { session } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ["native-profile-viewers", session!.user.id],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const views = await supabase
        .from("profile_views")
        .select("id,viewer_id,viewed_at", { count: "exact" })
        .eq("profile_id", session!.user.id)
        .order("viewed_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (views.error) throw views.error;
      let profiles: any[] = [];
      if (views.data.length) {
        const response = await supabase
          .from("profiles")
          .select("id,full_name,username,avatar_url,position,club")
          .in("id", [...new Set(views.data.map((view) => view.viewer_id))]);
        if (response.error) throw response.error;
        profiles = response.data;
      }
      return {
        total: views.count,
        rows: views.data.map((view) => ({
          ...view,
          viewer: profiles.find((p) => p.id === view.viewer_id),
        })),
      };
    },
    getNextPageParam: (last, pages) =>
      last.rows.length === 30 ? pages.length * 30 : undefined,
  });
  return (
    <>
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!query.data && (
        <Text style={s.title}>{query.data.pages[0].total ?? 0} vues</Text>
      )}
      {query.data?.pages
        .flatMap((page) => page.rows)
        .map((view) => (
          <View style={s.card} key={view.id}>
            <View style={s.row}>
              <Avatar
                uri={view.viewer?.avatar_url}
                name={view.viewer?.full_name}
              />
              <Text style={s.small}>
                {new Date(view.viewed_at).toLocaleString("fr-FR")}
              </Text>
            </View>
            {view.viewer ? (
              <MenuRow
                title={
                  view.viewer.full_name ||
                  view.viewer.username ||
                  "Membre FootNation"
                }
                subtitle={[view.viewer.position, view.viewer.club]
                  .filter(Boolean)
                  .join(" · ")}
                onPress={() => router.push(`/profile/${view.viewer_id}`)}
              />
            ) : (
              <Text style={s.text}>Profil indisponible</Text>
            )}
          </View>
        ))}
      {!!(query.data && !query.data.pages[0].rows.length) && (
        <Empty title="Aucune visite enregistrée" />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Charger la suite"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
