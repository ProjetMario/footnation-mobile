import { supabase } from "./supabase";

export type CalendarEditorTeam = {
  id: string;
  name: string;
  category: string | null;
  is_active: boolean | null;
};
async function requireAccount(uid: string) {
  const auth = await supabase.auth.getUser();
  if (auth.error) throw auth.error;
  if (auth.data.user?.id !== uid)
    throw new Error("Votre session a changé. Rouvrez le calendrier.");
}

export async function loadCalendarEditorContext(clubId: string, uid: string) {
  await requireAccount(uid);
  const [club, teams] = await Promise.all([
    supabase.rpc("can_manage_native_calendar_event", {
      p_club_id: clubId,
      p_team_id: null,
    }),
    supabase.rpc("get_native_calendar_editor_teams", { p_club_id: clubId }),
  ]);
  if (club.error) throw club.error;
  if (teams.error) throw teams.error;
  if (!club.data && !teams.data?.length)
    throw new Error(
      "Cet espace est réservé au coach de l’équipe et aux responsables du club.",
    );
  return {
    clubAllowed: club.data === true,
    teams: teams.data as CalendarEditorTeam[],
  };
}

export async function requireCalendarEventAccess(
  clubId: string,
  uid: string,
  teamId?: string | null,
) {
  await requireAccount(uid);
  const result = await supabase.rpc("can_manage_native_calendar_event", {
    p_club_id: clubId,
    p_team_id: teamId || null,
  });
  if (result.error) throw result.error;
  if (result.data !== true)
    throw new Error(
      "Choisissez une équipe dont vous êtes le coach, ou contactez un responsable du club.",
    );
}
