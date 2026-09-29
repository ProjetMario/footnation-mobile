export interface Team {
  id: string;
  category: string;
  shortName: string;
}
export interface Match {
  homeScore?: number | null;
  awayScore?: number | null;
  id: string;
  date: string;
  time: string;
  status: string;
  homeTeam: { id: string; name: string; shortName: string; logo?: string };
  awayTeam: { id: string; name: string; shortName: string; logo?: string };
  competition: string;
  venue?: string;
}

export function isFlagshipCategory(value: string): boolean {
  const category = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    /\bseniors?\b/.test(category) &&
    !/feminin|feminine|\bf\s*\d*\b|reserve|\bu\s*\d+/.test(category) &&
    /\bm\s*1\b|masculin|hommes?/.test(category) &&
    /\bm\s*1\b|\b1\b|premiere|fanion/.test(category) &&
    !/\bm\s*(?:[2-9]|\d{2,})\b|\b(?:[2-9]|\d{2,})\b/.test(category)
  );
}

export function parseMatchDateTime(date: string, time?: string): Date | null {
  const value = time?.includes("T")
    ? time
    : date.includes("T")
      ? date
      : `${date}T${time || "00:00"}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function selectFeaturedClubMatch(
  teams: Team[],
  matches: Match[],
  now = new Date(),
): Match | null {
  const flagshipIds = new Set(
    teams
      .filter((team) =>
        isFlagshipCategory(team.category || team.shortName || ""),
      )
      .map((team) => team.id)
      .filter(Boolean),
  );
  const future = matches
    .filter(
      (match) =>
        (match.status === "scheduled" ||
          (match.status === "finished" &&
            match.homeScore == null &&
            match.awayScore == null)) &&
        (parseMatchDateTime(match.date, match.time)?.getTime() ?? 0) >
          now.getTime(),
    )
    .sort(
      (a, b) =>
        parseMatchDateTime(a.date, a.time)!.getTime() -
        parseMatchDateTime(b.date, b.time)!.getTime(),
    );
  // Club names are shared by all age groups. Only the club's own team IDs
  // establish that this is its first men's team, never an opponent's category.
  return (
    future.find(
      (match) =>
        flagshipIds.has(match.homeTeam.id) ||
        flagshipIds.has(match.awayTeam.id),
    ) ??
    future[0] ??
    null
  );
}
