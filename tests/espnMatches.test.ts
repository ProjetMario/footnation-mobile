import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ESPN_LEAGUES,
  espnLeagueFromId,
  fetchEspnMatchDay,
  fetchFeaturedScoreboard,
  fetchNationalMatchDay,
  isEspnMatchId,
  parseEspnScoreboard,
} from "../src/lib/espnMatches";
import { calendarDate } from "../src/lib/calendarDate";
import { matchState } from "../src/lib/featuredMatches";
import { NATIONAL_LEAGUES, isNationalMatch } from "../src/lib/nationalMatches";

const fetchedAt = "2026-09-09T20:00:00Z";
function event(
  overrides: {
    id?: string;
    date?: string;
    state?: string;
    completed?: boolean;
    name?: string;
    homeScore?: unknown;
    awayScore?: unknown;
    logo?: string;
  } = {},
) {
  const status = {
    displayClock: "45'+2'",
    type: {
      state: overrides.state ?? "post",
      completed: overrides.completed ?? true,
      name: overrides.name ?? "STATUS_FULL_TIME",
      description: overrides.name ?? "Full Time",
      detail: "Provider status",
    },
  };
  return {
    id: overrides.id ?? "1001",
    date: overrides.date ?? "2026-09-09T19:00:00Z",
    status,
    competitions: [
      {
        status,
        venue: { fullName: "Stade de test" },
        // Intentionally away first: array order must not determine home/away.
        competitors: [
          {
            homeAway: "away",
            score:
              overrides.awayScore === undefined ? "2" : overrides.awayScore,
            team: {
              id: "22",
              displayName: "Club B",
              abbreviation: "CB",
              logo: "https://a.espncdn.com/team-b.png",
            },
          },
          {
            homeAway: "home",
            score:
              overrides.homeScore === undefined ? "0" : overrides.homeScore,
            team: {
              id: "11",
              displayName: "Club A",
              shortDisplayName: "Club A court",
              logo: overrides.logo ?? "https://a.espncdn.com/team-a.png",
            },
          },
        ],
      },
    ],
  };
}
function payload(league = "fra.1", events: unknown[] = [event()]) {
  return {
    leagues: [
      { slug: league, name: `Compétition ${league}`, abbreviation: league },
    ],
    events,
  };
}
function response(league: string, events?: unknown[]) {
  return { ok: true, json: async () => payload(league, events) } as Response;
}
function leagueFromUrl(input: unknown) {
  return String(input).match(/\/soccer\/([^/]+)\//)![1];
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ESPN normalization", () => {
  it("recognizes national competitions without including club tournaments", () => {
    for (const league of NATIONAL_LEAGUES) {
      const [day] = parseEspnScoreboard(payload(league), league, fetchedAt);
      expect(isNationalMatch(day.matches[0])).toBe(true);
      expect(espnLeagueFromId(day.matches[0].external_match_id)).toBe(league);
    }
    const match = parseEspnScoreboard(payload(), "fra.1", fetchedAt)[0]
      .matches[0];
    for (const name of [
      "FIFA Club World Cup",
      "Club Friendly",
      "AFC Champions League Two",
      "French Ligue 1",
    ]) {
      expect(
        isNationalMatch({ ...match, tournament: { id: null, name } }),
      ).toBe(false);
    }
  });

  it("loads the selected nations day in bounded batches, filtering adjacent dates", async () => {
    vi.stubEnv("TZ", "Europe/Paris");
    let active = 0;
    let peak = 0;
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        urls.push(String(input));
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        const league = leagueFromUrl(input);
        return response(league, [
          event({ date: "2026-09-09T19:00:00Z" }),
          event({ id: "2", date: "2026-09-08T12:00:00Z" }),
        ]);
      }),
    );
    const result = await fetchNationalMatchDay("2026-09-09");
    expect(peak).toBeLessThanOrEqual(3);
    expect(result.matches).toHaveLength(NATIONAL_LEAGUES.length);
    expect(result.incomplete).toBe(false);
    expect(urls.every((url) => /dates=2026090[89]&/.test(url))).toBe(true);
    expect(result.matches.every(isNationalMatch)).toBe(true);
  });

  it("keeps other nations when one competition fails and rejects total failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const league = leagueFromUrl(input);
        if (league === "uefa.nations") throw new Error("offline");
        return response(league);
      }),
    );
    expect((await fetchNationalMatchDay("2026-09-09")).incomplete).toBe(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(fetchNationalMatchDay("2026-09-09")).rejects.toThrow(
      "temporairement indisponibles",
    );
  });
  it("preserves final zero scores, home/away identity and source read time", () => {
    const original = payload();
    const before = JSON.stringify(original);
    const [day] = parseEspnScoreboard(original, "fra.1", fetchedAt);
    expect(day.date).toBe(calendarDate(new Date("2026-09-09T19:00:00Z")));
    expect(day.fetched_at).toBe(fetchedAt);
    expect(day.source).toBe("espn");
    expect(day.matches[0]).toMatchObject({
      external_match_id: "espn:fra.1:1001",
      home: { name: "Club A", shortName: "Club A court", id: "espn:team:11" },
      away: { name: "Club B", shortName: "CB" },
      score: { home: 0, away: 2 },
      status: "FINISHED",
      status_label: "FT",
      extra: { raw_status: "FT", live_minute: null },
    });
    expect(day.teams).toHaveLength(2);
    expect(JSON.stringify(original)).toBe(before);
  });

  it("does not turn ESPN's pre-kickoff zeros into observed scores", () => {
    const [day] = parseEspnScoreboard(
      payload("fra.1", [
        event({
          state: "pre",
          completed: false,
          name: "STATUS_SCHEDULED",
          homeScore: "0",
          awayScore: "0",
        }),
      ]),
      "fra.1",
      fetchedAt,
    );
    expect(day.matches[0]).toMatchObject({
      status: "SCHEDULED",
      status_label: "NS",
      score: { home: null, away: null },
      extra: { raw_status: "NS", live_minute: null },
    });
  });

  it("recognizes halftime and keeps its actual score and clock", () => {
    const [day] = parseEspnScoreboard(
      payload("eng.1", [
        event({ state: "in", completed: false, name: "STATUS_HALFTIME" }),
      ]),
      "eng.1",
      fetchedAt,
    );
    expect(day.matches[0]).toMatchObject({
      status: "LIVE",
      status_label: "HT",
      score: { home: 0, away: 2 },
      extra: { raw_status: "HT", live_minute: "45'+2'" },
    });
    expect(matchState(day.matches[0])).toBe("live");
  });

  it.each([
    "STATUS_POSTPONED",
    "STATUS_CANCELED",
    "STATUS_SUSPENDED",
    "STATUS_ABANDONED",
  ])(
    "preserves %s so a cancelled update suppresses an older live snapshot",
    (name) => {
      const [day] = parseEspnScoreboard(
        payload("fra.1", [event({ state: "in", completed: false, name })]),
        "fra.1",
        fetchedAt,
      );
      expect(day.matches[0].extra?.raw_status).toBe(name);
      expect(day.matches[0].score).toEqual({ home: null, away: null });
      expect(matchState(day.matches[0])).toBe("unknown");
    },
  );

  it("groups events by local calendar date and deduplicates event IDs", () => {
    const first = event({ id: "1", date: "2026-09-08T23:30:00Z" });
    const second = event({ id: "2", date: "2026-09-10T12:00:00Z" });
    const days = parseEspnScoreboard(
      payload("fra.1", [second, first, first]),
      "fra.1",
      fetchedAt,
    );
    expect(days.flatMap((day) => day.matches)).toHaveLength(2);
    for (const day of days)
      for (const match of day.matches)
        expect(day.date).toBe(calendarDate(new Date(match.kickoff_at!)));
    expect(days.map((day) => day.date)).toEqual(
      [...days.map((day) => day.date)].sort(),
    );
  });

  it("rejects malformed/absent scores and unsafe logo URLs without inventing values", () => {
    const days = parseEspnScoreboard(
      payload("fra.1", [
        event({ homeScore: "", awayScore: true, logo: "javascript:alert(1)" }),
        event({
          id: "2",
          homeScore: "-1",
          awayScore: "0.5",
          logo: "http://example.com/logo.png",
        }),
        event({
          id: "3",
          homeScore: null,
          awayScore: null,
          logo: "https://user:password@example.com/logo.png",
        }),
      ]),
      "fra.1",
      fetchedAt,
    );
    for (const match of days[0].matches) {
      expect(match.score).toEqual({ home: null, away: null });
      expect(match.home.logo).toBeNull();
    }
  });

  it("rejects broken service envelopes but accepts successful empty coverage", () => {
    for (const invalid of [
      null,
      {},
      { events: [] },
      payload("eng.1"),
      { ...payload(), events: null },
      payload("fra.1", [
        event({ id: "../bad" }),
        event({ date: "not-a-date" }),
      ]),
    ])
      expect(() => parseEspnScoreboard(invalid, "fra.1", fetchedAt)).toThrow();
    expect(
      parseEspnScoreboard(payload("fra.1", []), "fra.1", fetchedAt),
    ).toEqual([]);
    expect(() => parseEspnScoreboard(payload(), "fra.1", "invalid")).toThrow();
  });

  it("only accepts bounded ESPN IDs from the league whitelist", () => {
    for (const league of ESPN_LEAGUES) {
      const id = `espn:${league}:12345`;
      expect(isEspnMatchId(id)).toBe(true);
      expect(espnLeagueFromId(id)).toBe(league);
    }
    for (const id of [
      "12345",
      "espn:unknown:1",
      "espn:fra.1:../1",
      "espn:fra.1:1?date=bad",
      "espn:fra.1:0",
      "espn:fra.1:1:extra",
    ]) {
      expect(isEspnMatchId(id)).toBe(false);
      expect(espnLeagueFromId(id)).toBeUndefined();
    }
  });
});

