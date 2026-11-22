import { expect, it } from "vitest";
import { clubCountryLabel, clubLocationLabel } from "../src/lib/clubLocation";
import { clubSearchFilter } from "../src/lib/clubSearch";

it("shows reviewed international countries instead of the INT import marker", () => {
  const imported = { department_code: "INT", metadata: { country: "Allemagne", country_code: "DE" } };
  expect(clubLocationLabel(imported, true)).toBe("Allemagne");
  expect(clubLocationLabel({ ...imported, city: "Munich" })).toBe("Munich · Allemagne");
  expect(clubLocationLabel({ department_code: "INT", metadata: { country_code: "US" } })).toBe("États-Unis");
  expect(clubLocationLabel({ department_code: "INT" })).toBe("");
  expect(clubLocationLabel({ department_code: "INT", city: "Ville", metadata: ["France"] })).toBe("Ville");
  expect(clubCountryLabel({ metadata: { country: 123, country_code: "DE" } })).toBe("Allemagne");
});

it("preserves French departments and never invents a country for missing locations", () => {
  const local = { city: "Chambéry", department_code: "73", department_name: "Savoie" };
  expect(clubLocationLabel(local)).toBe("Chambéry · 73");
  expect(clubLocationLabel(local, true)).toBe("Chambéry · Savoie");
  expect(clubLocationLabel({ ...local, metadata: { country: "France", country_code: "FR" } })).toBe("Chambéry · 73");
  expect(clubLocationLabel({})).toBe("");
});

it("searches country metadata without changing the historical indoor clauses", () => {
  const filter = clubSearchFilter("États-Unis", "all");
  expect(filter).toContain('metadata->>country.ilike."%États-Unis%"');
  expect(filter).toContain('metadata->>country_code.ilike."%États-Unis%"');
  expect(clubSearchFilter("", "all")).toBeNull();
  expect(clubSearchFilter("", "club")).toBe('and(and(name.not.ilike."%five%",name.not.ilike."%soccer%",name.not.ilike."%urban%",name.not.ilike."%foot indoor%",name.not.ilike."%futsal%"))');
  expect(clubSearchFilter("", "five_center")).toBe('and(or(name.ilike."%five%",name.ilike."%soccer%",name.ilike."%urban%",name.ilike."%foot indoor%",name.ilike."%futsal%"))');
  const hostile = 'DE%_\\",name.eq.evil';
  expect(clubSearchFilter(hostile, "all")).toContain(`metadata->>country.ilike.${JSON.stringify(`%${hostile.replace(/[%_\\]/g, "\\$&")}%`)}`);
});
