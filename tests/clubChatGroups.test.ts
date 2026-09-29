import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({
  from: vi.fn(),
  auth: { getUser: vi.fn() },
}));
const membership = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
vi.mock("../src/lib/clubMembership", () => ({
  loadClubMembership: membership,
}));
import { loadClubChatGroups } from "../src/lib/clubChatGroups";
beforeEach(() => {
  client.from.mockReset();
  client.auth.getUser.mockReset();
  membership.mockReset();
});
function query(error: unknown = null) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn().mockResolvedValue({ data: [{ id: "membership" }], error }),
  };
  for (const f of [q.select, q.eq, q.order]) f.mockReturnValue(q);
  client.from.mockReturnValue(q);
  return q;
}
it("filtre compte et club avant la pagination, avec jointure interne", async () => {
  membership.mockResolvedValue({ allowed: true });
  const q = query();
  expect(await loadClubChatGroups("user", 30, "club")).toEqual([
    { id: "membership" },
  ]);
  expect(membership).toHaveBeenCalledWith("club", "user");
  expect(q.eq.mock.calls).toEqual([
    ["profile_id", "user"],
    ["group.club_id", "club"],
  ]);
  expect(q.select.mock.calls[0][0]).toContain("!group_id!inner");
  expect(q.eq.mock.invocationCallOrder[1]).toBeLessThan(
    q.range.mock.invocationCallOrder[0],
  );
  expect(q.range).toHaveBeenCalledWith(30, 59);
});
it("refuse de charger si l’appartenance au club est retirée", async () => {
  membership.mockResolvedValue({ allowed: false });
  await expect(loadClubChatGroups("user", 0, "club")).rejects.toThrow("accès");
  expect(client.from).not.toHaveBeenCalled();
});
it("la liste globale vérifie la session et garde tous les clubs du compte", async () => {
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: "user" } },
    error: null,
  });
  const q = query();
  await loadClubChatGroups("user", 0);
  expect(q.eq.mock.calls).toEqual([["profile_id", "user"]]);
  expect(membership).not.toHaveBeenCalled();
  client.from.mockClear();
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: "other" } },
    error: null,
  });
  await expect(loadClubChatGroups("user", 0)).rejects.toThrow("session");
  expect(client.from).not.toHaveBeenCalled();
});
it("propage une erreur de liste au lieu de simuler une liste vide", async () => {
  membership.mockResolvedValue({ allowed: true });
  query(new Error("Réseau"));
  await expect(loadClubChatGroups("user", 0, "club")).rejects.toThrow("Réseau");
});
