import { calendarDate, validCalendarDate } from "./calendarDate";
import type { MatchDTO, MatchesApiResponse } from "../types/matches";

export type FeaturedMatch = {
  match: MatchDTO;
  date: string;
  state: "live" | "finished" | "scheduled" | "unknown";
  stale: boolean;
  fetchedAt: string;
};

const normalize = (value: unknown) =>
  typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    : "";

// Full aliases avoid false positives such as OM matching Como or OL matching Bolton.
const majorClubs = new Set([
  "psg",
  "paris sg",
  "paris saint germain",
  "paris saint germain fc",
  "om",
  "marseille",
  "olympique marseille",
  "olympique de marseille",
  "ol",
  "lyon",
  "olympique lyon",
  "olympique lyonnais",
  "ol lyonnes",
  "as monaco",
  "monaco",
  "lille",
  "losc",
  "lille osc",
  "rc lens",
  "lens",
  "manchester united",
  "man united",
  "man utd",
  "manchester city",
  "man city",
  "liverpool",
  "liverpool fc",
  "chelsea",
  "chelsea fc",
  "arsenal",
  "arsenal fc",
  "tottenham",
  "tottenham hotspur",
  "newcastle united",
  "real madrid",
  "real madrid cf",
  "barcelona",
  "fc barcelona",
  "atletico madrid",
  "atletico de madrid",
  "sevilla",
  "sevilla fc",
  "bayern munich",
  "bayern munchen",
  "fc bayern munchen",
  "fc bayern",
  "borussia dortmund",
  "bayer leverkusen",
  "bayer 04 leverkusen",
  "rb leipzig",
  "juventus",
  "juventus fc",
  "inter",
  "inter milan",
  "internazionale",
  "fc internazionale milano",
  "ac milan",
  "milan",
  "napoli",
  "ssc napoli",
  "as roma",
  "roma",
  "atalanta",
  "benfica",
  "sl benfica",
  "porto",
  "fc porto",
  "sporting cp",
  "sporting lisbon",
  "ajax",
  "ajax amsterdam",
  "afc ajax",
  "psv",
  "psv eindhoven",
  "galatasaray",
  "fenerbahce",
]);

export function majorClub(name: string) {
  return majorClubs.has(normalize(name));
}

export function matchState(match: MatchDTO): FeaturedMatch["state"] {
  const raw = [
    match.extra?.raw_status,
    match.status_label,
    match.extra?.status_detail,
  ]
    .map(normalize)
    .join(" ");
  // Interrupted/terminal states win over the provider's derived LIVE and old minute.
  if (
    /\b(postponed|cancelled|canceled|abandoned|suspended|interrupted|report[eé]|annule)\b/.test(
      raw,
    )
  )
    return "unknown";
  if (
    match.status === "FINISHED" ||
    /\b(ft|aet|ap|finished|ended|full time|after extra time|after penalties|after pen|termine)\b/.test(
      raw,
    )
  )
    return "finished";
  if (/\b(ns|not started|scheduled|timed|fixture)\b/.test(raw))
    return "scheduled";
  if (
    /\b(live|in play|playing|ongoing|1h|2h|ht|et|pen|penalties|1st half|2nd half|first half|second half|half time|halftime|extra time)\b/.test(
      raw,
    )
  )
    return "live";
  if (match.status === "LIVE") return "live";
  return match.status === "SCHEDULED" ? "scheduled" : "unknown";
}

export function matchDataStale(
  data: Pick<MatchesApiResponse, "source" | "fetched_at">,
  now: number,
) {
  const age = now - Date.parse(data.fetched_at);
  return (
    data.source === "stale-cache" ||
    !Number.isFinite(age) ||
    age < -60_000 ||
    age > 6 * 60_000
  );
}

function scoreValue(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 ? score : null;
}

export function parseMatchesResponse(
  value: unknown,
  date: string,
): MatchesApiResponse {
  const data = value as
    | (Partial<MatchesApiResponse> & { error?: unknown; fallback?: boolean })
    | null;
  if (
    !data ||
    data.error ||
    data.fallback ||
    data.source === "fallback" ||
    data.date !== date ||
    !Array.isArray(data.matches)
  ) {
    throw new Error("Les scores sont temporairement indisponibles.");
  }
  const matches = data.matches
    .filter(
      (match) =>
        !!match &&
        typeof match.external_match_id === "string" &&
        !!match.external_match_id &&
        typeof match.home?.name === "string" &&
        !!match.home.name.trim() &&
        typeof match.away?.name === "string" &&
        !!match.away.name.trim(),
    )
    .map((match) => {
      const state = matchState(match);
      return {
        ...match,
        tournament: match.tournament?.name
          ? match.tournament
          : { id: null, name: "Football" },
        score: {
          home: scoreValue(match.score?.home),
          away: scoreValue(match.score?.away),
        },
        status:
          state === "finished"
            ? "FINISHED"
            : state === "live"
              ? "LIVE"
              : "SCHEDULED",
      } as MatchDTO;
    });
  return {
    ...data,
    date,
    matches,
    fetched_at: typeof data.fetched_at === "string" ? data.fetched_at : "",
    source: data.source || "unknown",
    teams: data.teams || [],
    tournaments: data.tournaments || [],
  };
}

export function previousMatchDay(today: string, offset: number) {
  if (
    !validCalendarDate(today) ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 14
  )
    throw new Error("Date de match invalide");
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() - offset);
  return calendarDate(date);
}

type MatchReading = { match: MatchDTO; day: MatchesApiResponse };

