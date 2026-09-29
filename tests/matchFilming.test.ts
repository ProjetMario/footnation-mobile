import { expect, it } from "vitest";
import { canFilmMatch } from "../src/lib/matchFilming";
it("opens exactly one hour before kickoff and closes one hour after", () => {
  const kickoff = "2026-10-03T17:30:00Z";
  const t = Date.parse(kickoff);
  expect(canFilmMatch(kickoff, t - 3600001)).toBe(false);
  expect(canFilmMatch(kickoff, t - 3600000)).toBe(true);
  expect(canFilmMatch(kickoff, t)).toBe(true);
  expect(canFilmMatch(kickoff, t + 3600000)).toBe(true);
  expect(canFilmMatch(kickoff, t + 3600001)).toBe(false);
  expect(canFilmMatch("invalid", t)).toBe(false);
});
