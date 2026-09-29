/**
 * Slugifier for French city names.
 * - Unicode normalization (NFD) to strip accents
 * - Lowercase, spaces/quotes/apostrophes → "-"
 * - Collapses consecutive dashes
 *
 * Examples:
 *   "Saint-Étienne"     → "saint-etienne"
 *   "Les Sables-d'Olonne" → "les-sables-d-olonne"
 *   "L'Haÿ-les-Roses"    → "l-hay-les-roses"
 */
export function citySlug(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Builds /clubs-ville/:city-:dept route. */
export const cityUrl = (cityName: string, deptCode: string): string =>
  `/clubs-ville/${citySlug(cityName)}-${deptCode}`;

/**
 * Extracts the trailing dept code from a combined URL segment.
 * e.g. "paris-75" → { citySlug: "paris", deptCode: "75" }
 *      "la-reunion-974" → { citySlug: "la-reunion", deptCode: "974" }
 */
export function parseCityDeptUrl(
  combined: string,
): { citySlug: string; deptCode: string } | null {
  const match = combined.match(/^(.+)-(\d{2,3}|2[AB])$/i);
  if (!match) return null;
  return { citySlug: match[1], deptCode: match[2].toUpperCase() };
}
