import { describe, expect, it } from "vitest";
import {
  metricTrend,
  ratio,
  weightedSessionDuration,
} from "../src/lib/admin/metrics";
import { isActiveAdminProfile } from "../../supabase/functions/_shared/admin-profile";
describe("admin measurement semantics", () => {
  it("preserves unavailable and measured zero, including zero denominators", () => {
    expect(ratio(null, 10)).toBeNull();
    expect(ratio(0, 10, 100)).toBe(0);
    expect(ratio(2, 0)).toBeNull();
    expect(metricTrend([])).toEqual({ value: null, percent: null });
    expect(
      metricTrend([
        { period: "a", value: 0 },
        { period: "b", value: 2 },
      ]).percent,
    ).toBeNull();
    expect(
      metricTrend([
        { period: "a", value: 8 },
        { period: "b", value: 2 },
      ]).percent,
    ).toBe(-75);
  });
  it("weights duration by sessions and ignores missing measurements", () => {
    expect(
      weightedSessionDuration([
        { sessions: 1, averageSessionDuration: 60 },
        { sessions: 3, averageSessionDuration: 20 },
        { sessions: 900, averageSessionDuration: null },
      ]),
    ).toBe(30);
    expect(
      weightedSessionDuration([{ sessions: 0, averageSessionDuration: 60 }]),
    ).toBeNull();
  });
});
describe("analytics server authorization", () => {
  it("denies members and active or malformed suspensions; accepts an expired suspension", () => {
    const now = Date.parse("2026-09-24T12:00:00Z");
    expect(isActiveAdminProfile(null, now)).toBe(false);
    expect(isActiveAdminProfile({ is_admin: false }, now)).toBe(false);
    expect(isActiveAdminProfile({ is_admin: true }, now)).toBe(true);
    for (const suspended_until of [null, "bad", "2026-09-25T12:00:00Z"])
      expect(
        isActiveAdminProfile(
          { is_admin: true, is_suspended: true, suspended_until },
          now,
        ),
      ).toBe(false);
    expect(
      isActiveAdminProfile(
        {
          is_admin: true,
          is_suspended: true,
          suspended_until: "2026-09-24T10:00:00Z",
        },
        now,
      ),
    ).toBe(true);
  });
});
