import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({
  from: vi.fn(),
  auth: { getUser: vi.fn() },
}));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import { loadManagedClubs } from "../src/lib/managedClubs";
beforeEach(() => {
  client.from.mockReset();
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: "user" } },
    error: null,
  });
});
function query(data: unknown[], error: unknown = null) {
  const result = Promise.resolve({ data, error });
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    in: vi.fn(),
    then: result.then.bind(result),
  };
  for (const f of [q.select, q.eq, q.order, q.range, q.in])
    f.mockReturnValue(q);
  client.from.mockReturnValueOnce(q);
  return q;
}
it("scope au compte avant pagination et ne lit que les clubs de cette page", async () => {
  const memberships = query([
    { id: "a", club_id: "one" },
    { id: "b", club_id: "two" },
  ]);
  const clubs = query([{ id: "one", name: "Club" }]);
  const result = await loadManagedClubs("user", 30);
  expect(memberships.eq).toHaveBeenCalledWith("profile_id", "user");
  expect(memberships.range).toHaveBeenCalledWith(30, 59);
  expect(clubs.in).toHaveBeenCalledWith("id", ["one", "two"]);
  expect(result).toHaveLength(2);
  expect(result[1].club).toBeNull();
});
it("refuse un changement de session sans lire les affectations", async () => {
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: "other" } },
    error: null,
  });
  await expect(loadManagedClubs("user", 0)).rejects.toThrow("session");
  expect(client.from).not.toHaveBeenCalled();
});
it("préserve une affectation orpheline sans requête UUID invalide", async () => {
  query([{ id: "a", club_id: null }]);
  expect(await loadManagedClubs("user", 0)).toEqual([
    { id: "a", club_id: null, club: null },
  ]);
  expect(client.from).toHaveBeenCalledTimes(1);
});
it("propage une erreur de fiche au lieu de cacher les affectations", async () => {
  query([{ id: "a", club_id: "one" }]);
  query([], new Error("Réseau"));
  await expect(loadManagedClubs("user", 0)).rejects.toThrow("Réseau");
});
