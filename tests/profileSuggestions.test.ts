import { afterEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ supabase: client }));
import {
  parseCitySuggestions,
  searchProfileSuggestions,
} from "../src/lib/profileSuggestions";
import {
  countryLabel,
  countryOptions,
  normalizeSuggestion,
  proClubOptions,
} from "../src/lib/profileSelectionOptions";
afterEach(() => vi.unstubAllGlobals());
it("shows distinct homonymous towns with their postcode and department, including overseas", () => {
  const rows = parseCitySuggestions({
    features: [
      { properties: { citycode: "73329", city: "Voglans", postcode: "73420" } },
      { properties: { citycode: "73329", city: "Voglans", postcode: "73420" } },
      {
        properties: {
          citycode: "97411",
          city: "Saint-Denis",
          postcode: "97400",
        },
      },
      {
        properties: {
          citycode: "93066",
          city: "Saint-Denis",
          postcode: "93200",
        },
      },
      { properties: { city: "Invalid" } },
    ],
  });
  expect(rows).toHaveLength(3);
  expect(rows[0].department).toBe("73 - Savoie");
  expect(rows[1].department).toContain("974");
  expect(rows[1].detail).not.toBe(rows[2].detail);
});
it("waits for two characters and sends an abortable, encoded municipality lookup", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ features: [] }) });
  vi.stubGlobal("fetch", fetch);
  expect(await searchProfileSuggestions("city", "v")).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
  const signal = new AbortController().signal;
  await searchProfileSuggestions("city", "L'Haÿ &", signal);
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.origin).toBe("https://data.geopf.fr");
  expect(url.searchParams.get("q")).toBe("L'Haÿ &");
  expect(url.searchParams.get("type")).toBe("municipality");
  expect(fetch.mock.calls[0][1].signal).toBe(signal);
});
it("reports lookup failures so free text stays available without claiming no matches", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  await expect(searchProfileSuggestions("city", "Voglans")).rejects.toThrow(
    "indisponible",
  );
});
it("reuses web country codes and international favorite clubs with accent-insensitive lookup", () => {
  expect(countryLabel("BA")).toBe("Bosnie-Herzégovine");
  expect(countryOptions.find((o) => o.value === "FR")?.label).toContain(
    "France",
  );
  expect(proClubOptions.some((o) => o.value === "FC Barcelone")).toBe(true);
  expect(normalizeSuggestion("Défenseur central")).toContain("defenseur");
});
