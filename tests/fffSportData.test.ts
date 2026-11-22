import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchFffClub, fetchFffTeam } from "../src/lib/fffSportData";
import { requireBackend } from "../src/lib/supabase";

vi.mock("../src/lib/supabase", () => ({ requireBackend: vi.fn() }));
const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "2026_1_SEM_1";
const payload = {
  siteClubId: clubId, seasonStart: 2026, status: "collected", source: "FFF",
  teams: [{ id: teamId, name: "Senior 1", season: "2026", status: "collected", matches: [], standingsByCompetition: [] }],
};
const fetcher = vi.fn();
beforeEach(() => {
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://sport.invalid");
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValue(new Response(JSON.stringify(payload)));
});
afterEach(() => {
  vi.useRealTimers(); vi.resetAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

it("reads only the hosted 2026 club projection with the public gateway headers", async () => {
  const result = await fetchFffClub(clubId);
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe(`https://sport.invalid/functions/v1/club-sport-data?clubId=${clubId}&season=2026`);
  expect(init.method).toBe("GET");
  expect(init.headers).toEqual({ apikey: "public-test-key", Authorization: "Bearer public-test-key" });
  expect(init.signal.aborted).toBe(false);
  expect(requireBackend).toHaveBeenCalledOnce();
  expect(result.teams.map(team => team.id)).toEqual([teamId]);
  expect(fetcher).toHaveBeenCalledOnce();
});

it("resolves a team through the exact identifier and returns its club and competitions", async () => {
  const result = await fetchFffTeam(teamId);
  expect(fetcher.mock.calls[0][0]).toContain(`teamId=${teamId}&season=2026`);
  expect(result.team.id).toBe(teamId);
  expect(result.rankings).toEqual(result.team.rankings);
});

it.each(["2025_1_SEM_1", "12", "Senior 1"])("rejects an unverified or old team before any request: %s", async id => {
  await expect(fetchFffTeam(id)).rejects.toThrow("identifiant FFF 2026–2027 vérifié");
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([[404, "introuvables"], [503, "momentanément indisponibles"]])("reports HTTP %s without exposing its body", async (status, message) => {
  fetcher.mockResolvedValue(new Response("private upstream error", { status: Number(status) }));
  await expect(fetchFffClub(clubId)).rejects.toThrow(String(message));
  expect(fetcher).toHaveBeenCalledOnce();
});

it.each([{ ...payload, seasonStart: 2025 }, { ...payload, siteClubId: "other-club" }])("rejects a response for another season or club", async value => {
  fetcher.mockResolvedValue(new Response(JSON.stringify(value)));
  await expect(fetchFffClub(clubId)).rejects.toThrow();
});

it("does not choose a namesake when the requested team is absent", async () => {
  await expect(fetchFffTeam("2026_1_SEM_4")).rejects.toThrow("Équipe 2026–2027 introuvable");
});

it("cancels a stalled request at 15 seconds without fallback to direct FFF requests", async () => {
  vi.useFakeTimers();
  fetcher.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }));
  const rejected = expect(fetchFffClub(clubId)).rejects.toThrow("aborted");
  await vi.advanceTimersByTimeAsync(15000);
  await rejected;
  expect(fetcher).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("stops before networking when the backend is unconfigured", async () => {
  vi.mocked(requireBackend).mockImplementation(() => { throw new Error("backend unavailable"); });
  await expect(fetchFffClub(clubId)).rejects.toThrow("backend unavailable");
  expect(fetcher).not.toHaveBeenCalled();
});
