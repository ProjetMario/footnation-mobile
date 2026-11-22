import type { ClubTeam } from "./clubTeams";
import type { Match } from "./clubFeaturedMatch";

export const SPORT_SEASON = 2026;
export const SPORT_SEASON_LABEL = "2026–2027";
export const isFffTeamId = (id: string) => /^2026_\d+_[A-Z0-9]+_\d+$/.test(id);
type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const rows = (value: unknown): RecordValue[] => Array.isArray(value) ? value.map(object) : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const currentSeason = (value: unknown) => [2026, "2026", "2026-2027", "2026/2027"].includes(value as string | number);
export type FffRanking = {
  key: string; name: string; phase: string; pool: string; status: string; fetchedAt: string;
  rows: { teamId: string; name: string; rank: number | null; played: number | null; points: number | string | null; goalDifference: number | null; won: number | null; drawn: number | null; lost: number | null; goalsFor: number | null; goalsAgainst: number | null }[];
};
export type FffMatch = Match & { datePrecision: "day" | "instant"; sourceStatus: string; homePenalties: number | null; awayPenalties: number | null };
export type FffTeam = ClubTeam & {
  category: string; shortName: string; clubId: string; clubName: string;
  rankings: FffRanking[]; upcomingMatches: FffMatch[]; pastMatches: FffMatch[];
  calendarComplete: boolean; matchesFetchedAt: string; collectionIssues: string[];
};

function match(value: RecordValue): FffMatch | null {
  if (value.season != null && !currentSeason(value.season) || value.source && text(value.source).toLowerCase() !== "fff" || !/^\d+$/.test(text(value.id))) return null;
  const side = (raw: unknown) => {
    const item = object(raw);
    return { id: isFffTeamId(text(item.teamId)) ? text(item.teamId) : "", name: text(item.name) || "Adversaire à confirmer", shortName: "" };
  };
  const status = text(value.status);
  const played = value.played === true;
  const postponed = value.postponed === true || /report/i.test(status);
  return {
    id: `fff:${SPORT_SEASON}:${value.id}`, date: text(value.date), time: text(value.kickoffLocalTime),
    datePrecision: value.datePrecision === "instant" ? "instant" : "day",
    status: postponed ? "postponed" : /annul/i.test(status) ? "cancelled" : played ? "finished" : "scheduled",
    sourceStatus: status, competition: [text(value.competition), text(value.phase), text(value.pool)].filter(Boolean).join(" · "),
    homeTeam: side(value.home), awayTeam: side(value.away),
    homeScore: played ? number(object(value.home).score) : null, awayScore: played ? number(object(value.away).score) : null,
    homePenalties: played ? number(object(value.home).penalties) : null, awayPenalties: played ? number(object(value.away).penalties) : null,
  };
}

