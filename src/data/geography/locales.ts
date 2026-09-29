// Content ported from the site's checked-in geography pages/data; no generated destinations.
/**
 * SEO-targeted locales. These are the languages we actively
 * translate content for and ship indexable URLs (`/en/...`, `/es/...`).
 *
 * The runtime translation context (`LanguageContext`) supports 29 languages
 * for UI purposes only; for SEO we focus on the 6 highest-value markets +
 * French (default).
 */
export const SEO_LOCALES = ["fr", "en", "es", "pt", "ar", "de", "it"] as const;
export type SeoLocale = (typeof SEO_LOCALES)[number];

export const DEFAULT_LOCALE: SeoLocale = "fr";

/** Locales that carry a URL prefix (everyone except French). */
export const PREFIXED_LOCALES: SeoLocale[] = [
  "en",
  "es",
  "pt",
  "ar",
  "de",
  "it",
];

/** Right-to-left locales (need `dir="rtl"` on `<html>`). */
export const RTL_LOCALES: SeoLocale[] = ["ar"];

/** Display label per locale (used in language switcher). */
export const LOCALE_LABELS: Record<
  SeoLocale,
  { name: string; nativeName: string; flag: string }
> = {
  fr: { name: "French", nativeName: "Français", flag: "🇫🇷" },
  en: { name: "English", nativeName: "English", flag: "🇬🇧" },
  es: { name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  pt: { name: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
  ar: { name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  de: { name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  it: { name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
};

/**
 * Maps the runtime `LanguageContext` 2-letter uppercase codes (e.g. "EN", "ES")
 * to our SEO locale codes. Returns "fr" if unsupported.
 */
export function uiLangToSeoLocale(code: string | null | undefined): SeoLocale {
  if (!code) return DEFAULT_LOCALE;
  const lc = code.toLowerCase();
  if ((SEO_LOCALES as readonly string[]).includes(lc)) return lc as SeoLocale;
  return DEFAULT_LOCALE;
}

/**
 * Extracts the locale from a URL pathname.
 * "/en/find-football-club" → "en"
 * "/trouver-un-club-de-football" → "fr"
 */
export function getLocaleFromPath(pathname: string): SeoLocale {
  const m = pathname.match(/^\/([a-z]{2})(?:\/|$)/);
  if (m) {
    const code = m[1] as SeoLocale;
    if ((PREFIXED_LOCALES as string[]).includes(code)) return code;
  }
  return DEFAULT_LOCALE;
}

/** Build a localized path. For "fr" returns the FR path as-is. */
export function withLocalePrefix(path: string, locale: SeoLocale): string {
  if (locale === "fr") return path;
  // Strip a possible existing locale prefix
  const stripped = path.replace(/^\/(en|es|pt|ar|de|it)(?=\/|$)/, "");
  return `/${locale}${stripped || "/"}`;
}
