import { describe, expect, it } from "vitest";
import {
  featuredMatches,
  majorClub,
  matchDataStale,
  matchState,
  parseMatchesResponse,
  preserveFinishedScoreboard,
  previousMatchDay,
} from "../src/lib/featuredMatches";
import type { MatchDTO, MatchesApiResponse } from "../src/types/matches";

const now = Date.parse("2026-09-09T20:00:00Z");
function match(overrides: Partial<MatchDTO> = {}): MatchDTO {
  return {
    external_match_id: "one",
    home: { id: "psg", name: "Paris Saint-Germain" },
    away: { id: "real", name: "Real Madrid" },
    tournament: { id: "ucl", name: "UEFA Champions League" },
    kickoff_at: "2026-09-09T19:00:00Z",
    status: "LIVE",
    score: { home: 0, away: 1 },
    ...overrides,
  };
}
function day(
  matches: MatchDTO[],
  overrides: Partial<MatchesApiResponse> = {},
): MatchesApiResponse {
  return {
    date: "2026-09-09",
    matches,
    fetched_at: new Date(now).toISOString(),
    teams: [],
    tournaments: [],
    source: "forza",
    ...overrides,
  };
}

describe("provider status corrections", () => {
  it.each(["FT", "FINISHED", "AET", "AP", "After Penalties", "Full-time"])(
    "keeps %s terminal despite a persisted live minute",
    (raw) => {
      expect(
        matchState(
          match({
            status: "LIVE",
            extra: { raw_status: raw, live_minute: 90 },
          }),
        ),
      ).toBe("finished");
    },
  );
  it.each(["HT", "1H", "2H", "ET", "PEN", "In Play"])(
    "recognizes %s even when the backend says scheduled",
    (raw) => {
      expect(
        matchState(match({ status: "SCHEDULED", status_label: raw })),
      ).toBe("live");
    },
  );
  it.each(["Postponed", "Cancelled", "Suspended", "Abandoned"])(
    "does not turn %s into a live or upcoming fixture",
    (raw) => {
      expect(
        matchState(
          match({
            status: "LIVE",
            extra: { raw_status: raw, live_minute: 12 },
          }),
        ),
      ).toBe("unknown");
    },
  );
  it("does not turn a scheduled match with zero minute into a direct", () => {
    expect(
      matchState(
        match({
          status: "LIVE",
          extra: { raw_status: "Not Started", live_minute: 0 },
        }),
      ),
    ).toBe("scheduled");
  });
});

