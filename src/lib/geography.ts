import {
  ALL_GEO,
  GEO_CITIES,
  GEO_COUNTRIES,
  type GeoLocation,
} from "../data/geography/locations";
import { GEO_I18N } from "../data/geography/geoTranslations";
import { GEO_PATHS } from "../data/geography/paths";
import { COUNTRIES } from "../data/geography/countries";
import { SEO_LOCALES, type SeoLocale } from "../data/geography/locales";

export { ALL_GEO, GEO_CITIES, GEO_COUNTRIES, COUNTRIES };
export type { GeoLocation, SeoLocale };
const articleCodes: Record<string, string> = {
  france: "FR",
  espagne: "ES",
  bresil: "BR",
};
export const geographyCountries = [
  ...new Map(
    ALL_GEO.map((location) => [
      location.countryCode!,
      {
        code: location.countryCode!,
        name: location.country,
      },
    ]),
  ).values(),
].sort((a, b) => a.name.localeCompare(b.name, "fr"));
export function geographyLocale(value: unknown): SeoLocale {
  return typeof value === "string" &&
    (SEO_LOCALES as readonly string[]).includes(value)
    ? (value as SeoLocale)
    : "fr";
}
export function geographyLocation(slug: string) {
  return ALL_GEO.find((entry) => entry.slug === slug);
}
export function geographyCountry(code: string) {
  return geographyCountries.find((entry) => entry.code === code);
}
export function geographyArticle(slug: string) {
  return COUNTRIES.find((entry) => entry.slug === slug);
}
export function geographyCountrySummary(country: (typeof COUNTRIES)[number]) {
  // Visible AiSummary copy from the site's CountryPage, retained in its original language.
  return [
    `FootNation lists football players and clubs in ${country.name}.`,
    `Discover ${country.nationality} talents, academies and recruitment opportunities on one platform.`,
    `Each profile includes position, level, location and contact options.`,
    `Join FootNation for free to connect with ${country.name} football stakeholders.`,
  ];
}
export function countryArticle(code: string) {
  return COUNTRIES.find((entry) => articleCodes[entry.slug] === code);
}
export function countryCodeForArticle(slug: string) {
  return Object.hasOwn(articleCodes, slug) ? articleCodes[slug] : undefined;
}
export function countryCities(code: string) {
  return GEO_CITIES.filter((entry) => entry.countryCode === code);
}
export function geographyContent(location: GeoLocation, locale: SeoLocale) {
  const translation = GEO_I18N[location.slug]?.[locale];
  return {
    name: translation?.name || location.name,
    intro: translation?.intro || location.intro,
    h1: translation?.h1,
    translated: locale === "fr" || !!translation,
  };
}
export function geographyLanguages(slug: string): SeoLocale[] {
  return SEO_LOCALES.filter(
    (locale) => locale === "fr" || !!GEO_I18N[slug]?.[locale],
  );
}
export function geographyPath(slug: string, locale: SeoLocale = "fr") {
  return `/geography/${encodeURIComponent(slug)}?lang=${locale}`;
}
export function geographyCountryPath(code: string) {
  return `/geography/country/${encodeURIComponent(code)}`;
}
/** Only exact site aliases resolve; unknown countries and translated lookalikes stay unavailable. */
export function resolveGeographyPath(
  path: string,
): { slug: string; locale: SeoLocale } | null {
  if (/[\\\u0000-\u0020\u007f?#]/.test(path) || path.includes("%")) return null;
  const canonical = path.match(/^\/football-([a-z0-9-]+)\/?$/);
  if (canonical && geographyLocation(canonical[1]))
    return { slug: canonical[1], locale: "fr" };
  const normalized = path.replace(/\/$/, "");
  for (const [slug, paths] of Object.entries(GEO_PATHS)) {
    for (const locale of SEO_LOCALES)
      if (paths[locale] === normalized && geographyLocation(slug))
        return { slug, locale };
  }
  return null;
}
export function geographyActions() {
  // These are general destinations: the available club database is French.
  return [
    { label: "Annuaire des clubs en France", path: "/clubs" },
    { label: "Toutes les opportunités", path: "/opportunities" },
    { label: "Découvrir le réseau", path: "/network" },
  ] as const;
}
export function filterGeography<T extends { name: string }>(
  items: readonly T[],
  term: string,
): T[] {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr-FR");
  const search = normalize(term.trim());
  return items.filter((entry) => normalize(entry.name).includes(search));
}