function preferMatchReading(previous: MatchReading, candidate: MatchReading) {
  const candidateTime = Date.parse(candidate.day.fetched_at);
  const previousTime = Date.parse(previous.day.fetched_at);
  const candidateIsNewer =
    Number.isFinite(candidateTime) &&
    (!Number.isFinite(previousTime) || candidateTime >= previousTime);
  const latest = candidateIsNewer ? candidate : previous;
  const other = candidateIsNewer ? previous : candidate;
  const state = matchState(latest.match);
  // Provider range caches can replay a first-half score after a confirmed FT.
  // A newer cancellation is still authoritative; a newer final can correct FT.
  return (state === "live" || state === "scheduled") &&
    matchState(other.match) === "finished"
    ? other
    : latest;
}

function matchReadings(days: readonly MatchesApiResponse[]) {
  const unique = new Map<string, MatchReading>();
  for (const day of days) {
    for (const match of day.matches) {
      const candidate = { match, day };
      const previous = unique.get(match.external_match_id);
      unique.set(
        match.external_match_id,
        previous ? preferMatchReading(previous, candidate) : candidate,
      );
    }
  }
  return unique;
}

type ScoreboardSnapshot = { days: MatchesApiResponse[] };
function isScoreboardSnapshot(value: unknown): value is ScoreboardSnapshot {
  return (
    !!value &&
    typeof value === "object" &&
    "days" in value &&
    Array.isArray(value.days) &&
    value.days.every(
      (day) => !!day && typeof day === "object" && Array.isArray(day.matches),
    )
  );
}

/** React Query structuralSharing guard; it never mutates either cache snapshot. */
export function preserveFinishedScoreboard<T extends ScoreboardSnapshot>(
  previous: unknown,
  next: T,
): T;
export function preserveFinishedScoreboard(
  previous: unknown,
  next: unknown,
): unknown;
export function preserveFinishedScoreboard(
  previous: unknown,
  next: unknown,
): unknown {
  if (!isScoreboardSnapshot(previous) || !isScoreboardSnapshot(next))
    return next;
  const known = matchReadings(previous.days);
  const retained = new Map<MatchesApiResponse, MatchDTO[]>();
  let changed = false;
  const days = next.days.map((day) => {
    const matches = day.matches.filter((match) => {
      const old = known.get(match.external_match_id);
      const state = matchState(match);
      if (
        !old ||
        matchState(old.match) !== "finished" ||
        (state !== "live" && state !== "scheduled")
      )
        return true;
      const group = retained.get(old.day) || [];
      if (
        !group.some(
          (item) => item.external_match_id === old.match.external_match_id,
        )
      )
        group.push(old.match);
      retained.set(old.day, group);
      changed = true;
      return false;
    });
    return matches.length === day.matches.length ? day : { ...day, matches };
  });
  if (!changed) return next;
  // Keep the earlier read time for protected finals without aging fresh lives
  // from the same date. Consumers already support multiple snapshots per day.
  return {
    ...next,
    days: [
      ...days,
      ...[...retained].map(([day, matches]) => ({ ...day, matches })),
    ],
  };
}

export function liveMatches(
  days: readonly MatchesApiResponse[],
  now: number,
): FeaturedMatch[] {
  return [...matchReadings(days).values()]
    .filter(({ match }) => {
      const kickoff = Date.parse(match.kickoff_at || "");
      return (
        matchState(match) === "live" &&
        Number.isFinite(kickoff) &&
        now - kickoff <= 6 * 60 * 60_000 &&
        kickoff <= now + 10 * 60_000
      );
    })
    .map(({ match, day }) => ({
      match,
      date: day.date,
      state: "live" as const,
      stale: matchDataStale(day, now),
      fetchedAt: day.fetched_at,
    }))
    .sort(
      (a, b) =>
        Date.parse(a.match.kickoff_at!) - Date.parse(b.match.kickoff_at!) ||
        a.match.external_match_id.localeCompare(b.match.external_match_id),
    );
}

export function featuredMatches(
  days: readonly MatchesApiResponse[],
  now: number,
  limit = 8,
): FeaturedMatch[] {
  const unique = [...matchReadings(days).values()].map(
    ({ match, day }): FeaturedMatch => ({
      match,
      date: day.date,
      state: matchState(match),
      stale: matchDataStale(day, now),
      fetchedAt: day.fetched_at,
    }),
  );
  const rank = { live: 0, finished: 1, scheduled: 2, unknown: 3 };
  return (
    unique
      // Select the newest occurrence first: an old LIVE must not survive a
      // newer cancellation merely because the cancelled entry is filtered out.
      .filter(({ match, state }) => {
        if (!majorClub(match.home.name) && !majorClub(match.away.name))
          return false;
        if (state === "unknown") return false;
        const kickoff = Date.parse(match.kickoff_at || "");
        if (!Number.isFinite(kickoff)) return false;
        // An old calendar entry is never inferred to be live or finished.
        if (state === "live")
          return (
            now - kickoff <= 6 * 60 * 60_000 && kickoff <= now + 10 * 60_000
          );
        if (state === "scheduled") return kickoff >= now;
        return kickoff <= now && now - kickoff <= 15 * 86_400_000;
      })
      .sort((a, b) => {
        const difference = rank[a.state] - rank[b.state];
        if (difference) return difference;
        const dateDifference =
          Date.parse(a.match.kickoff_at!) - Date.parse(b.match.kickoff_at!);
        if (dateDifference)
          return a.state === "finished" ? -dateDifference : dateDifference;
        const bigCount = (entry: FeaturedMatch) =>
          Number(majorClub(entry.match.home.name)) +
          Number(majorClub(entry.match.away.name));
        return (
          bigCount(b) - bigCount(a) ||
          a.match.external_match_id.localeCompare(b.match.external_match_id)
        );
      })
      .slice(0, Math.max(0, limit))
  );
}
