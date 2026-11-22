import { beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  provider: vi.fn(),
  invoke: vi.fn(),
  cache: vi.fn(),
}));
vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
  useState: (initial: unknown) => [
    typeof initial === "function" ? initial() : initial,
    vi.fn(),
  ],
}));
vi.mock("react-native", () => ({ AppState: { currentState: "active" } }));
vi.mock("expo-router", () => ({ useFocusEffect: () => {} }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((options) => options),
  useQueryClient: () => ({ getQueryData: fixture.cache }),
}));
vi.mock("../src/components/ConnectivityProvider", () => ({
  useConnectivity: () => ({ isOffline: false }),
}));
vi.mock("../src/lib/supabase", () => ({
  requireBackend: () => {},
  supabase: { functions: { invoke: fixture.invoke } },
}));
vi.mock("../src/lib/espnMatches", () => ({
  fetchFeaturedScoreboard: fixture.provider,
  fetchEspnMatchDay: vi.fn(),
  fetchUpcomingFeaturedScoreboard: vi.fn(),
  fetchNationalMatchDay: vi.fn(),
  isEspnMatchId: vi.fn(),
}));

import { useQuery } from "@tanstack/react-query";
import { useMatches } from "../src/lib/useMatches";

const date = "2026-11-15";
const match = {
  external_match_id: "match-1",
  tournament: { id: null, name: "Compétition" },
  home: { id: null, name: "Domicile" },
  away: { id: null, name: "Extérieur" },
  kickoff_at: "2026-11-15T17:00:00Z",
  status: "LIVE",
  score: { home: 1, away: 0 },
};
const cached = {
  date,
  fetched_at: "2026-11-15T18:00:00Z",
  source: "supabase",
  matches: [match],
  teams: [],
  tournaments: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  fixture.cache.mockImplementation((key: unknown[]) =>
    key[0] === "matches" ? cached : undefined,
  );
  fixture.provider.mockRejectedValue(new Error("ESPN unavailable"));
  fixture.invoke.mockResolvedValue({ data: cached, error: null });
});

it("seeds the all-matches screen and retrieves alternate scores when ESPN fails", async () => {
  useMatches(date, "all");
  const options = vi.mocked(useQuery).mock.lastCall?.[0] as unknown as {
    initialData: () => typeof cached;
    initialDataUpdatedAt: number;
    queryFn: (context: {
      signal: AbortSignal;
    }) => Promise<
      typeof cached & { alternative_source?: boolean; incomplete?: boolean }
    >;
  };
  expect(options.initialData()).toMatchObject({
    matches: [match],
    incomplete: true,
    alternative_source: true,
  });
  expect(options.initialDataUpdatedAt).toBe(0);
  const result = await options.queryFn({
    signal: new AbortController().signal,
  });
  expect(result).toMatchObject({
    matches: [match],
    incomplete: true,
    alternative_source: true,
  });
  expect(fixture.invoke).toHaveBeenCalledWith(
    `matches?date=${date}`,
    expect.objectContaining({ method: "GET" }),
  );
});
