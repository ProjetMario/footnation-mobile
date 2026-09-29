import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/espn-match-summary.json";
import {
  fetchEspnMatchDetails,
  parseEspnMatchDetails,
} from "../src/lib/espnMatchDetails";
const id = "espn:fra.1:401876449";
const fetchedAt = "2026-09-20T21:15:00Z";
const parse = (data: unknown) => parseEspnMatchDetails(data, id, fetchedAt);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("ESPN match details", () => {
  it("extracts actual scorers, minutes and assists from the match summary", () => {
    const result = parse(fixture);
    expect(
      result.goals.map((g) => [g.player, g.minute, g.side, g.assist]),
    ).toEqual([
      ["Ferran Torres", "66'", "away", "Désiré Doué"],
      ["Angel Gomes", "72'", "home", "Amine Gouiri"],
      ["Marquinhos", "74'", "away", null],
    ]);
    expect(result.referee).toBe("Francois Letexier");
    expect(result.attendance).toBeNull();
  });
  it("aligns team statistics by identity, preserves zeros and calculates precise passing accuracy", () => {
    const data = structuredClone(fixture);
    data.boxscore.teams.reverse();
    const result = parse(data);
    expect(
      result.statistics.find((s) => s.key === "possessionPct"),
    ).toMatchObject({ home: 39.4, away: 60.6, percent: true });
    expect(result.statistics.find((s) => s.key === "totalShots")).toMatchObject(
      { home: 12, away: 31 },
    );
    expect(result.statistics.find((s) => s.key === "redCards")).toMatchObject({
      home: 1,
      away: 0,
    });
    expect(
      result.statistics.find((s) => s.key === "passAccuracy"),
    ).toMatchObject({ home: 81.2, away: 89.2 });
  });
  it("does not fabricate absent stats, treat unknown as zero, or divide by zero", () => {
    const data = structuredClone(fixture);
    data.boxscore.teams[0].statistics = [
      { name: "totalShots", displayValue: "—", label: "Shots" },
      { name: "totalPasses", displayValue: "0", label: "Passes" },
    ];
    const result = parse(data);
    expect(
      result.statistics.find((s) => s.key === "totalShots")?.home,
    ).toBeNull();
    expect(
      result.statistics.find((s) => s.key === "passAccuracy")?.home,
    ).toBeNull();
    expect(parse({ ...data, boxscore: {} }).statistics).toEqual([]);
    expect(parse({ ...data, keyEvents: undefined }).goalsAvailable).toBe(false);
  });
  it("keeps stoppage time, flags own goals and penalties, omits shootout/cancelled goals and duplicates", () => {
    const goal = fixture.keyEvents[0];
    const result = parse({
      ...fixture,
      keyEvents: [
        {
          ...goal,
          id: "1",
          clock: { value: 5500, displayValue: "90'+2'" },
          type: { type: "own-goal" },
        },
        { ...goal, id: "2", type: { type: "penalty---scored" } },
        { ...goal, id: "2", type: { type: "penalty---scored" } },
        { ...goal, id: "3", shootout: true },
        { ...goal, id: "4", scoringPlay: false },
        { ...goal, id: "5", type: { type: "goal-disallowed" } },
      ],
    });
    expect(result.goals).toHaveLength(2);
    expect(result.goals[0]).toMatchObject({ penalty: true, assist: null });
    expect(result.goals[1]).toMatchObject({
      ownGoal: true,
      assist: null,
      minute: "90'+2'",
    });
  });
  it("rejects a different event or unsupported league", () => {
    expect(() =>
      parse({ ...fixture, header: { ...fixture.header, id: "999" } }),
    ).toThrow();
    expect(() =>
      parseEspnMatchDetails(fixture, "espn:malicious:401876449", fetchedAt),
    ).toThrow();
    expect(() => parse(null)).toThrow();
  });
  it("requests only a validated summary URL", async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => fixture });
    vi.stubGlobal("fetch", request);
    expect((await fetchEspnMatchDetails(id)).goals).toHaveLength(3);
    expect(request.mock.calls[0][0]).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/summary?event=401876449",
    );
    await expect(fetchEspnMatchDetails("espn:fra.1:12?x=1")).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("propagates cancellation and reports service failures", async () => {
    const controller = new AbortController();
    controller.abort();
    const request = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", request);
    await expect(
      fetchEspnMatchDetails(id, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(request).not.toHaveBeenCalled();
    await expect(fetchEspnMatchDetails(id)).rejects.toThrow("temporairement");
  });
  it("times out slow network requests", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_, reject) =>
            options.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          ),
      ),
    );
    const pending = expect(fetchEspnMatchDetails(id)).rejects.toThrow("expiré");
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
  });
});