describe("featured clubs and real results", () => {
  it.each(["LIVE", "SCHEDULED"] as const)(
    "keeps a confirmed final when a newer range snapshot replays %s, in either order",
    (status) => {
      const final = day(
        [match({ status: "FINISHED", score: { home: 0, away: 1 } })],
        {
          fetched_at: "2026-09-09T19:40:00Z",
        },
      );
      const replay = day([match({ status, score: { home: 0, away: 0 } })]);
      for (const responses of [
        [final, replay],
        [replay, final],
      ]) {
        const [item] = featuredMatches(responses, now);
        expect(item.state).toBe("finished");
        expect(item.match.score).toEqual({ home: 0, away: 1 });
        expect(item.fetchedAt).toBe(final.fetched_at);
        expect(item.stale).toBe(true);
      }
    },
  );
  it("accepts a newer corrected final score and a newer cancellation after FT", () => {
    const final = day([match({ status: "FINISHED" })], {
      fetched_at: "2026-09-09T19:40:00Z",
    });
    const correction = day([
      match({ status: "FINISHED", score: { home: 0, away: 2 } }),
    ]);
    expect(featuredMatches([final, correction], now)[0].match.score.away).toBe(
      2,
    );
    const cancelled = day([
      match({ extra: { raw_status: "STATUS_CANCELED" } }),
    ]);
    for (const responses of [
      [final, cancelled],
      [cancelled, final],
    ])
      expect(featuredMatches(responses, now)).toEqual([]);
  });
  it("recognizes complete club aliases, accents and punctuation without substring false positives", () => {
    for (const name of [
      "PSG",
      "Olympique de Marseille",
      "FC Bayern München",
      "Atlético de Madrid",
    ])
      expect(majorClub(name)).toBe(true);
    for (const name of [
      "Como",
      "Bolton",
      "Colchester",
      "Roma U19",
      "Paris FC",
      "",
    ])
      expect(majorClub(name)).toBe(false);
  });
  it("prioritizes live, then latest finals, then upcoming and keeps exact request dates", () => {
    const live = match();
    const final = match({
      external_match_id: "final",
      status: "FINISHED",
      kickoff_at: "2026-09-08T20:00:00Z",
    });
    const future = match({
      external_match_id: "future",
      status: "SCHEDULED",
      kickoff_at: "2026-09-09T21:00:00Z",
    });
    const older = match({
      ...final,
      external_match_id: "older",
      kickoff_at: "2026-09-07T20:00:00Z",
    });
    const items = featuredMatches(
      [
        day([future, live]),
        day([final], { date: "2026-09-08" }),
        day([older], { date: "2026-09-07" }),
      ],
      now,
    );
    expect(
      items.map((item) => [item.match.external_match_id, item.date]),
    ).toEqual([
      ["one", "2026-09-09"],
      ["final", "2026-09-08"],
      ["older", "2026-09-07"],
      ["future", "2026-09-09"],
    ]);
  });
  it("deduplicates the same event by source timestamp without mutating inputs", () => {
    const older = day([match({ score: { home: 0, away: 0 } })], {
      fetched_at: "2026-09-09T19:57:00Z",
    });
    const latest = day([match()]);
    expect(featuredMatches([latest, older], now)[0].match.score).toEqual({
      home: 0,
      away: 1,
    });
    expect(older.matches[0].score.away).toBe(0);
  });
  it("replaces an undated cached occurrence with a source timestamp in either input order", () => {
    const undated = day([match({ score: { home: 0, away: 0 } })], {
      fetched_at: "invalid",
    });
    const latest = day([match()]);
    for (const responses of [
      [undated, latest],
      [latest, undated],
    ]) {
      const [item] = featuredMatches(responses, now);
      expect(item.match.score.away).toBe(1);
      expect(item.stale).toBe(false);
    }
  });
  it("keeps a match crossing midnight live until a fresh day snapshot confirms the final", () => {
    const afterMidnight = Date.parse("2026-09-10T00:30:00Z");
    const previousDay = day([match({ kickoff_at: "2026-09-09T23:00:00Z" })], {
      fetched_at: "2026-09-10T00:25:00Z",
    });
    const final = day(
      [match({ kickoff_at: "2026-09-09T23:00:00Z", status: "FINISHED" })],
      { fetched_at: "2026-09-10T00:30:00Z" },
    );
    expect(featuredMatches([previousDay], afterMidnight)[0].state).toBe("live");
    const [item] = featuredMatches([previousDay, final], afterMidnight);
    expect(item.state).toBe("finished");
    expect(item.date).toBe("2026-09-09");
    expect(item.stale).toBe(false);
  });
  it("never resurrects an old live occurrence when the fresh source cancels the match", () => {
    const older = day([match()], { fetched_at: "2026-09-09T19:55:00Z" });
    const cancelled = day([
      match({ extra: { raw_status: "Cancelled", live_minute: 60 } }),
    ]);
    for (const responses of [
      [older, cancelled],
      [cancelled, older],
    ])
      expect(featuredMatches(responses, now)).toEqual([]);
  });
  it("never infers an old fixture as live or finished, and ignores non-major teams", () => {
    expect(
      featuredMatches(
        [
          day([
            match({ kickoff_at: "2026-09-08T19:00:00Z" }),
            match({ external_match_id: "unknown-time", kickoff_at: null }),
            match({
              external_match_id: "late",
              status: "SCHEDULED",
              kickoff_at: "2026-09-08T19:00:00Z",
            }),
            match({
              external_match_id: "small",
              home: { id: null, name: "Como" },
              away: { id: null, name: "Bolton" },
            }),
          ]),
        ],
        now,
      ),
    ).toEqual([]);
  });
});

