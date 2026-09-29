import { espnLeagueFromId } from "./espnMatches";

type Json = Record<string, unknown>;
export type MatchGoal = {
  id: string;
  player: string;
  team: string;
  side: "home" | "away" | null;
  minute: string;
  seconds: number;
  assist: string | null;
  ownGoal: boolean;
  penalty: boolean;
};
export type MatchStatistic = {
  key: string;
  label: string;
  home: number | null;
  away: number | null;
  percent: boolean;
};
export type EspnMatchDetails = {
  goals: MatchGoal[];
  statistics: MatchStatistic[];
  goalsAvailable: boolean;
  referee: string | null;
  attendance: number | null;
  fetchedAt: string;
};
const message = "Les détails ESPN sont temporairement indisponibles.";
const object = (v: unknown): Json | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const objects = (v: unknown) =>
  Array.isArray(v) ? v.map(object).filter((x): x is Json => !!x) : [];
function number(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const value = String(v).trim().replace(/%$/, "");
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
const STATISTICS = [
  ["possessionPct", "Possession", true],
  ["totalShots", "Tirs", false],
  ["shotsOnTarget", "Tirs cadrés", false],
  ["blockedShots", "Tirs contrés", false],
  ["wonCorners", "Corners", false],
  ["saves", "Arrêts", false],
  ["foulsCommitted", "Fautes commises", false],
  ["yellowCards", "Cartons jaunes", false],
  ["redCards", "Cartons rouges", false],
  ["offsides", "Hors-jeu", false],
  ["totalPasses", "Passes", false],
  ["accuratePasses", "Passes réussies", false],
  ["passAccuracy", "Précision des passes", true],
  ["totalCrosses", "Centres", false],
  ["accurateCrosses", "Centres réussis", false],
  ["totalTackles", "Tacles", false],
  ["interceptions", "Interceptions", false],
  ["totalClearance", "Dégagements", false],
] as const;

/** Keep unknown values missing, and align teams by identity rather than array order. */
export function parseEspnMatchDetails(
  payload: unknown,
  id: string,
  fetchedAt: string,
): EspnMatchDetails {
  const data = object(payload);
  const header = object(data?.header);
  if (
    !espnLeagueFromId(id) ||
    text(header?.id) !== id.split(":")[2] ||
    !Number.isFinite(Date.parse(fetchedAt))
  )
    throw new Error(message);
  const competition = objects(header?.competitions).find(
    (c) => text(c.id) === text(header?.id),
  );
  const competitors = objects(competition?.competitors);
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  const homeId = text(object(home?.team)?.id);
  const awayId = text(object(away?.team)?.id);
  if (!homeId || !awayId || homeId === awayId) throw new Error(message);
  const teams = objects(object(data?.boxscore)?.teams);
  function statsFor(teamId: string) {
    const entry = teams.find((t) => text(object(t.team)?.id) === teamId);
    const stats = new Map<string, number | null>();
    for (const stat of objects(entry?.statistics))
      stats.set(text(stat.name), number(stat.displayValue ?? stat.value));
    const total = stats.get("totalPasses"),
      accurate = stats.get("accuratePasses");
    // ESPN's rounded passPct (e.g. 0.8) loses precision; use the supplied counts.
    if (total != null && total > 0 && accurate != null && accurate <= total)
      stats.set("passAccuracy", Math.round((accurate / total) * 1000) / 10);
    return stats;
  }
  const homeStats = statsFor(homeId),
    awayStats = statsFor(awayId);
  const statistics = STATISTICS.map(([key, label, percent]) => ({
    key,
    label,
    percent,
    home: homeStats.get(key) ?? null,
    away: awayStats.get(key) ?? null,
  })).filter((stat) => stat.home !== null || stat.away !== null);
  const seen = new Set<string>();
  const goals: MatchGoal[] = [];
  for (const event of objects(data?.keyEvents)) {
    if (
      event.scoringPlay !== true ||
      event.shootout === true ||
      number(object(event.period)?.number) === 5
    )
      continue;
    const type = `${text(object(event.type)?.type)} ${text(object(event.type)?.text)}`;
    if (/disallow|cancel|miss|saved/i.test(type)) continue;
    const participants = objects(event.participants);
    const player = text(object(participants[0]?.athlete)?.displayName);
    const eventId = text(event.id);
    if (!player || !eventId || seen.has(eventId)) continue;
    seen.add(eventId);
    const teamId = text(object(event.team)?.id);
    const ownGoal = /own[ -]?goal/i.test(type);
    const penalty = /penalty/i.test(type);
    const secondPlayer = text(object(participants[1]?.athlete)?.displayName);
    goals.push({
      id: eventId,
      player,
      team: text(object(event.team)?.displayName),
      side: teamId === homeId ? "home" : teamId === awayId ? "away" : null,
      minute: text(object(event.clock)?.displayValue) || "Minute non précisée",
      seconds: number(object(event.clock)?.value) ?? Number.MAX_SAFE_INTEGER,
      // Never infer an assist for a penalty or an own goal.
      assist: !ownGoal && !penalty && secondPlayer ? secondPlayer : null,
      ownGoal,
      penalty,
    });
  }
  goals.sort((a, b) => a.seconds - b.seconds);
  const gameInfo = object(data?.gameInfo);
  const referee = objects(gameInfo?.officials).find(
    (o) => text(object(o.position)?.name) === "Referee",
  );
  const attendance = number(gameInfo?.attendance);
  return {
    goals,
    statistics,
    goalsAvailable: Array.isArray(data?.keyEvents),
    referee: text(referee?.displayName) || text(referee?.fullName) || null,
    attendance: attendance && attendance > 0 ? attendance : null,
    fetchedAt,
  };
}

export async function fetchEspnMatchDetails(
  id: string,
  signal?: AbortSignal,
): Promise<EspnMatchDetails> {
  const league = espnLeagueFromId(id);
  if (!league) throw new Error("Identifiant de match invalide.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  const abortError = () =>
    Object.assign(new Error("Chargement annulé."), { name: "AbortError" });
  if (signal?.aborted) throw abortError();
  signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 10_000);
  try {
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${id.split(":")[2]}`,
      { signal: controller.signal, headers: { Accept: "application/json" } },
    );
    if (!response.ok) throw new Error(message);
    const payload: unknown = await response.json();
    if (controller.signal.aborted) throw abortError();
    return parseEspnMatchDetails(payload, id, new Date().toISOString());
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (timedOut)
      throw new Error("Le chargement des détails du match a expiré.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
