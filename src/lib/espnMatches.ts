import { calendarDate, validCalendarDate } from "./calendarDate";
import { NATIONAL_LEAGUES } from "./nationalMatches";
import type {
  MatchDTO,
  MatchesApiResponse,
  TeamInfo,
  TournamentInfo,
} from "../types/matches";

export const ESPN_LEAGUES = [
  "fra.1",
  "eng.1",
  "esp.1",
  "ita.1",
  "ger.1",
  "uefa.champions",
] as const;
type EspnLeague =
  (typeof ESPN_LEAGUES)[number] | (typeof NATIONAL_LEAGUES)[number];
type JsonObject = Record<string, unknown>;
const serviceMessage = "Les scores ESPN sont temporairement indisponibles.";

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function identifier(value: unknown) {
  const id = text(value);
  return /^[1-9]\d{0,19}$/.test(id) ? id : null;
}
function validLeague(league: string): league is EspnLeague {
  return ([...ESPN_LEAGUES, ...NATIONAL_LEAGUES] as readonly string[]).includes(
    league,
  );
}
export function espnLeagueFromId(id: string): string | undefined {
  const match = /^espn:([^:]+):([1-9]\d{0,19})$/.exec(id);
  return match && validLeague(match[1]) ? match[1] : undefined;
}
export function isEspnMatchId(id: string): boolean {
  return espnLeagueFromId(id) !== undefined;
}
function httpsLogo(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
function teamLogo(data: JsonObject): string | null {
  const direct = httpsLogo(data.logo);
  if (direct) return direct;
  if (!Array.isArray(data.logos)) return null;
  for (const candidate of data.logos) {
    const logo = object(candidate);
    if (!logo) continue;
    const href = httpsLogo(logo.href) || httpsLogo(logo.url);
    if (href) return href;
  }
  return null;
}
function team(value: unknown): TeamInfo | null {
  const data = object(value);
  if (!data) return null;
  const name = text(data.displayName) || text(data.name);
  if (!name) return null;
  const id = identifier(data.id);
  return {
    id: id ? `espn:team:${id}` : null,
    name,
    shortName: text(data.abbreviation) || text(data.shortDisplayName) || null,
    logo: teamLogo(data),
  };
}
function score(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const raw = typeof value === "string" ? value.trim() : String(value);
  if (!/^\d+$/.test(raw)) return null;
  const result = Number(raw);
  return Number.isSafeInteger(result) ? result : null;
}
function normalizedStatus(status: JsonObject | null) {
  const type = object(status?.type);
  if (!type) return null;
  const name = text(type.name);
  const description = text(type.description);
  const raw = `${name} ${description}`;
  const detail = text(type.detail) || text(type.shortDetail) || null;
  if (/postpon|cancel|abandon|suspend|interrupt/i.test(raw)) {
    return {
      status: "SCHEDULED" as const,
      label: description || name,
      raw: name || description,
      detail,
      scored: false,
      minute: null,
    };
  }
  if (type.state === "post" && type.completed === true) {
    const label = /penalt/i.test(raw)
      ? "AP"
      : /extra.time|overtime/i.test(raw)
        ? "AET"
        : "FT";
    return {
      status: "FINISHED" as const,
      label,
      raw: label,
      detail,
      scored: true,
      minute: null,
    };
  }
  if (type.state === "in" && type.completed !== true) {
    const label = /half.?time|halftime/i.test(raw)
      ? "HT"
      : /penalt/i.test(raw)
        ? "PEN"
        : /extra.time|overtime/i.test(raw)
          ? "ET"
          : "LIVE";
    return {
      status: "LIVE" as const,
      label,
      raw: label,
      detail,
      scored: true,
      minute: text(status?.displayClock) || null,
    };
  }
  if (type.state === "pre" && type.completed !== true) {
    // ESPN sends score="0" even before kickoff. These are not observed scores.
    return {
      status: "SCHEDULED" as const,
      label: "NS",
      raw: "NS",
      detail,
      scored: false,
      minute: null,
    };
  }
  return null;
}

/** fetchedAt records our read time, not a provider-guaranteed score update time. */
export function parseEspnScoreboard(
  payload: unknown,
  league: string,
  fetchedAt: string,
): MatchesApiResponse[] {
  if (!validLeague(league) || !Number.isFinite(Date.parse(fetchedAt)))
    throw new Error(serviceMessage);
  const data = object(payload);
  const metadata = Array.isArray(data?.leagues)
    ? data.leagues.map(object).find((item) => item?.slug === league)
    : undefined;
  if (!data || !Array.isArray(data.events) || !metadata || !text(metadata.name))
    throw new Error(serviceMessage);
  const tournament: TournamentInfo = {
    id: `espn:${league}`,
    name: text(metadata.name),
    slug: league,
    code: text(metadata.abbreviation) || league,
  };
  const days = new Map<string, MatchesApiResponse>();
  const seen = new Set<string>();
  for (const value of data.events) {
    const event = object(value);
    const id = identifier(event?.id);
    const competition = Array.isArray(event?.competitions)
      ? event.competitions.map(object).find(Boolean)
      : null;
    if (
      !event ||
      !id ||
      !competition ||
      !Array.isArray(competition.competitors)
    )
      continue;
    const kickoff = text(event.date) || text(competition.date);
    const at = new Date(kickoff);
    if (
      !validCalendarDate(kickoff.slice(0, 10)) ||
      !Number.isFinite(at.getTime())
    )
      continue;
    const date = calendarDate(at);
    const competitors = competition.competitors.map(object);
    const homeData = competitors.find((item) => item?.homeAway === "home");
    const awayData = competitors.find((item) => item?.homeAway === "away");
    const home = team(homeData?.team);
    const away = team(awayData?.team);
    const state = normalizedStatus(
      object(competition.status) || object(event.status),
    );
    if (!home || !away || !state) continue;
    const externalId = `espn:${league}:${id}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    const match: MatchDTO = {
      external_match_id: externalId,
      tournament,
      home,
      away,
      kickoff_at: at.toISOString(),
      status: state.status,
      status_label: state.label,
      score: {
        home: state.scored ? score(homeData?.score) : null,
        away: state.scored ? score(awayData?.score) : null,
      },
      venue: text(object(competition.venue)?.fullName) || null,
      round: text(object(event.week)?.text) || null,
      extra: {
        raw_status: state.raw,
        live_minute: state.minute,
        status_detail: state.detail,
      },
    };
    let day = days.get(date);
    if (!day) {
      day = {
        date,
        fetched_at: fetchedAt,
        matches: [],
        tournaments: [tournament],
        teams: [],
        source: "espn",
      };
      days.set(date, day);
    }
    day.matches.push(match);
    for (const member of [home, away])
      if (
        !day.teams.some(
          (existing) =>
            (existing.id || existing.name) === (member.id || member.name),
        )
      )
        day.teams.push(member);
  }
  if (data.events.length && !seen.size) throw new Error(serviceMessage);
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function abortError() {
  const error = new Error("Chargement des matchs annulé.");
  error.name = "AbortError";
  return error;
}
function offsetDate(date: string, offset: number) {
  if (!validCalendarDate(date)) throw new Error("Date de match invalide.");
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + offset);
  return calendarDate(value);
}
class UnsupportedDateRange extends Error {}

async function fetchLeagueRequest(
  league: string,
  from: string,
  to: string,
  signal?: AbortSignal,
) {
  if (
    !validLeague(league) ||
    !validCalendarDate(from) ||
    !validCalendarDate(to)
  )
    throw new Error("Requête de match invalide.");
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 10_000);
  const fetchedAt = new Date().toISOString();
  const dates =
    from === to
      ? from.replace(/-/g, "")
      : `${from.replace(/-/g, "")}-${to.replace(/-/g, "")}`;
  let rejectAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(abortError());
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
  });
  try {
    const request = async () => {
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${dates}&limit=100`,
        { signal: controller.signal, headers: { Accept: "application/json" } },
      );
      if (response.status === 400 && from !== to)
        throw new UnsupportedDateRange(serviceMessage);
      if (!response.ok) throw new Error(serviceMessage);
      const payload: unknown = await response.json();
      if (controller.signal.aborted) throw abortError();
      return {
        days: parseEspnScoreboard(payload, league, fetchedAt),
        fetchedAt,
      };
    };
    return await Promise.race([request(), aborted]);
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (timedOut) throw new Error("Le chargement des scores ESPN a expiré.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
    if (rejectAbort)
      controller.signal.removeEventListener("abort", rejectAbort);
  }
}