describe("bounded ESPN requests", () => {
  it("loads daily results when the provider rejects date ranges", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        urls.push(url);
        const dates = new URL(url).searchParams.get("dates")!;
        if (dates.includes("-")) return { ok: false, status: 400 };
        return response(leagueFromUrl(input));
      }),
    );
    const result = await fetchFeaturedScoreboard("2026-09-09", undefined, 0);
    expect(result.incomplete).toBe(false);
    expect(result.days.flatMap((day) => day.matches)).toHaveLength(6);
    expect(urls.filter((url) => /dates=2026090[89]&/.test(url))).toHaveLength(
      12,
    );
    expect(urls.filter((url) => url.includes("dates=20260910&"))).toHaveLength(
      6,
    );
  });

  it("requests six leagues in batches of at most three and merges their days", async () => {
    let active = 0;
    let peak = 0;
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        urls.push(String(input));
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active--;
        return response(leagueFromUrl(input));
      }),
    );
    const result = await fetchFeaturedScoreboard("2026-09-09");
    expect(peak).toBe(3);
    expect(urls).toHaveLength(6);
    expect(
      urls.every((url) => url.endsWith("?dates=20260825-20260910&limit=100")),
    ).toBe(true);
    expect(result.incomplete).toBe(false);
    expect(result.days.flatMap((day) => day.matches)).toHaveLength(6);
    expect(result.days[0].tournaments).toHaveLength(6);
    expect(result.days[0].teams).toHaveLength(2);
  });

  it("supports a today-only request and does not keep out-of-range events", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        calls.push(String(input));
        return response(leagueFromUrl(input), [
          event({ date: "2026-09-08T12:00:00Z" }),
          event({ id: "2", date: "2026-09-09T12:00:00Z" }),
          event({ id: "3", date: "2026-09-10T12:00:00Z" }),
        ]);
      }),
    );
    const result = await fetchFeaturedScoreboard("2026-09-09", undefined, 0);
    expect(
      calls.every((url) => url.endsWith("?dates=20260908-20260910&limit=100")),
    ).toBe(true);
    expect(result.days.map((day) => day.date)).toEqual(["2026-09-09"]);
    expect(result.days[0].matches).toHaveLength(6);
  });

  it.each([
    ["America/New_York", "2026-09-10T01:00:00Z"],
    ["Asia/Tokyo", "2026-09-08T22:00:00Z"],
  ])(
    "keeps a local-today event from an adjacent UTC date in %s",
    async (zone, kickoff) => {
      vi.stubEnv("TZ", zone);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: unknown) =>
          response(leagueFromUrl(input), [event({ date: kickoff })]),
        ),
      );
      const result = await fetchFeaturedScoreboard("2026-09-09", undefined, 0);
      expect(result.days.map((day) => day.date)).toEqual(["2026-09-09"]);
      expect(result.days[0].matches).toHaveLength(6);
    },
  );

  it("returns successful leagues with incomplete=true and throws if every source fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) =>
        leagueFromUrl(input) === "fra.1"
          ? { ok: false }
          : response(leagueFromUrl(input)),
      ),
    );
    const partial = await fetchFeaturedScoreboard("2026-09-09");
    expect(partial.incomplete).toBe(true);
    expect(partial.days[0].matches).toHaveLength(5);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Unavailable");
      }),
    );
    await expect(fetchFeaturedScoreboard("2026-09-09")).rejects.toThrow(
      "temporairement indisponibles",
    );
  });

  it("treats valid empty leagues as an honest empty result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => response(leagueFromUrl(input), [])),
    );
    await expect(fetchFeaturedScoreboard("2026-09-09")).resolves.toEqual({
      days: [],
      incomplete: false,
    });
  });

  it("aborts pending requests and does not start another batch", async () => {
    const controller = new AbortController();
    const signals: AbortSignal[] = [];
    const fetch = vi.fn((_input: unknown, init: RequestInit) => {
      signals.push(init.signal!);
      return new Promise(() => {});
    });
    vi.stubGlobal("fetch", fetch);
    const request = fetchFeaturedScoreboard("2026-09-09", controller.signal);
    const assertion = expect(request).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("bounds each request to ten seconds even when the transport ignores abort", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetch = vi.fn((_input: unknown, init: RequestInit) => {
      signals.push(init.signal!);
      return new Promise(() => {});
    });
    vi.stubGlobal("fetch", fetch);
    const request = fetchFeaturedScoreboard("2026-09-09");
    const assertion = expect(request).rejects.toThrow(
      "temporairement indisponibles",
    );
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(signals.slice(0, 3).every((signal) => signal.aborted)).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects invalid periods and pre-aborted signals before any network call", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const daysBack of [-1, 15, 1.5, NaN])
      await expect(
        fetchFeaturedScoreboard("2026-09-09", undefined, daysBack),
      ).rejects.toThrow();
    await expect(fetchFeaturedScoreboard("2026-02-30")).rejects.toThrow();
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchFeaturedScoreboard("2026-09-09", controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads adjacent days for a dated deep link while keeping the requested response date", async () => {
    const fetch = vi.fn(async (_input: unknown) =>
      response("fra.1", [
        event({ date: "2026-09-08T23:30:00Z" }),
        event({ id: "2", date: "2026-09-10T12:00:00Z" }),
      ]),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await fetchEspnMatchDay("fra.1", "2026-09-09");
    expect(result.date).toBe("2026-09-09");
    expect(result.matches).toHaveLength(2);
    expect(fetch.mock.calls[0][0]).toBe(
      "https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard?dates=20260908-20260910&limit=100",
    );
    await expect(
      fetchEspnMatchDay("fra.1/evil", "2026-09-09"),
    ).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