describe("confirmed finals across cache refetches", () => {
  it.each(["LIVE", "SCHEDULED"] as const)(
    "protects a cached FT against %s when no historical query is mounted",
    (status) => {
      const final = day([match({ status: "FINISHED" })], {
        fetched_at: "2026-09-09T19:40:00Z",
      });
      const previous = { days: [final], incomplete: false };
      const next = {
        days: [day([match({ status, score: { home: 0, away: 0 } })])],
        incomplete: true,
      };
      const protectedData = preserveFinishedScoreboard(previous, next);
      const [item] = featuredMatches(protectedData.days, now);
      expect(item.state).toBe("finished");
      expect(item.match.score.away).toBe(1);
      expect(item.fetchedAt).toBe(final.fetched_at);
      expect(protectedData.incomplete).toBe(true);
      expect(next.days[0].matches[0].status).toBe(status);
      expect(previous.days[0]).toBe(final);
      const again = preserveFinishedScoreboard(protectedData, next);
      expect(featuredMatches(again.days, now)[0].match.score.away).toBe(1);
    },
  );
  it("keeps fresh live matches fresh while preserving an earlier FT from the same date", () => {
    const final = day([match({ status: "FINISHED" })], {
      fetched_at: "2026-09-09T19:40:00Z",
    });
    const next = {
      days: [day([match(), match({ external_match_id: "fresh-live" })])],
      incomplete: false,
    };
    const result = preserveFinishedScoreboard({ days: [final] }, next);
    const items = featuredMatches(result.days, now);
    expect(
      items.find((item) => item.match.external_match_id === "fresh-live")
        ?.stale,
    ).toBe(false);
    expect(
      items.find((item) => item.match.external_match_id === "one")?.stale,
    ).toBe(true);
  });
  it("accepts cancellation/final corrections and does not resurrect absent events", () => {
    const previous = { days: [day([match({ status: "FINISHED" })])] };
    const cancelled = {
      days: [day([match({ extra: { raw_status: "STATUS_CANCELED" } })])],
    };
    expect(preserveFinishedScoreboard(previous, cancelled)).toBe(cancelled);
    expect(featuredMatches(cancelled.days, now)).toEqual([]);
    const corrected = {
      days: [day([match({ status: "FINISHED", score: { home: 0, away: 2 } })])],
    };
    expect(preserveFinishedScoreboard(previous, corrected)).toBe(corrected);
    const empty = { days: [] };
    expect(preserveFinishedScoreboard(previous, empty)).toBe(empty);
    expect(preserveFinishedScoreboard(undefined, corrected)).toBe(corrected);
  });
});

describe("freshness and malformed service responses", () => {
  it("uses source time, not the fetch completion time", () => {
    expect(matchDataStale(day([]), now)).toBe(false);
    expect(matchDataStale(day([], { source: "stale-cache" }), now)).toBe(true);
    for (const fetched_at of [
      "",
      "invalid",
      "2026-09-09T19:53:59Z",
      "2026-09-09T20:02:00Z",
    ])
      expect(matchDataStale(day([], { fetched_at }), now)).toBe(true);
  });
  it.each([
    { error: "Unavailable" },
    { fallback: true },
    { source: "fallback" },
    { date: "2026-09-08" },
    { matches: null },
  ])("rejects an HTTP 200 error or mismatched date: %j", (invalid) => {
    expect(() =>
      parseMatchesResponse({ ...day([]), ...invalid }, "2026-09-09"),
    ).toThrow();
  });
  it("accepts a successful empty day without inventing a result", () => {
    expect(parseMatchesResponse(day([]), "2026-09-09").matches).toEqual([]);
  });
  it("preserves real zero scores and rejects absent/invalid scores", () => {
    const response = day([
      match({ score: { home: 0, away: null } }),
      match({
        external_match_id: "bad",
        score: { home: "" as unknown as number, away: -1 },
      }),
    ]);
    expect(
      parseMatchesResponse(response, response.date).matches.map((m) => m.score),
    ).toEqual([
      { home: 0, away: null },
      { home: null, away: null },
    ]);
  });
  it("walks local calendar days across month/year boundaries and rejects unbounded history", () => {
    expect(previousMatchDay("2026-01-01", 1)).toBe("2025-12-31");
    expect(previousMatchDay("2026-03-01", 1)).toBe("2026-02-28");
    expect(() => previousMatchDay("2026-02-30", 1)).toThrow();
    expect(() => previousMatchDay("2026-09-09", 15)).toThrow();
  });
});
