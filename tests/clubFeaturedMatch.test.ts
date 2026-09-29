import { describe, expect, it } from "vitest";
import {
  isFlagshipCategory,
  selectFeaturedClubMatch,
} from "../src/lib/clubFeaturedMatch";
import type { Match, Team } from "../src/lib/clubFeaturedMatch";
const teams: Team[] = ["U17 M1", "SENIOR M2", "SENIOR F1", "SENIOR M1"].map(
  (category, index) => ({ id: String(index), shortName: category, category }),
);
const match = (
  id: string,
  team: number,
  date: string,
  away = false,
): Match => ({
  id,
  date,
  time: "15:00",
  status: "scheduled",
  homeTeam: {
    id: away ? "opponent" : String(team),
    name: "Même club",
    shortName: "",
  },
  awayTeam: {
    id: away ? String(team) : "opponent",
    name: "Même club",
    shortName: "SENIOR M1",
  },
  competition: "",
});
const now = new Date("2026-09-20T12:00:00Z");
describe("club flagship match", () => {
  it("prioritizes the first senior men team over earlier youth, reserve and women games", () => {
    const games = [
      match("youth", 0, "2026-09-21"),
      match("reserve", 1, "2026-09-22"),
      match("women", 2, "2026-09-23"),
      match("later", 3, "2026-10-03"),
      match("first", 3, "2026-09-27", true),
    ];
    expect(selectFeaturedClubMatch(teams, games, now)?.id).toBe("first");
  });
  it("falls back chronologically without mistaking an opponent for the flagship", () => {
    expect(
      selectFeaturedClubMatch(
        teams,
        [match("youth", 0, "2026-09-21"), match("reserve", 1, "2026-09-22")],
        now,
      )?.id,
    ).toBe("youth");
  });
  it("ignores past, postponed and invalid matches", () => {
    expect(
      selectFeaturedClubMatch(
        teams,
        [
          match("past", 3, "2026-09-19"),
          { ...match("postponed", 3, "2026-09-21"), status: "postponed" },
          match("invalid", 3, "invalid"),
        ],
        now,
      ),
    ).toBeNull();
  });
  it("handles future calendar entries incorrectly marked finished without scores", () => {
    expect(
      selectFeaturedClubMatch(
        teams,
        [
          {
            ...match("future", 3, "2026-10-03"),
            status: "finished",
            homeScore: null,
            awayScore: null,
          },
        ],
        now,
      )?.id,
    ).toBe("future");
    expect(
      selectFeaturedClubMatch(
        teams,
        [
          {
            ...match("scored", 3, "2026-10-03"),
            status: "finished",
            homeScore: 2,
            awayScore: 1,
          },
        ],
        now,
      ),
    ).toBeNull();
  });
  it("recognizes only explicit first senior men categories", () => {
    for (const category of [
      "SENIOR M1",
      "Séniors masculins 1",
      "Senior hommes équipe première",
    ])
      expect(isFlagshipCategory(category)).toBe(true);
    for (const category of [
      "U17 M1",
      "SENIOR M2",
      "SENIOR F1",
      "Senior masculin 2",
      "SENIOR M10",
    ])
      expect(isFlagshipCategory(category)).toBe(false);
  });
});