// Exact source IDs only. Display names and categories never join clubs or teams.
export function projectFffClub(value: unknown, expectedClubId?: string) {
  const data = object(value), clubId = text(data.siteClubId);
  if (!clubId || expectedClubId && expectedClubId !== clubId || !currentSeason(data.seasonStart ?? data.season)) throw new Error("Données 2026–2027 indisponibles.");
  if (data.source && text(data.source).toLowerCase() !== "fff") throw new Error("Source sportive inattendue.");
  const matches = new Map<string, FffMatch>();
  const teams: FffTeam[] = [];
  const seen = new Set<string>();
  for (const raw of rows(data.teams)) {
    const id = text(raw.id);
    if (!isFffTeamId(id) || !currentSeason(raw.season) || seen.has(id)) continue;
    seen.add(id);
    const teamMatches = new Map<string, FffMatch>();
    for (const item of rows(raw.matches)) {
      const converted = match(item);
      if (converted && [converted.homeTeam.id, converted.awayTeam.id].includes(id)) {
        matches.set(converted.id, converted); teamMatches.set(converted.id, converted);
      }
    }
    const rankings = new Map<string, FffRanking>();
    for (const standing of rows(raw.standingsByCompetition)) {
      if (standing.season != null && !currentSeason(standing.season)) continue;
      const rankingId = text(standing.rankingId).split("_");
      const key = [standing.id, standing.phaseId ?? rankingId[1], standing.poolId ?? rankingId[2]].map(String).join(":");
      rankings.set(key, {
        key, name: text(standing.name), phase: text(standing.phase), pool: text(standing.pool), status: text(standing.status), fetchedAt: text(standing.fetchedAt),
        rows: rows(standing.rows).map(row => ({teamId: text(row.teamId), name: text(row.name), rank: number(row.rank), played: number(row.played), points: typeof row.points === "string" ? row.points : number(row.points), goalDifference: number(row.goalDifference), won: number(row.won), drawn: number(row.drawn), lost: number(row.lost), goalsFor: number(row.goalsFor), goalsAgainst: number(row.goalsAgainst)})),
      });
    }
    const category = [text(raw.categoryLabel) || text(raw.name), text(raw.gender), raw.displayCode].filter(value => value !== undefined && value !== "").join(" ");
    const all = sortMatches([...teamMatches.values()]);
    const categoryCode = text(raw.categoryCode) || id.split("_")[2];
    const genderCode = text(raw.gender) || (categoryCode.endsWith("F") ? "F" : categoryCode.endsWith("M") ? "M" : "");
    const displayNumber = number(raw.displayCode) ?? (Number(text(raw.name).match(/\s(\d+)$/)?.[1]) || null);
    const competitions = [...new Set([...rankings.values()].sort((a,b) => Number(!!b.rows.length) - Number(!!a.rows.length)).map(r => r.name).filter(Boolean))];
    const upcomingMatches = all.filter(m => m.status !== "finished"), pastMatches = all.filter(m => m.status === "finished").reverse();
    teams.push({ id, name: text(raw.name), category, shortName: category, displayNumber, genderCode, discipline: /futsal/i.test(text(raw.name)) || categoryCode === "SESM" ? "futsal" : categoryCode === "FL" ? "loisir" : "football", competitions, sportsSummary: {results: pastMatches.length, upcoming: upcomingMatches.length, rankings: [...rankings.values()].filter(r => r.rows.length).length}, calendarComplete: object(raw.matchesCoverage).completeSeason === true && !!text(raw.matchesFetchedAt), matchesFetchedAt: text(raw.matchesFetchedAt), collectionIssues: Array.isArray(raw.collectionIssues) ? raw.collectionIssues.filter((v): v is string => typeof v === "string") : [], clubId, clubName: text(data.siteName), competition: {name: competitions.join(" · ")}, rankings: [...rankings.values()], upcomingMatches, pastMatches });
  }
  const all = sortMatches([...matches.values()]);
  return { club: { id: clubId, name: text(data.siteName) }, season: SPORT_SEASON_LABEL, status: text(data.status), stale: object(data.freshness).stale === true, checkedAt: text(object(data.freshness).lastSuccessAt), teams, upcomingMatches: all.filter(m => m.status !== "finished"), pastMatches: all.filter(m => m.status === "finished").reverse() };
}
function sortMatches(matches: FffMatch[]) { return matches.sort((a,b) => (a.date || "9999").localeCompare(b.date || "9999") || a.time.localeCompare(b.time) || a.id.localeCompare(b.id)); }

export function fffCoverageMessage(status: string, stale: boolean) {
  if (["no_teams", "no_teams_published"].includes(status)) return "Aucune équipe publiée pour la saison 2026–2027.";
  if (["unverified", "identity_unverified"].includes(status)) return "L’affiliation de ce club reste à vérifier.";
  if (status === "pending") return "Les données 2026–2027 de ce club sont en attente de collecte.";
  if (["unavailable", "source_unavailable"].includes(status)) return "Source indisponible. Les dernières données vérifiées sont conservées.";
  if (status === "partial") return "Collecte partielle : certaines équipes ou compétitions restent à vérifier.";
  return stale ? "Actualisation en attente : les dernières données vérifiées sont affichées." : null;
}
