import { describe, expect, it } from "vitest";
import {
  filterMatchingCandidates,
  matchingDepartment,
  matchingFiltersReducer,
  matchingRecruitingPositions,
  normalizeMatchingFilters,
  type MatchingFilterState,
} from "../src/lib/matchingFilters";
import { departmentOptions } from "../src/lib/networkOptions";
import type { MatchingClub, MatchingProfile } from "../src/types/matching";

const profile: MatchingProfile = {
  id: "profile",
  entity_type: "profile",
  name: "Joueur",
  avatar_url: null,
  location: { city: null, department: "75 - Paris" },
  compatibility_score: 40,
  full_name: "Joueur",
  primary_role: "Joueur amateur",
  position: "Gardien",
  highest_level: "Régional 1",
  bio: null,
  birthdate: null,
  is_premium: false,
  created_at: "2026-09-10T00:00:00Z",
};
const club: MatchingClub = {
  id: "club",
  entity_type: "club",
  name: "Club",
  avatar_url: null,
  location: { city: null, department: "Paris" },
  compatibility_score: 40,
  division: "Régional 1",
  competition_level: "amateur",
  recruiting_status: true,
  recruiting_positions: [{ position: "Gardien", level: "Régional 1" }],
  age_category: null,
  logo_url: null,
  stadium_name: null,
  youth_academy: false,
  women_team: false,
};

describe("matching filter application", () => {
  it("keeps the applied search unchanged while editing and applies one snapshot", () => {
    const initial: MatchingFilterState = { draft: {}, applied: {} };
    const edited = matchingFiltersReducer(initial, {
      type: "edit",
      field: "role",
      value: "Entraîneur",
    });
    expect(edited.applied).toBe(initial.applied);
    expect(edited.draft.role).toBe("Entraîneur");
    const applied = matchingFiltersReducer(edited, { type: "apply" });
    expect(applied.applied).toEqual({ role: "Entraîneur" });
    expect(applied.applied).not.toBe(applied.draft);
    const nextDraft = matchingFiltersReducer(applied, {
      type: "edit",
      field: "level",
      value: "Ligue 1",
    });
    expect(nextDraft.applied).toEqual({ role: "Entraîneur" });
  });

  it("resets both the displayed selections and applied search", () => {
    expect(
      matchingFiltersReducer(
        { draft: { level: "Ligue 1" }, applied: { role: "Entraîneur" } },
        { type: "reset" },
      ),
    ).toEqual({ draft: {}, applied: {} });
  });

  it("clears the profile-only role when switching the draft to clubs", () => {
    const state = matchingFiltersReducer(
      {
        draft: { role: "Entraîneur", level: "Ligue 1" },
        applied: { role: "Entraîneur" },
      },
      { type: "edit", field: "entityType", value: "club" },
    );
    expect(state.draft).toEqual({ entityType: "club", level: "Ligue 1" });
    expect(state.applied.role).toBe("Entraîneur");
  });

  it("does not forward arbitrary values or unsupported distance criteria", () => {
    expect(
      normalizeMatchingFilters({
        role: "inconnue",
        level: "*",
        department: "75%,foo",
        position: "n’importe quoi",
        maxDistance: 10,
      }),
    ).toEqual({});
    expect(normalizeMatchingFilters({ entityType: "all" })).toEqual({});
  });
});

describe("matching departments shared by profiles and clubs", () => {
  it("maps every existing selector option to an official club code", () => {
    for (const option of departmentOptions) {
      expect(matchingDepartment(option.value), option.value).not.toBeNull();
    }
  });

  it("preserves profile labels while allowing legacy names/codes", () => {
    expect(matchingDepartment("75 - Paris")).toEqual({
      code: "75",
      profileValues: ["75 - Paris", "Paris", "75"],
    });
    expect(matchingDepartment("2A - Corse-du-Sud")?.code).toBe("2A");
    expect(matchingDepartment("971 - Guadeloupe")?.code).toBe("971");
    expect(matchingDepartment("01 - Ain")?.code).toBe("01");
    expect(matchingDepartment("%Paris%")).toBeNull();
  });
});

describe("matching candidate filters", () => {
  it("filters the requested level across profiles and club metadata", () => {
    const differentClub = { ...club, id: "other", division: "Ligue 1" };
    expect(
      filterMatchingCandidates([profile, club, differentClub], {
        level: "Régional 1",
      }).map((item) => item.id),
    ).toEqual(["profile", "club"]);
  });

  it("accepts either club division or competition level", () => {
    expect(
      filterMatchingCandidates(
        [{ ...club, division: null, competition_level: "Ligue 1" }],
        { level: "Ligue 1" },
      ),
    ).toHaveLength(1);
  });

  it("applies the role to profiles and the position to both entity types", () => {
    expect(
      filterMatchingCandidates([profile, club], { role: "Entraîneur" }).map(
        (item) => item.id,
      ),
    ).toEqual(["club"]);
    expect(
      filterMatchingCandidates(
        [
          profile,
          {
            ...club,
            recruiting_positions: [
              { position: "Attaquant", level: "Régional 1" },
            ],
          },
        ],
        { position: "Gardien" },
      ).map((item) => item.id),
    ).toEqual(["profile"]);
    expect(
      filterMatchingCandidates([profile, club], { entityType: "profile" }).map(
        (item) => item.id,
      ),
    ).toEqual(["profile"]);
  });

  it("does not repeat an incompatible department string comparison after the server filter", () => {
    expect(
      filterMatchingCandidates([profile, club], { department: "75 - Paris" }),
    ).toHaveLength(2);
  });

  it("handles missing or malformed recruiting metadata without inventing a match", () => {
    for (const raw of [
      null,
      "Gardien",
      { Gardien: true },
      [null, {}, { position: 42 }],
    ]) {
      expect(matchingRecruitingPositions(raw)).toEqual([]);
      expect(
        filterMatchingCandidates(
          [{ ...club, recruiting_positions: matchingRecruitingPositions(raw) }],
          { position: "Gardien" },
        ),
      ).toEqual([]);
    }
    expect(
      matchingRecruitingPositions([{ position: "Gardien", urgent: true }]),
    ).toEqual([{ position: "Gardien", level: "", urgent: true }]);
  });
});
