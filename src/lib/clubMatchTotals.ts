import { supabase } from "./supabase";
export type ClubMatchTotals = {
  finished: number;
  scored: number;
  missing: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};
export async function loadClubMatchTotals(
  clubId: string,
  authorize: () => Promise<void>,
): Promise<ClubMatchTotals> {
  const totals: ClubMatchTotals = {
    finished: 0,
    scored: 0,
    missing: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
  for (let offset = 0; ; offset += 500) {
    await authorize();
    const { data, error } = await supabase
      .from("club_matches")
      .select("id,home_score,away_score,is_home")
      .eq("club_id", clubId)
      .eq("status", "finished")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    for (const match of data) {
      totals.finished++;
      if (
        !Number.isInteger(match.home_score) ||
        !Number.isInteger(match.away_score) ||
        match.home_score < 0 ||
        match.away_score < 0 ||
        typeof match.is_home !== "boolean"
      ) {
        totals.missing++;
        continue;
      }
      const ours = match.is_home ? match.home_score : match.away_score;
      const theirs = match.is_home ? match.away_score : match.home_score;
      totals.scored++;
      totals.goalsFor += ours;
      totals.goalsAgainst += theirs;
      if (ours > theirs) totals.wins++;
      else if (ours < theirs) totals.losses++;
      else totals.draws++;
    }
    if (data.length < 500) return totals;
  }
}
