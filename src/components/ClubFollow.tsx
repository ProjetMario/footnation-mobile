import { applyClubFollowIntent } from "../lib/clubFollowIntent";
import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { ErrorState, useUIStyles } from "./ui";
import { ClubButton as Button } from "./ClubDesign";
export function ClubFollow({
  id,
  name,
  compact = false,
}: {
  id: string;
  name: string;
  compact?: boolean;
}) {
  const { session } = useAuth();
  const uid = session?.user.id;
  return (
    <ClubFollowControl
      key={`${id}:${uid || "anonymous"}`}
      id={id}
      name={name}
      uid={uid}
      compact={compact}
    />
  );
}
function ClubFollowControl({
  id,
  name,
  uid,
  compact,
}: {
  id: string;
  name: string;
  uid?: string;
  compact: boolean;
}) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const read = async () => {
    const result = await supabase
      .from("club_followers")
      .select("id")
      .eq("club_id", id)
      .eq("profile_id", uid!)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  };
  const query = useQuery({
    queryKey: ["club-follow", id, uid],
    queryFn: async () => {
      const count = await supabase
        .from("club_followers")
        .select("id", { count: "exact", head: true })
        .eq("club_id", id);
      if (count.error) throw count.error;
      if (!uid)
        return { count: count.count || 0, following: false, followId: null };
      const own = await supabase
        .from("club_followers")
        .select("id")
        .eq("club_id", id)
        .eq("profile_id", uid)
        .maybeSingle();
      if (own.error) throw own.error;
      return {
        count: count.count || 0,
        following: !!own.data,
        followId: own.data?.id || null,
      };
    },
  });
  const follow = useMutation({
    mutationFn: async (intent: {
      following: boolean;
      expectedId: string | null;
    }) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (!uid || auth.data.user?.id !== uid)
        throw new Error(
          "Votre session a changé. Reconnectez-vous avant de modifier votre abonnement.",
        );
      await applyClubFollowIntent(
        {
          read,
          insert: async () => {
            const result = await supabase
              .from("club_followers")
              .insert({ club_id: id, profile_id: uid, club_name: name });
            if (result.error) throw result.error;
          },
          remove: async (followId) => {
            const result = await supabase
              .from("club_followers")
              .delete()
              .eq("id", followId)
              .eq("club_id", id)
              .eq("profile_id", uid)
              .select("id");
            if (result.error) throw result.error;
            return result.data.length === 1;
          },
        },
        intent.following,
        intent.expectedId,
      );
    },
    onSuccess: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: ["club-follow", id] }),
        cache.invalidateQueries({ queryKey: ["my-followed-clubs", uid] }),
        cache.invalidateQueries({ queryKey: ["club-public-followers", id] }),
        cache.invalidateQueries({ queryKey: ["club-overview", id] }),
        cache.invalidateQueries({ queryKey: ["club-web-counts", id] }),
        cache.invalidateQueries({ queryKey: ["club-community", id] }),
      ]),
  });
  return (
    <View style={compact ? { gap: 8 } : s.card}>
      {!compact && !!query.data && (
        <Text style={s.text}>{query.data.count} FootLovers</Text>
      )}
      {!compact && (
        <Button
          title="Voir les FootLovers"
          secondary
          onPress={() =>
            router.push(`/club-followers?clubId=${encodeURIComponent(id)}`)
          }
        />
      )}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {follow.isError ? (
        <>
          <Button
            title="Réessayer la même action"
            onPress={() => {
              if (follow.variables) follow.mutate(follow.variables);
            }}
            busy={follow.isPending}
          />
          <Button
            title="Annuler et actualiser"
            secondary
            disabled={follow.isPending}
            onPress={() => {
              follow.reset();
              void query.refetch();
            }}
          />
        </>
      ) : (
        <Button
          title={
            compact
              ? query.data?.following
                ? "✓ Suivi"
                : "+ Suivre"
              : query.data?.following
                ? "Ne plus suivre ce club"
                : "Suivre ce club"
          }
          accessibilityLabel={
            query.data?.following ? "Ne plus suivre ce club" : "Suivre ce club"
          }
          secondary={query.data?.following}
          busy={follow.isPending}
          disabled={query.isFetching || query.isError || !query.isSuccess}
          onPress={() =>
            uid
              ? follow.mutate({
                  following: !query.data?.following,
                  expectedId: query.data?.followId || null,
                })
              : router.push({ pathname: "/login", params: { next: `/club/${id}` } })
          }
        />
      )}
      {!!follow.error && <ErrorState error={follow.error} />}
    </View>
  );
}
