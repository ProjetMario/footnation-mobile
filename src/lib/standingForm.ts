export const standingLabels = {
  team_name: "Équipe",
  position: "Rang",
  played: "Matchs joués",
  wins: "Victoires",
  draws: "Matchs nuls",
  losses: "Défaites",
  goals_for: "Buts marqués",
  goals_against: "Buts encaissés",
  points: "Points",
} as const;
export const standingFields = [...Object.keys(standingLabels), "is_own_team"];
export function standingPayload(
  values: Record<string, string>,
  ownTeam: boolean,
) {
  const result: Record<string, string | number | boolean | null> = {
    team_name: values.team_name?.trim() || "",
    is_own_team: ownTeam,
  };
  if (!result.team_name) throw new Error("Le nom de l’équipe est obligatoire.");
  for (const key of Object.keys(standingLabels).filter(
    (key) => key !== "team_name",
  )) {
    const value = values[key]?.trim() || "";
    if (!value) {
      result[key] = null;
      continue;
    }
    const n = Number(value);
    if (
      !/^-?\d+$/.test(value) ||
      !Number.isInteger(n) ||
      n > 2147483647 ||
      n < (key === "points" ? -2147483648 : key === "position" ? 1 : 0)
    )
      throw new Error(
        `Valeur invalide : ${standingLabels[key as keyof typeof standingLabels]}.`,
      );
    result[key] = n;
  }
  // Points remain independent: competition rules and disciplinary deductions vary.
  return result;
}
