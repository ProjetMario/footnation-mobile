import { describe, expect, it, vi } from "vitest";
import {
  cachedScoreboard,
  loadEuropeanScoreboard,
} from "../src/lib/scoreboardFallback";
import type { MatchDTO, MatchesApiResponse } from "../src/types/matches";

const date = "2026-11-15";
const match: MatchDTO = {
  external_match_id: "match-1",
  home: { id: null, name: "Domicile" },
  away: { id: null, name: "Extérieur" },
  tournament: { id: null, name: "Compétition" },
  kickoff_at: null,
  status: "LIVE",
  score: { home: 1, away: 0 },
};
const scores = (
  overrides: Partial<MatchesApiResponse> = {},
): MatchesApiResponse => ({
  date,
  fetched_at: "2026-11-15T18:00:00Z",
  source: "espn",
  matches: [match],
  teams: [],
  tournaments: [],
  ...overrides,
});

describe("European scoreboard fallback", () => {
  it("uses the primary calendar without requesting the alternative", async () => {
    const primary = scores();
    const fallback = vi.fn(async () => scores({ source: "supabase" }));
    expect(await loadEuropeanScoreboard(async () => primary, fallback)).toBe(
      primary,
    );
    expect(fallback).not.toHaveBeenCalled();
  });

  it("shows alternative scores and identifies an incomplete calendar if the primary fails", async () => {
    const backup = scores({ source: "stale-cache" });
    const result = await loadEuropeanScoreboard(
      async () => {
        throw new Error("provider offline");
      },
      async () => backup,
    );
    expect(result).toMatchObject({
      source: "stale-cache",
      incomplete: true,
      alternative_source: true,
      matches: [match],
    });
  });

  it("does not start a fallback after cancellation", async () => {
    const error = Object.assign(new Error("cancelled"), { name: "AbortError" });
    const fallback = vi.fn(async () => scores());
    await expect(
      loadEuropeanScoreboard(async () => {
        throw error;
      }, fallback),
    ).rejects.toBe(error);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("keeps a partial primary response if its alternative also fails", async () => {
    const partial = scores({ incomplete: true, matches: [] });
    expect(
      await loadEuropeanScoreboard(
        async () => partial,
        async () => {
          throw new Error("offline");
        },
      ),
    ).toBe(partial);
  });

  it("uses alternative matches when the incomplete primary calendar is empty", async () => {
    const partial = scores({ incomplete: true, matches: [] });
    const backup = scores({ source: "supabase" });
    expect(
      await loadEuropeanScoreboard(
        async () => partial,
        async () => backup,
      ),
    ).toMatchObject({
      alternative_source: true,
      incomplete: true,
      matches: [match],
    });
  });

  it("propagates an error when both providers fail", async () => {
    await expect(
      loadEuropeanScoreboard(
        async () => {
          throw new Error("primary");
        },
        async () => {
          throw new Error("alternative");
        },
      ),
    ).rejects.toThrow("alternative");
  });

  it("starts with the newest same-day cache and marks it as incomplete", () => {
    const old = scores({ source: "espn", fetched_at: "2026-11-15T17:00:00Z" });
    const newer = scores({ source: "supabase" });
    expect(cachedScoreboard(date, [old, newer])).toMatchObject({
      source: "supabase",
      incomplete: true,
      alternative_source: true,
      matches: [match],
    });
    expect(cachedScoreboard("2026-11-14", [old, newer])).toBeUndefined();
    expect(cachedScoreboard(date, [scores({ matches: [] })])).toBeUndefined();
  });
});
