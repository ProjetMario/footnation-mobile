export function memberTeamStatus(status: string | null | undefined) {
  if (status === "approved") return "Membre de l’équipe";
  if (status === "pending") return "En attente de validation du coach";
  if (status === "rejected" || status === "declined")
    return "Rattachement non accepté";
  return "Rattachement à vérifier avec le coach";
}

export function teamCalendarPath(clubId: string, teamId?: string | null) {
  return `/club/${encodeURIComponent(clubId)}/member${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`;
}

export function onboardingTeamPath(
  teams: {
    status?: string | null;
    is_primary?: boolean;
    team: { id: string; club_id: string } | null;
  }[],
) {
  const approved = teams.filter(
    (row) => row.status === "approved" && row.team?.club_id,
  );
  const primary = approved.find((row) => row.is_primary) || approved[0];
  if (primary?.team)
    return teamCalendarPath(primary.team.club_id, primary.team.id);
  return teams.length ? "/member/teams" : "/member/invitations";
}
