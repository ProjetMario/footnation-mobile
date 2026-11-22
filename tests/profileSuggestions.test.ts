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

function clubQuery(result: { data: unknown; error: unknown }) {
  const q = {
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    ilike: vi.fn(),
    or: vi.fn(),
    abortSignal: vi.fn(),
    then: (resolve: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  for (const method of [
    q.select,
    q.order,
    q.limit,
    q.ilike,
    q.or,
    q.abortSignal,
  ])
    method.mockReturnValue(q);
  return q;
}
it("shows the country when an international club is selected in a profile", async () => {
  const q = clubQuery({ data: [{ id: "world", name: "FC Example", department_code: "INT", metadata: { country: "Allemagne", country_code: "DE" }, logo_url: null }], error: null });
  client.from.mockReset().mockReturnValue(q);
  expect(await searchProfileSuggestions("club", "Example")).toEqual([{ id: "world", name: "FC Example", detail: "Allemagne", logo: null }]);
});
it("finds a club by its official name before offering broader matches", async () => {
  const q = clubQuery({
    data: [
      {
        id: "club",
        name: "Ent S Drumettaz Mouxy",
        city: "Drumettaz",
        department_code: "73",
        logo_url: null,
      },
    ],
    error: null,
  });
  client.from.mockReset().mockReturnValue(q);
  const signal = new AbortController().signal;
  expect(await searchProfileSuggestions("club", "drumett", signal)).toEqual([
    {
      id: "club",
      name: "Ent S Drumettaz Mouxy",
      detail: "Drumettaz · 73",
      logo: null,
    },
  ]);
  expect(q.ilike).toHaveBeenCalledWith("name", "%drumett%");
  expect(q.or).not.toHaveBeenCalled();
  expect(q.abortSignal).toHaveBeenCalledWith(signal);
});
it("tries the directory city and short name only when the name has no match", async () => {
  const first = clubQuery({ data: [], error: null });
  const second = clubQuery({ data: [], error: null });
  client.from
    .mockReset()
    .mockReturnValueOnce(first)
    .mockReturnValueOnce(second);
  expect(await searchProfileSuggestions("club", "Mouxy")).toEqual([]);
  expect(second.or).toHaveBeenCalledWith(expect.stringContaining("city.ilike"));
  expect(client.from).toHaveBeenCalledTimes(2);
});
it("keeps a directory failure distinct from an empty club list", async () => {
  const q = clubQuery({ data: null, error: new Error("unavailable") });
  client.from.mockReset().mockReturnValue(q);
  await expect(searchProfileSuggestions("club", "drumett")).rejects.toThrow(
    "unavailable",
  );
  expect(client.from).toHaveBeenCalledTimes(1);
});
