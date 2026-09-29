import { expect, it } from "vitest";
import { teamInvitationMaxUses } from "../src/lib/teamInvitationInput";
it.each(["1.5", "1,5", "2 personnes", "1e2", "", "0", "201", "-1", "Infinity"])(
  "rejects an invalid invitation limit %s without silently rounding",
  (raw) => {
    expect(() => teamInvitationMaxUses(raw)).toThrow("entier");
  },
);
it.each([
  ["1", 1],
  ["200", 200],
  [" 25 ", 25],
] as const)("accepts the complete invitation limit %s", (raw, expected) => {
  expect(teamInvitationMaxUses(raw)).toBe(expected);
});
