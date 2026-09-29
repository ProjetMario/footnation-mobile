import { describe, expect, it } from "vitest";
import { standingPayload } from "../src/lib/standingForm";
describe("standing validation", () => {
  it("distinguishes unknown values from zero and permits penalty points", () => {
    expect(
      standingPayload(
        { team_name: "  FootNation  ", wins: "0", points: "-3" },
        true,
      ),
    ).toMatchObject({
      team_name: "FootNation",
      wins: 0,
      played: null,
      points: -3,
      is_own_team: true,
    });
  });
  it("rejects invalid and overflowing counts or ranks", () => {
    for (const [key, value] of [
      ["position", "0"],
      ["wins", "-1"],
      ["played", "2.5"],
      ["points", "1e3"],
      ["goals_for", "2147483648"],
      ["points", "-2147483649"],
    ])
      expect(() =>
        standingPayload({ team_name: "FC Test", [key]: value }, false),
      ).toThrow();
  });
  it("requires a team and preserves manually supplied league points", () => {
    expect(() => standingPayload({ team_name: " " }, false)).toThrow();
    expect(
      standingPayload({ team_name: "FC Test", wins: "3", points: "7" }, false)
        .points,
    ).toBe(7);
  });
});
