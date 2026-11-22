import { queryOptions } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { isSuspended } from "./validation";

/** Independent requests: a slow recommendation or media service must not hold the page. */
export function exploreDiscoveryOptions(
  uid: string,
  blocked: string[] | undefined,
  enabled: boolean,
) {
  const shared = { enabled: !!uid && enabled, staleTime: 120_000 };
  const protectedContent = {
    ...shared,
    enabled: shared.enabled && blocked !== undefined,
  };
  const requireVisibility = () => {
    if (!uid || blocked === undefined)
      throw new Error(
        "Impossible de vérifier la visibilité des contenus. Réessayez.",
      );
  };
  return {
    players: queryOptions({
      ...protectedContent,
      queryKey: ["explore-discovery", uid, "players", blocked],
      queryFn: async ({ signal }) => {
        requireVisibility();
        let query = supabase
          .from("profiles")
          .select(
            "id,full_name,username,avatar_url,position,highest_level,club,is_suspended,suspended_until",
          )
          .neq("id", uid)
          .or("primary_role.ilike.joueu%,position.not.is.null")
          .or("account_type.is.null,account_type.eq.personal")
          .or(
            `is_suspended.is.null,is_suspended.eq.false,suspended_until.lte.${new Date().toISOString()}`,
          )
          .order("avatar_url", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .order("id")
          .limit(24);
        if (blocked?.length)
          query = query.not("id", "in", `(${blocked.join(",")})`);
        const { data, error } = await query.abortSignal(signal);
        if (error) throw error;
        return (data || []).filter((row) => !isSuspended(row));
      },
    }),
    clubs: queryOptions({
      ...shared,
      queryKey: ["explore-discovery", uid, "clubs"],
      queryFn: async ({ signal }) => {
        const { data, error } = await supabase
          .from("fff_clubs")
          .select("id,name,short_name,city,department_code,logo_url,level")
          .order("name")
          .order("id")
          .limit(12)
          .abortSignal(signal);
        if (error) throw error;
        return data || [];
      },
    }),
    opportunities: queryOptions({
      ...shared,
      queryKey: ["explore-discovery", uid, "opportunities"],
      queryFn: async ({ signal }) => {
        const { data, error } = await supabase
          .from("opportunities")
          .select("id,title,location_city,location_department,opportunity_type")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .order("id")
          .limit(6)
          .abortSignal(signal);
        if (error) throw error;
        return data || [];
      },
    }),
    posts: queryOptions({
      ...protectedContent,
      queryKey: ["explore-discovery", uid, "posts", blocked],
      queryFn: async ({ signal }) => {
        requireVisibility();
        let query = supabase
          .from("posts")
          .select("id,user_id,content,hashtags,image_url,video_url,created_at")
          .or("moderation_hidden.is.null,moderation_hidden.eq.false")
          .order("created_at", { ascending: false })
          .order("id")
          .limit(12);
        if (blocked?.length)
          query = query.not("user_id", "in", `(${blocked.join(",")})`);
        const { data, error } = await query.abortSignal(signal);
        if (error) throw error;
        return data || [];
      },
    }),
    stories: queryOptions({
      ...protectedContent,
      queryKey: ["explore-discovery", uid, "stories", blocked],
      queryFn: async ({ signal }) => {
        requireVisibility();
        let query = supabase
          .from("stories")
          .select("hashtags")
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: true })
          .limit(80);
        if (blocked?.length)
          query = query.not("user_id", "in", `(${blocked.join(",")})`);
        const { data, error } = await query.abortSignal(signal);
        if (error) throw error;
        return data || [];
      },
    }),
  };
}

export function exploreHashtags(rows: { hashtags?: string[] | null }[]) {
  const counts = new Map<string, number>();
  for (const row of rows)
    for (const tag of row.hashtags || []) {
      const clean = String(tag).replace(/^#/, "").trim();
      if (clean) counts.set(clean, (counts.get(clean) || 0) + 1);
    }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 16)
    .map(([tag]) => tag);
}

/** Preserve the ranked version of a row when the general list also contains it. */
export function uniqueExploreRows<T extends { id: string }>(
  rows: T[],
  limit: number,
): T[] {
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .slice(0, limit);
}
