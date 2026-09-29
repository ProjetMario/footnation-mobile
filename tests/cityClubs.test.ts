import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import {
  groupCityClubs,
  loadDepartmentCityClubs,
  type CityClub,
} from "../src/lib/cityClubs";
import { citySlug, parseCityDeptUrl, cityUrl } from "../src/lib/citySlug";
import { notificationPath } from "../src/lib/notificationPath";
beforeEach(() => client.from.mockReset());
function club(id: string, city: string | null): CityClub {
  return { id, name: id, city, logo_url: null, type: null };
}
function page(data: CityClub[], error: unknown = null) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn().mockResolvedValue({ data, error }),
  };
  for (const f of [q.select, q.eq, q.order]) f.mockReturnValue(q);
  client.from.mockReturnValueOnce(q);
  return q;
}
it("regroupe accents, casse et apostrophes selon les liens du site", () => {
  expect(citySlug("L’Haÿ-les-Roses")).toBe("l-hay-les-roses");
  const groups = groupCityClubs([
    club("a", "Saint-Étienne"),
    club("b", "SAINT ETIENNE"),
    club("c", null),
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0].clubs).toHaveLength(2);
  expect(parseCityDeptUrl("ajaccio-2a")).toEqual({
    citySlug: "ajaccio",
    deptCode: "2A",
  });
  expect(notificationPath("/clubs-ville-saint-etienne-42")).toBe(
    cityUrl("Saint-Étienne", "42"),
  );
});
it("charge au-delà de 500 clubs avant de calculer les villes", async () => {
  const first = page(
    Array.from({ length: 500 }, (_, i) => club(String(i), "Lyon")),
  );
  const last = page([club("last", "Bessenay")]);
  const groups = await loadDepartmentCityClubs("69");
  expect(groups.map((c) => c.clubs.length)).toEqual([500, 1]);
  for (const q of [first, last])
    expect(q.eq).toHaveBeenCalledWith("department_code", "69");
  expect(first.range).toHaveBeenCalledWith(0, 499);
  expect(last.range).toHaveBeenCalledWith(500, 999);
});
it("n’affiche pas un annuaire partiel après une erreur", async () => {
  page(Array.from({ length: 500 }, (_, i) => club(String(i), "Lyon")));
  page([], new Error("Réseau"));
  await expect(loadDepartmentCityClubs("69")).rejects.toThrow("Réseau");
});
