import { supabase } from "./supabase";
import { isSuspended } from "./validation";
import { geographyArticle } from "./geography";
export type GeographyProfile = {
  id: string;
  slug: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  position: string | null;
  primary_role: string | null;
  city: string | null;
  club: string | null;
  is_suspended?: boolean | null;
  suspended_until?: string | null;
};
export async function loadGeographyProfiles(
  slug: string,
  uid?: string,
  signal?: AbortSignal,
): Promise<GeographyProfile[]> {
  const article = geographyArticle(slug);
  if (!article) return [];
  const blocked = new Set<string>();
  if (uid) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        uid,
      )
    )
      throw new Error("Compte invalide.");
    let request = supabase
      .from("user_blocks")
      .select("blocker_id,blocked_id")
      .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
    if (signal) request = request.abortSignal(signal);
    const result = await request;
    if (result.error) throw result.error;
    for (const row of result.data || [])
      blocked.add(row.blocker_id === uid ? row.blocked_id : row.blocker_id);
  }
  let request = supabase
    .from("profiles")
    .select(
      "id,slug,full_name,username,avatar_url,position,primary_role,city,club,is_suspended,suspended_until",
    )
    .eq("nationality", article.nationality)
    .eq("is_published", true)
    .order("id")
    .limit(24);
  if (signal) request = request.abortSignal(signal);
  const result = await request;
  if (result.error) throw result.error;
  return (result.data || []).filter(
    (profile) => !blocked.has(profile.id) && !isSuspended(profile),
  );
}
