import { supabase } from "./supabase";
async function requireClubAccount(expectedUid: string) {
  const user = await supabase.auth.getUser();
  if (user.error) throw user.error;
  if (user.data.user?.id !== expectedUid)
    throw new Error("La session a changé. Rechargez cet écran.");
}
export async function requireClubAdmin(id: string, expectedUid?: string) {
  if (!(await loadClubAdminStatus(id, expectedUid)))
    throw new Error("Cet espace est réservé aux administrateurs du club.");
}

export async function loadClubAdminStatus(id: string, expectedUid?: string) {
  if (expectedUid) await requireClubAccount(expectedUid);
  const { data, error } = await supabase.rpc("can_manage_native_calendar_event", {
    p_club_id: id,
    p_team_id: null,
  });
  if (error) throw error;
  if (data !== true && data !== false)
    throw new Error("Impossible de vérifier les droits du club.");
  return data === true;
}

export async function loadClubAdminAccess(id: string, expectedUid: string) {
  // Do not turn a failed identity check into a staff fallback after an account change.
  await requireClubAccount(expectedUid);
  const clubAdmin = await loadClubAdminStatus(id);
  if (!clubAdmin) {
    const teams = await supabase.rpc("get_native_calendar_editor_teams", {
      p_club_id: id,
    });
    if (teams.error) throw teams.error;
    if (!Array.isArray(teams.data) || !teams.data.some((team) => team && typeof team.id === "string" && team.is_active === true))
      throw new Error("Cet espace est réservé aux administrateurs et aux coachs approuvés du club.");
  }
  // A login can change while the permission requests are in flight.
  await requireClubAccount(expectedUid);
  return { clubAdmin };
}
