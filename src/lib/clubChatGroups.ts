import { supabase } from "./supabase";
import { loadClubMembership } from "./clubMembership";
export async function loadClubChatGroups(
  uid: string,
  offset: number,
  clubId?: string,
) {
  if (clubId) {
    const access = await loadClubMembership(clubId, uid);
    if (!access.allowed)
      throw new Error("Vous n’avez plus accès à cet espace membre.");
  } else {
    const auth = await supabase.auth.getUser();
    if (auth.error) throw auth.error;
    if (auth.data.user?.id !== uid)
      throw new Error("La session a changé. Rechargez cet écran.");
  }
  let request = supabase
    .from("club_chat_group_members")
    .select(
      "id,group:club_chat_groups!group_id!inner(id,name,team_category,club_id,club:fff_clubs!club_id(name))",
    )
    .eq("profile_id", uid);
  if (clubId) request = request.eq("group.club_id", clubId);
  const result = await request
    .order("joined_at", { ascending: false })
    .order("id")
    .range(offset, offset + 29);
  if (result.error) throw result.error;
  return result.data as any[];
}
