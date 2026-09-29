import { clubLogoIdentity } from "./clubLogoIdentity";
import { presentClubTeam, sortClubTeams, type ClubTeam } from "./clubTeams";

export type MatchTeam = {
  id?: string;
  name?: string;
  shortName?: string;
  logo?: string | null;
};
export type CalendarMatch = {
  id: string;
  date?: string;
  time?: string;
  status?: string;
  competition?: string;
  round?: string;
  venue?: string;
  homeTeam?: MatchTeam;
  awayTeam?: MatchTeam;
  homeScore?: number | null;
  awayScore?: number | null;
};
export type ClubMatchFilters = {
  category: string;
  team: string;
  location: "all" | "home" | "away";
  search: string;
};
export const emptyMatchFilters: ClubMatchFilters = {
  category: "all",
  team: "all",
  location: "all",
  search: "",
};

function clubTeam(
  team: MatchTeam | undefined,
  teams: ClubTeam[],
  clubName: string,
): ClubTeam | null {
  if (!team) return null;
  const known = team.id && teams.find((item) => item.id === team.id);
  if (known) return known;
  if (
    !team.name ||
    !clubName ||
    clubLogoIdentity(team.name) !== clubLogoIdentity(clubName)
  )
    return null;
  // A match can reference a squad absent from the club's shortened teams list.
  return {
    id: team.id || `name:${team.name}`,
    name: team.name,
    shortName: team.shortName,
  } satisfies ClubTeam;
}

export function matchClubSides(
  match: CalendarMatch,
  teams: ClubTeam[],
  clubName: string,
) {
  return {
    home: clubTeam(match.homeTeam, teams, clubName),
    away: clubTeam(match.awayTeam, teams, clubName),
  };
}

export function calendarTeamOptions(
  matches: CalendarMatch[],
  teams: ClubTeam[],
  clubName: string,
) {
  const unique = new Map<string, ClubTeam>();
  for (const match of matches) {
    for (const team of Object.values(matchClubSides(match, teams, clubName))) {
      if (team) unique.set(team.id, team);
    }
  }
  return sortClubTeams([...unique.values()]);
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function filterClubMatches(
  matches: CalendarMatch[],
  teams: ClubTeam[],
  clubName: string,
  filters: ClubMatchFilters,
) {
  const words = normalize(filters.search).trim().split(/\s+/).filter(Boolean);
  return matches.filter((match) => {
    const sides = matchClubSides(match, teams, clubName);
    const candidates =
      filters.location === "all"
        ? Object.values(sides)
        : [sides[filters.location]];
    if (
      (filters.team !== "all" ||
        filters.category !== "all" ||
        filters.location !== "all") &&
      !candidates.some(
        (team) =>
          team &&
          (filters.team === "all" || team.id === filters.team) &&
          (filters.category === "all" ||
            presentClubTeam(team).category === filters.category),
      )
    )
      return false;
    const text = normalize(
      [
        match.homeTeam?.name,
        match.awayTeam?.name,
        match.competition,
        match.round,
        match.venue,
        ...Object.values(sides).flatMap((team) =>
          team ? [team.category, team.competition?.name] : [],
        ),
      ].join(" "),
    );
    return words.every((word) => text.includes(word));
  });
}
