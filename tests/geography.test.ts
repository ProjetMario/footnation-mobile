import { describe, expect, it } from "vitest";
import { ALL_GEO as siteLocations } from "../../src/data/geo/locations";
import { GEO_PATHS } from "../src/data/geography/paths";
import { GEO_I18N } from "../src/data/geography/geoTranslations";
import {
  ALL_GEO,
  GEO_CITIES,
  GEO_COUNTRIES,
  COUNTRIES,
  geographyCountries,
  geographyCountry,
  countryCities,
  geographyLocation,
  geographyContent,
  geographyCountrySummary,
  geographyLanguages,
  geographyLocale,
  resolveGeographyPath,
  geographyPath,
  geographyActions,
  countryArticle,
  countryCodeForArticle,
  filterGeography,
} from "../src/lib/geography";
describe("geographic content carried from the site", () => {
  it("preserves all existing city and country introductions without inventing destinations", () => {
    expect(ALL_GEO).toEqual(siteLocations);
    expect(GEO_CITIES).toHaveLength(45);
    expect(GEO_COUNTRIES).toHaveLength(16);
    expect(new Set(ALL_GEO.map((entry) => entry.slug)).size).toBe(
      ALL_GEO.length,
    );
  });
  it("groups every city by its real country, including countries with only a city guide", () => {
    for (const city of GEO_CITIES) {
      expect(geographyCountry(city.countryCode!)).toMatchObject({
        name: city.country,
      });
      expect(countryCities(city.countryCode!)).toContainEqual(city);
    }
    expect(countryCities("BR").map((city) => city.slug)).toEqual(["sao-paulo"]);
    expect(countryCities("JP").map((city) => city.slug)).toEqual(["tokyo"]);
    expect(countryCities("invalid")).toEqual([]);
  });
  it("retains only the three actual country dossiers with their FAQ and nationality contract", () => {
    expect(COUNTRIES.map((country) => country.slug)).toEqual([
      "france",
      "espagne",
      "bresil",
    ]);
    expect(countryArticle("ES")).toMatchObject({ nationality: "Espagnole" });
    expect(countryArticle("BR")?.faq).toHaveLength(3);
    expect(geographyCountrySummary(countryArticle("BR")!)).toHaveLength(4);
    expect(countryArticle("JP")).toBeUndefined();
    expect(countryCodeForArticle("bresil")).toBe("BR");
    expect(countryCodeForArticle("__proto__")).toBeUndefined();
    expect(countryCodeForArticle("constructor")).toBeUndefined();
  });
  it("offers only existing translations and identifies the French fallback", () => {
    expect(Object.keys(GEO_I18N)).toHaveLength(16);
    expect(geographyLanguages("londres")).toHaveLength(7);
    expect(geographyLanguages("marseille")).toEqual(["fr"]);
    expect(geographyContent(geographyLocation("londres")!, "en")).toMatchObject(
      { name: "London", translated: true, h1: "Football in London" },
    );
    expect(
      geographyContent(geographyLocation("londres")!, "ar").intro,
    ).toContain("لندن");
    expect(
      geographyContent(geographyLocation("marseille")!, "en"),
    ).toMatchObject({
      intro: geographyLocation("marseille")!.intro,
      translated: false,
    });
    expect(geographyLocale(["en", "ar"])).toBe("fr");
  });
  it("searches accents without conflating an editorial destination with a club result", () => {
    expect(
      filterGeography(geographyCountries, "  bresil ").map(
        (country) => country.code,
      ),
    ).toEqual(["BR"]);
    expect(filterGeography(GEO_CITIES, "sao").map((city) => city.slug)).toEqual(
      ["sao-paulo"],
    );
    expect(geographyActions()).toEqual([
      { label: "Annuaire des clubs en France", path: "/clubs" },
      { label: "Toutes les opportunités", path: "/opportunities" },
      { label: "Découvrir le réseau", path: "/network" },
    ]);
  });
});
describe("site geography aliases", () => {
  it("resolves every canonical and translated existing city route exactly", () => {
    for (const location of ALL_GEO)
      expect(resolveGeographyPath(`/football-${location.slug}`)).toEqual({
        slug: location.slug,
        locale: "fr",
      });
    for (const [slug, paths] of Object.entries(GEO_PATHS)) {
      for (const [locale, path] of Object.entries(paths))
        expect(resolveGeographyPath(path)).toEqual({ slug, locale });
    }
    expect(resolveGeographyPath("/it/calcio-parigi/")).toEqual({
      slug: "paris",
      locale: "it",
    });
    expect(geographyPath("paris", "ar")).toBe("/geography/paris?lang=ar");
  });
  it.each([
    "/football-nulle-part",
    "/en/football-marseille",
    "/fr/football-paris",
    "/en/football-londres",
    "https://evil.test/en/football-london",
    "//en/football-london",
    "/en/%66ootball-london",
    "/en/football-london?redirect=evil",
    "/en/football-london\\x",
    "/en/football-london\n",
  ])("rejects unknown or ambiguous route %s", (path) =>
    expect(resolveGeographyPath(path)).toBeNull(),
  );
});
