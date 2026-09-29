import { supabase } from "./supabase";
export type MemberTeam = { id: string; name: string; category: string | null };
export type TeamMembership = {
  id: string;
  team_id: string;
  is_primary: boolean;
  status: string | null;
  updated_at: string | null;
  team: MemberTeam;
};
export function memberContext(linked: boolean, memberships: TeamMembership[]) {
  const approved = memberships.filter((row) => row.status === "approved");
  return {
    allowed: linked || approved.length > 0,
    primaryTeam:
      (approved.find((row) => row.is_primary) || approved[0])?.team || null,
    memberships,
  };
}
export async function loadClubMembership(clubId: string, uid: string) {
  const auth = await supabase.auth.getUser();
  if (auth.error) throw auth.error;
  if (auth.data.user?.id !== uid)
    throw new Error("La session a changé. Rechargez cet écran.");
  const profile = await supabase
    .from("profiles")
    .select("linked_club_id")
    .eq("id", uid)
    .maybeSingle();
  if (profile.error) throw profile.error;
  const result = await supabase
    .from("team_members")
    .select(
      "id,team_id,is_primary,status,updated_at,team:teams!inner(id,name,category,club_id)",
    )
    .eq("profile_id", uid)
    .eq("is_active", true)
    .eq("team.club_id", clubId)
    .order("is_primary", { ascending: false })
    .order("joined_at", { ascending: false })
    .order("id");
  if (result.error) throw result.error;
  return memberContext(
    profile.data?.linked_club_id === clubId,
    result.data as unknown as TeamMembership[],
  );
}
