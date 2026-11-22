import { requireBackend, supabase } from "./supabase";
import { SUPPORTERS_ENABLED } from "./supportersConfig";
import {
  resolveSupporterClubAffinities,
  supporterClubId,
  type ClubAffinityProfile,
  type SupporterClub,
} from "./supporterClubLinks";

const columns = "id,name,short_name,city,logo_url";
function ready() {
  if (!SUPPORTERS_ENABLED)
    throw new Error("L’espace Supporters est temporairement indisponible.");
  requireBackend();
}
export async function getSupporterClub(
  clubId: string,
  signal?: AbortSignal,
): Promise<SupporterClub | null> {
  ready();
  const id = supporterClubId(clubId);
  if (!id) throw new Error("Lien de club invalide.");
  let query = supabase.from("fff_clubs").select(columns).eq("id", id);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Impossible de charger ce club. Réessaie.");
  return data as SupporterClub | null;
}
export async function loadSupporterClubAffinities(
  profile: ClubAffinityProfile,
  signal?: AbortSignal,
) {
  ready();
  if (!supporterClubId(profile.id)) throw new Error("Profil invalide.");
  // A bounded selection, not a scan of the club catalogue or of other profiles.
  let followingQuery = supabase
    .from("club_followers")
    .select(
      "club:fff_clubs!club_followers_club_id_fkey(id,name,short_name,city,logo_url)",
    )
    .eq("profile_id", profile.id)
    .order("id")
    .limit(51);
  if (signal) followingQuery = followingQuery.abortSignal(signal);
  const following = await followingQuery;
  if (following.error)
    throw new Error("Impossible de retrouver tes clubs suivis. Réessaie.");
  const followed = (following.data ?? []).slice(0, 50).flatMap((row) => {
    const club = row.club as unknown as SupporterClub | SupporterClub[] | null;
    return club ? (Array.isArray(club) ? club : [club]) : [];
  });
  const names = [
    ...new Set(
      [
        profile.favorite_pro_club,
        profile.favorite_amateur_club,
        profile.linked_club_id ? null : profile.club,
      ].filter((n): n is string => !!n?.trim()),
    ),
  ];
  const byName = await Promise.all(
    names.map(async (name) => {
      const literal = JSON.stringify(name.trim().replace(/[\\%_]/g, "\\$&"));
      let query = supabase
        .from("fff_clubs")
        .select(columns)
        .or(`name.ilike.${literal},short_name.ilike.${literal}`)
        .limit(2);
      if (signal) query = query.abortSignal(signal);
      const result = await query;
      if (result.error)
        throw new Error("Impossible de retrouver tes clubs favoris. Réessaie.");
      return (result.data ?? []) as SupporterClub[];
    }),
  );
  const current = profile.linked_club_id
    ? await getSupporterClub(profile.linked_club_id, signal)
    : null;
  const candidates = [
    ...new Map(
      [...followed, ...byName.flat(), ...(current ? [current] : [])].map(
        (c) => [c.id, c],
      ),
    ).values(),
  ];
  return {
    ...resolveSupporterClubAffinities(profile, followed, candidates),
    hasMoreFollowed: (following.data?.length ?? 0) > 50,
  };
}
