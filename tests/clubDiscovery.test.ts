import { expect, it, vi, beforeEach } from "vitest";
const client = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import {
  loadRelatedClubs,
  matchesDirectoryClub,
  profileDepartment,
  uniqueDirectoryClubs,
} from "../src/lib/clubDiscovery";
import type { Club, Profile } from "../src/lib/models";
const club = (id: string, extra: Partial<Club> = {}): Club => ({
  id,
  name: `Club ${id}`,
  city: "Chambéry",
  department_code: "73",
  ...extra,
});
function query(data: unknown[], error: unknown = null) {
  const result = Promise.resolve({ data, error });
  const q: any = { then: result.then.bind(result) };
  for (const method of ["select", "eq", "abortSignal", "in", "or"])
    q[method] = vi.fn(() => q);
  return q;
}
beforeEach(() => client.from.mockReset());
it("keeps non-geolocated linked clubs while respecting all directory filters", () => {
  expect(matchesDirectoryClub(club("a"), "chambery", "73", "club")).toBe(true);
  expect(matchesDirectoryClub(club("a"), "chambery", "74", "club")).toBe(false);
  expect(
    matchesDirectoryClub(
      club("a", { name: "Urban Soccer", type: "club" }),
      "",
      "73",
      "club",
    ),
  ).toBe(false);
  expect(
    matchesDirectoryClub(
      club("a", { type: "five_center" }),
      "",
      "73",
      "five_center",
    ),
  ).toBe(true);
});
it("understands profile department labels including Corsica and overseas", () => {
  expect(profileDepartment("73 - Savoie")).toBe("73");
  expect(profileDepartment("2a")).toBe("2A");
  expect(profileDepartment("974 - La Réunion")).toBe("974");
  expect(profileDepartment("France")).toBe("");
});
it("deduplicates linked and nearby clubs by id without dropping distinct clubs", () => {
  expect(
    uniqueDirectoryClubs([club("a"), club("b")], [club("b"), club("c")]).map(
      (row) => row.id,
    ),
  ).toEqual(["a", "b", "c"]);
});
it("loads followed and approved team clubs for the current member, with attachment first", async () => {
  const followed = query([{ club_id: "followed" }]);
  const members = query([{ team: { club_id: "team" } }]);
  const ids = query([club("followed"), club("team"), club("linked")]);
  const names = query([club("followed"), club("favorite")]);
  client.from
    .mockReturnValueOnce(followed)
    .mockReturnValueOnce(members)
    .mockReturnValueOnce(ids)
    .mockReturnValueOnce(names);
  const rows = await loadRelatedClubs({
    id: "me",
    linked_club_id: "linked",
    club: "Club followed",
    favorite_pro_club: "Club favorite",
  } as Profile);
  expect(followed.eq).toHaveBeenCalledWith("profile_id", "me");
  expect(members.eq).toHaveBeenCalledWith("status", "approved");
  expect(members.eq).toHaveBeenCalledWith("is_active", true);
  expect(ids.in).toHaveBeenCalledWith("id", ["linked", "followed", "team"]);
  expect(rows[0].id).toBe("linked");
  expect(new Set(rows.map((row) => row.id)).size).toBe(4);
});
it("surfaces relationship loading failures instead of silently claiming no linked clubs", async () => {
  client.from
    .mockReturnValueOnce(query([], new Error("unavailable")))
    .mockReturnValueOnce(query([]));
  await expect(loadRelatedClubs({ id: "me" } as Profile)).rejects.toThrow(
    "unavailable",
  );
});