// Soccer providers can reject ranges while still serving individual days.
// Sequential daily requests preserve the limit of three concurrent leagues.
async function fetchLeague(
  league: string,
  from: string,
  to: string,
  signal?: AbortSignal,
) {
  try {
    return await fetchLeagueRequest(league, from, to, signal);
  } catch (error) {
    if (!(error instanceof UnsupportedDateRange)) throw error;
  }
  const days: MatchesApiResponse[] = [];
  let fetchedAt = new Date().toISOString();
  for (let date = from; date <= to; date = offsetDate(date, 1)) {
    if (signal?.aborted) throw abortError();
    const result = await fetchLeagueRequest(league, date, date, signal);
    days.push(...result.days);
    if (result.fetchedAt < fetchedAt) fetchedAt = result.fetchedAt;
  }
  return { days: mergeDays(days), fetchedAt };
}

function mergeDays(days: MatchesApiResponse[]) {
  const merged = new Map<string, MatchesApiResponse>();
  for (const day of days) {
    const current = merged.get(day.date);
    if (!current) {
      merged.set(day.date, {
        ...day,
        matches: [...day.matches],
        teams: [...day.teams],
        tournaments: [...day.tournaments],
      });
      continue;
    }
    if (day.fetched_at < current.fetched_at)
      current.fetched_at = day.fetched_at;
    for (const match of day.matches)
      if (
        !current.matches.some(
          (existing) => existing.external_match_id === match.external_match_id,
        )
      )
        current.matches.push(match);
    for (const member of day.teams)
      if (
        !current.teams.some(
          (existing) =>
            (existing.id || existing.name) === (member.id || member.name),
        )
      )
        current.teams.push(member);
    for (const tournament of day.tournaments)
      if (
        !current.tournaments.some((existing) => existing.id === tournament.id)
      )
        current.tournaments.push(tournament);
  }
  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchFeaturedScoreboard(
  today: string,
  signal?: AbortSignal,
  daysBack = 14,
): Promise<{ days: MatchesApiResponse[]; incomplete: boolean }> {
  if (
    !validCalendarDate(today) ||
    !Number.isInteger(daysBack) ||
    daysBack < 0 ||
    daysBack > 14
  )
    throw new Error("Période de match invalide.");
  const from = offsetDate(today, -daysBack);
  // ESPN filters its calendar separately from the device's local day. Fetch
  // adjacent dates too, then retain only the requested local window below.
  const requestFrom = offsetDate(from, -1);
  const requestTo = offsetDate(today, 1);
  const days: MatchesApiResponse[] = [];
  let succeeded = 0;
  let incomplete = false;
  // Two bounded batches; a failed league does not hide the others' real results.
  for (let start = 0; start < ESPN_LEAGUES.length; start += 3) {
    if (signal?.aborted) throw abortError();
    const results = await Promise.allSettled(
      ESPN_LEAGUES.slice(start, start + 3).map((league) =>
        fetchLeague(league, requestFrom, requestTo, signal),
      ),
    );
    if (signal?.aborted) throw abortError();
    for (const result of results) {
      if (result.status === "fulfilled") {
        succeeded++;
        days.push(
          ...result.value.days.filter(
            (day) => day.date >= from && day.date <= today,
          ),
        );
      } else incomplete = true;
    }
  }
  if (!succeeded) throw new Error(serviceMessage);
  return { days: mergeDays(days), incomplete };
}

export async function fetchUpcomingFeaturedScoreboard(
  today: string,
  signal?: AbortSignal,
  daysAhead = 14,
): Promise<{ days: MatchesApiResponse[]; incomplete: boolean }> {
  if (
    !validCalendarDate(today) ||
    !Number.isInteger(daysAhead) ||
    daysAhead < 1 ||
    daysAhead > 14
  )
    throw new Error("Période de match invalide.");
  const to = offsetDate(today, daysAhead);
  // Adjacent dates cover UTC/local-calendar offsets around midnight.
  const requestFrom = offsetDate(today, -1);
  const requestTo = offsetDate(to, 1);
  const days: MatchesApiResponse[] = [];
  let succeeded = 0;
  let incomplete = false;
  for (let start = 0; start < ESPN_LEAGUES.length; start += 3) {
    if (signal?.aborted) throw abortError();
    const results = await Promise.allSettled(
      ESPN_LEAGUES.slice(start, start + 3).map((league) =>
        fetchLeague(league, requestFrom, requestTo, signal),
      ),
    );
    if (signal?.aborted) throw abortError();
    for (const result of results) {
      if (result.status === "fulfilled") {
        succeeded++;
        days.push(
          ...result.value.days.filter(
            (day) => day.date >= today && day.date <= to,
          ),
        );
      } else incomplete = true;
    }
  }
  if (!succeeded) throw new Error(serviceMessage);
  return { days: mergeDays(days), incomplete };
}

export async function fetchEspnMatchDay(
  league: string,
  date: string,
  signal?: AbortSignal,
): Promise<MatchesApiResponse> {
  // Adjacent UTC days cover local-calendar offsets for deep links after midnight.
  const result = await fetchLeague(
    league,
    offsetDate(date, -1),
    offsetDate(date, 1),
    signal,
  );
  const days = mergeDays(result.days);
  return {
    date,
    fetched_at: result.fetchedAt,
    source: "espn",
    matches: days.flatMap((day) => day.matches),
    tournaments: [
      ...new Map(
        days
          .flatMap((day) => day.tournaments)
          .map((tournament) => [tournament.id, tournament]),
      ).values(),
    ],
    teams: [
      ...new Map(
        days
          .flatMap((day) => day.teams)
          .map((member) => [member.id || member.name, member]),
      ).values(),
    ],
  };
}

export async function fetchNationalMatchDay(
  date: string,
  signal?: AbortSignal,
): Promise<MatchesApiResponse> {
  if (!validCalendarDate(date)) throw new Error("Date de match invalide.");
  // Query the UTC dates intersecting the requested local day. Single dates are
  // supported by these scoreboards; ranges are rejected by the soccer API.
  const from = new Date(`${date}T00:00:00`).toISOString().slice(0, 10);
  const to = new Date(`${date}T23:59:59`).toISOString().slice(0, 10);
  const days: MatchesApiResponse[] = [];
  let succeeded = 0;
  let incomplete = false;
  for (let start = 0; start < NATIONAL_LEAGUES.length; start += 3) {
    if (signal?.aborted) throw abortError();
    const results = await Promise.allSettled(
      NATIONAL_LEAGUES.slice(start, start + 3).map(async (league) => {
        const results = [];
        for (let utcDay = from; utcDay <= to; utcDay = offsetDate(utcDay, 1)) {
          results.push(
            await fetchLeagueRequest(league, utcDay, utcDay, signal),
          );
        }
        return results.flatMap((result) => result.days);
      }),
    );
    if (signal?.aborted) throw abortError();
    for (const result of results) {
      if (result.status === "fulfilled") {
        succeeded++;
        days.push(...result.value.filter((day) => day.date === date));
      } else incomplete = true;
    }
  }
  if (!succeeded)
    throw new Error(
      "Les matchs des nations sont temporairement indisponibles.",
    );
  const merged = mergeDays(days)[0];
  return {
    date,
    fetched_at: merged?.fetched_at || new Date().toISOString(),
    source: "espn",
    matches: merged?.matches || [],
    teams: merged?.teams || [],
    tournaments: merged?.tournaments || [],
    incomplete,
  };
}
