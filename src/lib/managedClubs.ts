import { supabase } from "./supabase";
export async function loadManagedClubs(uid: string, offset: number) {
  const auth = await supabase.auth.getUser();
  if (auth.error) throw auth.error;
  if (auth.data.user?.id !== uid)
    throw new Error("La session a changé. Rechargez cet écran.");
  const result = await supabase
    .from("club_admins")
    .select("id,club_id")
    .eq("profile_id", uid)
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + 29);
  if (result.error) throw result.error;
  if (!result.data.length) return [];
  const ids = [
    ...new Set(
      result.data
        .map((r) => r.club_id)
        .filter((id): id is string => typeof id === "string" && !!id),
    ),
  ];
  if (!ids.length) return result.data.map((row) => ({ ...row, club: null }));
  const clubs = await supabase
    .from("fff_clubs")
    .select("id,name,short_name,city,logo_url")
    .in("id", ids);
  if (clubs.error) throw clubs.error;
  return result.data.map((row) => ({
    ...row,
    club: clubs.data.find((club) => club.id === row.club_id) || null,
  }));
}
