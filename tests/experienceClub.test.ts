import { describe, expect, it } from "vitest";
import {
  editExperienceClubName,
  experienceClubPath,
  selectExperienceClub,
} from "../src/lib/experienceClub";
const id = "11111111-1111-4111-8111-111111111111";
const original = {
  club: "Club A",
  club_id: id,
  position: "Gardien",
  startYear: "2020",
};

describe("experience club association", () => {
  it("selects the exact FFF record without replacing the rest of the experience", () => {
    const otherId = "22222222-2222-4222-8222-222222222222";
    const next = selectExperienceClub(original, {
      id: otherId,
      name: "Club B",
    });
    expect(next).toEqual({ ...original, club: "Club B", club_id: otherId });
    expect(original.club_id).toBe(id);
  });
  it("removes the previous association as soon as the text changes", () => {
    const next = editExperienceClubName(original, "Club B");
    expect(next.club).toBe("Club B");
    expect(next.club_id).toBeUndefined();
    expect(next.position).toBe("Gardien");
    expect(experienceClubPath(next)).toBeNull();
  });
  it("keeps a link for an unchanged name and never guesses an ID from free text", () => {
    expect(editExperienceClubName(original, "Club A").club_id).toBe(id);
    expect(
      editExperienceClubName({ club: "", club_id: undefined }, "Club A")
        .club_id,
    ).toBeUndefined();
  });
  it("uses the selected UUID for navigation, not a name or a path loaded from legacy JSON", () => {
    expect(experienceClubPath(original)).toBe(`/club/${id}`);
    expect(experienceClubPath({ club: "Club A" })).toBeNull();
    expect(
      experienceClubPath({ club: "Club A", club_id: "../../settings" }),
    ).toBeNull();
  });
  it("rejects an incomplete search result without changing the entry", () => {
    expect(() =>
      selectExperienceClub(original, { id: "", name: "Club B" }),
    ).toThrow();
    expect(original).toEqual({
      club: "Club A",
      club_id: id,
      position: "Gardien",
      startYear: "2020",
    });
  });
});
