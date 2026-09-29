export type FffTeamSource = {
  id: string;
  club_id: string;
  name: string | null;
  category: string | null;
  age_range: string | null;
  division: string | null;
  level: string | null;
  updated_at: string | null;
};
export type ManagedTeam = {
  id: string;
  name: string;
  category: string;
  age_group: string | null;
  season: string;
  native_fff_team_id?: string | null;
};
export type TeamImportRow = { source: FffTeamSource; target_id: string };
export const importUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (value: string | null | undefined) =>
  (value || "").trim().toLocaleLowerCase("fr");
export function validImportSeason(value: string): boolean {
  return (
    /^\d{4}-\d{4}$/.test(value) &&
    Number(value.slice(5)) === Number(value.slice(0, 4)) + 1
  );
}
export function importTeamState(
  source: FffTeamSource,
  teams: ManagedTeam[],
  season: string,
): "ready" | "incomplete" | "imported" | "conflict" {
  if (!source.name?.trim() || !source.category?.trim()) return "incomplete";
  const sameSeason = teams.filter((team) => team.season === season);
  if (sameSeason.some((team) => team.native_fff_team_id === source.id))
    return "imported";
  if (
    sameSeason.some(
      (team) =>
        clean(team.name) === clean(source.name) &&
        clean(team.category) === clean(source.category) &&
        clean(team.age_group) === clean(source.age_range),
    )
  )
    return "conflict";
  return "ready";
}
export function buildTeamImportPlan(
  clubId: string,
  season: string,
  selected: FffTeamSource[],
  teams: ManagedTeam[],
  randomId: () => string,
): TeamImportRow[] {
  if (!importUuid.test(clubId) || !validImportSeason(season))
    throw new Error("Indiquez une saison au format 2026-2027.");
  if (
    !selected.length ||
    selected.length > 50 ||
    new Set(selected.map((row) => row.id)).size !== selected.length
  )
    throw new Error("Sélectionnez entre 1 et 50 équipes distinctes.");
  const seen = new Set<string>();
  return selected.map((source) => {
    if (
      !importUuid.test(source.id) ||
      source.club_id !== clubId ||
      importTeamState(source, teams, season) !== "ready"
    )
      throw new Error(
        "Une équipe est incomplète, déjà présente ou ne correspond plus à ce club.",
      );
    const signature = [
      clean(source.name),
      clean(source.category),
      clean(source.age_range),
    ].join("\u0000");
    if (seen.has(signature))
      throw new Error(
        "Plusieurs fiches désignent une équipe identique. Vérifiez la source avant de continuer.",
      );
    seen.add(signature);
    const target_id = randomId();
    if (!importUuid.test(target_id))
      throw new Error("Impossible de préparer l’import.");
    return { source: { ...source }, target_id };
  });
}
export type AssignmentMember = {
  id: string;
  full_name: string | null;
  assignments: { team_id: string; is_primary: boolean }[];
};
export function buildAssignmentPlan(members: AssignmentMember[]) {
  if (
    !members.length ||
    members.length > 50 ||
    new Set(members.map((member) => member.id)).size !== members.length
  )
    throw new Error("Choisissez entre 1 et 50 membres distincts.");
  return members.map((member) => {
    if (!importUuid.test(member.id)) throw new Error("Membre invalide.");
    const primary = member.assignments.filter(
      (assignment) => assignment.is_primary,
    );
    if (primary.length > 1)
      throw new Error(
        "Un membre possède plusieurs équipes principales. Corrigez ce conflit avant l’affectation groupée.",
      );
    if (primary[0] && !importUuid.test(primary[0].team_id))
      throw new Error("Affectation invalide.");
    return {
      profile_id: member.id,
      expected_team_id: primary[0]?.team_id || null,
    };
  });
}
