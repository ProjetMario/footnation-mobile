import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import { loadClubMatchTotals } from "../src/lib/clubMatchTotals";
beforeEach(() => client.from.mockReset());
function page(data: unknown[], error: unknown = null) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn().mockResolvedValue({ data, error }),
  };
  for (const fn of [q.select, q.eq, q.order]) fn.mockReturnValue(q);
  client.from.mockReturnValueOnce(q);
  return q;
}
it("calcule domicile et extérieur, conserve le 0-0 et distingue les scores incomplets", async () => {
  page([
    { home_score: 3, away_score: 1, is_home: true },
    { home_score: 1, away_score: 2, is_home: false },
    { home_score: 0, away_score: 0, is_home: true },
    { home_score: 2, away_score: 1, is_home: false },
    { home_score: null, away_score: 0, is_home: true },
    { home_score: 1, away_score: 0, is_home: null },
    { home_score: -1, away_score: 0, is_home: true },
  ]);
  expect(await loadClubMatchTotals("club", async () => {})).toEqual({
    finished: 7,
    scored: 4,
    missing: 3,
    wins: 2,
    draws: 1,
    losses: 1,
    goalsFor: 6,
    goalsAgainst: 4,
  });
});
it("charge toutes les pages du club et vérifie l’accès avant chaque page", async () => {
  const first = page(
    Array.from({ length: 500 }, () => ({
      home_score: 0,
      away_score: 0,
      is_home: true,
    })),
  );
  const second = page([{ home_score: 1, away_score: 0, is_home: true }]);
  const authorize = vi.fn().mockResolvedValue(undefined);
  const result = await loadClubMatchTotals("club-a", authorize);
  expect(result.finished).toBe(501);
  expect(result.draws).toBe(500);
  expect(result.wins).toBe(1);
  expect(authorize).toHaveBeenCalledTimes(2);
  for (const q of [first, second]) {
    expect(q.eq).toHaveBeenCalledWith("club_id", "club-a");
    expect(q.eq).toHaveBeenCalledWith("status", "finished");
    expect(q.order).toHaveBeenCalledWith("id");
  }
  expect(first.range).toHaveBeenCalledWith(0, 499);
  expect(second.range).toHaveBeenCalledWith(500, 999);
});
it("ne retourne pas de bilan partiel si l’accès est retiré pendant la pagination", async () => {
  page(
    Array.from({ length: 500 }, () => ({
      home_score: 0,
      away_score: 0,
      is_home: true,
    })),
  );
  const authorize = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("Accès retiré"));
  await expect(loadClubMatchTotals("club", authorize)).rejects.toThrow(
    "Accès retiré",
  );
  expect(client.from).toHaveBeenCalledTimes(1);
});
it("propage une erreur serveur au lieu d’afficher un bilan vide", async () => {
  page([], new Error("Indisponible"));
  await expect(loadClubMatchTotals("club", async () => {})).rejects.toThrow(
    "Indisponible",
  );
});
