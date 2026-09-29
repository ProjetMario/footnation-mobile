import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

export function useProfileOverview(profileId?: string, enabled = true) {
  const uid = useAuth().session?.user.id;
  const counts = useQuery({
    queryKey: ["profile-overview", uid, profileId],
    enabled: !!profileId && enabled,
    queryFn: async ({ signal }) => {
      if (uid && uid !== profileId) {
        const blocked = await supabase
          .from("user_blocks")
          .select("blocker_id,blocked_id")
          .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`)
          .abortSignal(signal);
        if (
          !blocked.error &&
          blocked.data.some(
            (row) => row.blocker_id === profileId || row.blocked_id === profileId,
          )
        )
          throw new Error("Ce profil n’est pas disponible.");
      }
      const [publicCounts, connections] = await Promise.allSettled([
        supabase.rpc("get_public_profile_counts", {
          p_profile_id: profileId!,
        } as never),
        supabase
          .from("connections")
          .select("id,user_id,connected_user_id", { count: "exact" })
          .eq("status", "accepted")
          .or(`user_id.eq.${profileId},connected_user_id.eq.${profileId}`)
          .abortSignal(signal),
      ]);
      const publicCountsResult = publicCounts.status === "fulfilled" ? publicCounts.value : null;
      const connectionsResult = connections.status === "fulfilled" ? connections.value : null;
      const acceptedConnections = connectionsResult && !connectionsResult.error ? connectionsResult.data || [] : [];
      if (publicCountsResult && !publicCountsResult.error && publicCountsResult.data?.[0]) {
        const row = publicCountsResult.data[0] as {
          posts?: number | null;
          followers?: number | null;
          following?: number | null;
        };
        return {
          posts: row.posts ?? 0,
          followers: Math.max(row.followers ?? 0, acceptedConnections.length),
          following: Math.max(row.following ?? 0, acceptedConnections.length),
        };
      }
      const [posts, followers, following] = await Promise.all([
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profileId!)
          .abortSignal(signal),
        supabase
          .from("profile_followers")
          .select("id", { count: "exact", head: true })
          .eq("followed_id", profileId!)
          .abortSignal(signal),
        supabase
          .from("profile_followers")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", profileId!)
          .abortSignal(signal),
      ]);
      for (const result of [posts, followers, following])
        if (result.error) throw result.error;
      return {
        posts: posts.count,
        followers: Math.max(followers.count ?? 0, acceptedConnections.length),
        following: Math.max(following.count ?? 0, acceptedConnections.length),
      };
    },
  });
  const views = useQuery({
    queryKey: ["native-profile-views-count", uid],
    enabled: !!uid && profileId === uid && enabled,
    queryFn: async ({ signal }) => {
      const result = await supabase
        .from("profile_views")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", uid!)
        .abortSignal(signal);
      if (result.error) throw result.error;
      return result.count;
    },
  });
  useFocusEffect(
    useCallback(() => {
      if (!enabled || !uid || !profileId) return;
      void counts.refetch();
      if (uid === profileId) void views.refetch();
    }, [enabled, uid, profileId, counts.refetch, views.refetch]),
  );
  return { counts, views };
}

export function useClubOverview(clubId?: string) {
  const uid = useAuth().session?.user.id;
  const query = useQuery({
    queryKey: ["club-overview", clubId, uid],
    enabled: !!clubId,
    queryFn: async ({ signal }) => {
      const [news, followers, players] = await Promise.all([
        supabase
          .from("club_news")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId!)
          .eq("is_published", true)
          .abortSignal(signal),
        supabase
          .from("club_followers")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId!)
          .abortSignal(signal),
        supabase
          .from("club_players")
          .select("id", { count: "exact", head: true })
          .eq("club_id", clubId!)
          .eq("is_active", true)
          .abortSignal(signal),
      ]);
      for (const result of [news, followers, players])
        if (result.error) throw result.error;
      return {
        news: news.count,
        followers: followers.count,
        players: players.count,
      };
    },
  });
  useFocusEffect(
    useCallback(() => {
      if (clubId) void query.refetch();
    }, [clubId, query.refetch]),
  );
  return query;
}
