import { describe, expect, it } from "vitest";
import {
  calendarTeamOptions,
  emptyMatchFilters,
  filterClubMatches,
  type CalendarMatch,
} from "../src/lib/clubMatchFilters";

const teams = [
  {
    id: "senior",
    name: "Chambéry Savoie Football",
    category: "SENIOR M1",
    competition: { name: "Régional 1" },
  },
  { id: "youth", name: "Chambéry Savoie Football U14", category: "U14 M1" },
];
const clubName = "Chambéry Savoie Football";
const matches: CalendarMatch[] = [
  {
    id: "home",
    homeTeam: teams[0],
    awayTeam: { id: "other", name: "AS Misérieux Trévoux" },
  },
  {
    id: "away",
    homeTeam: { id: "annecy", name: "FC Annecy U14" },
    awayTeam: teams[1],
  },
  {
    id: "unknown",
    homeTeam: { id: "missing", name: "Chambéry Savoie Football U18" },
    awayTeam: { id: "other-youth", name: "Annecy U14" },
  },
];
describe("club calendar filters", () => {
  it("uses the club's squad, not the opponent's age category", () => {
    const filtered = filterClubMatches(matches, teams, clubName, {
      ...emptyMatchFilters,
      category: "U14",
      location: "away",
      team: "youth",
    });
    expect(filtered.map((match) => match.id)).toEqual(["away"]);
    expect(
      filterClubMatches(matches, teams, clubName, {
        ...emptyMatchFilters,
        category: "U14",
        location: "home",
      }),
    ).toEqual([]);
  });
  it("recovers omitted squads and offers only club teams that have matches", () => {
    const options = calendarTeamOptions(
      matches,
      [...teams, { id: "unused", name: clubName, category: "U9 M1" }],
      clubName,
    );
    expect(options.map((item) => item.category)).toEqual([
      "Séniors",
      "U18",
      "U14",
    ]);
    expect(
      filterClubMatches(matches, teams, clubName, {
        ...emptyMatchFilters,
        category: "U18",
      }).map((row) => row.id),
    ).toEqual(["unknown"]);
  });
  it("combines search with location and resets to the whole selected period", () => {
    expect(
      filterClubMatches(matches, teams, clubName, {
        ...emptyMatchFilters,
        search: "miserieux",
        location: "home",
      }).map((row) => row.id),
    ).toEqual(["home"]);
    expect(
      filterClubMatches(matches, teams, clubName, emptyMatchFilters),
    ).toEqual(matches);
    expect(
      filterClubMatches(matches, teams, clubName, {
        ...emptyMatchFilters,
        search: "regional 1",
      }).map((row) => row.id),
    ).toEqual(["home"]);
    expect(filterClubMatches([], teams, clubName, emptyMatchFilters)).toEqual(
      [],
    );
  });
});
