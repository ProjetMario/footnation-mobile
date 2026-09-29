import { describe, expect, it } from "vitest";
import {
  filterClubTeams,
  presentClubTeam,
  sortClubTeams,
  type ClubTeam,
} from "../src/lib/clubTeams";
import {
  clubTeamBaseName,
  matchingClubLogo,
} from "../src/lib/clubLogoIdentity";

const team = (category: string, name = "Club de recette"): ClubTeam => ({
  id: category,
  name,
  category,
});
describe("club teams presentation", () => {
  it("puts seniors first and groups academy ages in descending numeric order", () => {
    const rows = [
      "U9 M1",
      "U18 F1",
      "SENIOR M2",
      "U14 M2",
      "SENIOR M1",
      "U20 M1",
      "U14 M1",
      "SENIOR F1",
    ].map((category) => team(category));
    expect(sortClubTeams(rows).map((row) => row.team.id)).toEqual([
      "SENIOR M1",
      "SENIOR M2",
      "SENIOR F1",
      "U20 M1",
      "U18 F1",
      "U14 M1",
      "U14 M2",
      "U9 M1",
    ]);
    expect(rows[0].id).toBe("U9 M1");
  });
  it("uses explicit categories before names and does not invent gender", () => {
    expect(presentClubTeam(team("U18 M2", "Club Féminines")).gender).toBe(
      "men",
    );
    expect(presentClubTeam(team("SENIOR F1")).title).toBe("Séniors 1");
    expect(presentClubTeam(team("", "Club U13 Mixte")).gender).toBe("mixed");
    expect(presentClubTeam(team("U13")).gender).toBe("unknown");
  });
  it("preserves combined ages and legacy academy categories without assigning a made-up U age", () => {
    expect(presentClubTeam(team("U14 / U15 M1")).category).toBe("U14 / U15");
    expect(presentClubTeam(team("MINIME M1"))).toMatchObject({
      section: "academy",
      category: "Minimes",
    });
    expect(presentClubTeam(team("Vétérans")).section).toBe("other");
    expect(presentClubTeam(team("")).section).toBe("other");
  });
  it("combines filters and accent-insensitive competition search", () => {
    const rows = sortClubTeams(
      [team("U18 F1"), team("U18 M1"), team("SENIOR F1")].map((row) => ({
        ...row,
        competition: { name: "Régional 2" },
      })),
    );
    const filters = {
      section: "academy",
      gender: "women",
      category: "U18",
      search: "regional 2",
    } as const;
    expect(filterClubTeams(rows, filters).map((row) => row.team.id)).toEqual([
      "U18 F1",
    ]);
    expect(
      filterClubTeams(rows, { ...filters, search: "introuvable" }),
    ).toEqual([]);
    expect(
      filterClubTeams(rows, {
        section: "all",
        gender: "all",
        category: "all",
        search: "",
      }),
    ).toHaveLength(3);
  });
});
describe("club logo identities", () => {
  it("finds the parent club logo for youth and reserve squads", () => {
    expect(clubTeamBaseName("Chambéry Savoie Football U18 Féminines")).toBe(
      "Chambéry Savoie Football",
    );
    expect(clubTeamBaseName("Chambéry Savoie Football 2 U14")).toBe(
      "Chambéry Savoie Football",
    );
    expect(clubTeamBaseName("Chambery Sport 73")).toBe("Chambery Sport 73");
    expect(
      matchingClubLogo("FC Annecy U14", [
        { name: "FC D’Annecy", logo: "annecy" },
        { name: "US Annecy le Vieux", logo: "other" },
      ]),
    ).toBe("annecy");
  });
  it("never substitutes another club or an ambiguous logo", () => {
    expect(
      matchingClubLogo("FC Annecy U14", [
        { name: "FC Lys Annecy", logo: "wrong" },
      ]),
    ).toBeNull();
    expect(
      matchingClubLogo("FC Annecy", [
        { name: "FC D’Annecy", logo: "one" },
        { name: "Annecy FC", logo: "two" },
      ]),
    ).toBeNull();
  });
});
