import { supabase } from "./supabase";
async function requireClubAccount(expectedUid: string) {
  const user = await supabase.auth.getUser();
  if (user.error) throw user.error;
  if (user.data.user?.id !== expectedUid)
    throw new Error("La session a changé. Rechargez cet écran.");
}
export async function requireClubAdmin(id: string, expectedUid?: string) {
  if (expectedUid) await requireClubAccount(expectedUid);
  const { data, error } = await supabase.rpc("is_club_admin", {
    p_club_id: id,
  });
  if (error) throw error;
  if (data !== true)
    throw new Error("Cet espace est réservé aux administrateurs du club.");
}

export async function loadClubAdminAccess(id: string, expectedUid: string) {
  // Do not turn a failed identity check into a staff fallback after an account change.
  await requireClubAccount(expectedUid);
  try {
    await requireClubAdmin(id);
    return { clubAdmin: true };
  } catch (error) {
    const staff = await supabase.rpc("is_native_club_or_team_staff", {
      p_club_id: id,
    });
    if (staff.error || staff.data !== true) throw error;
    return { clubAdmin: false };
  }
}
