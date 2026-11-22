import { isCommunityLocale, localeDirection } from "../../shared/seo/community-copy.mjs";

/** Bounded BCP 47 language/script/region tags, also accepted by the forum RPC. */
export function discussionLanguage(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 35) return null;
  const input = value.trim();
  if (!/^[a-z]{2,3}(?:-[a-z]{4})?(?:-(?:[a-z]{2}|[0-9]{3}))?$/i.test(input)) return null;
  const [language, ...parts] = input.split("-");
  return [language.toLowerCase(), ...parts.map(part => part.length === 4 ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part.toUpperCase())].join("-");
}

export function communityReturnLocale(path: string, locale: unknown): string {
  const value = discussionLanguage(locale);
  return value ? `${path}?communityLocale=${value}` : path;
}
/** Use the most specific authored interface copy without changing the message language. */
export function communityInterfaceLocale(value: unknown): string {
  const normalized = discussionLanguage(value);
  if (!normalized) return "fr";
  const parts = normalized.split("-");
  // Do not present simplified Chinese as traditional Chinese.
  if (/^zh-(?:Hant(?:-|$)|TW$|HK$|MO$)/.test(normalized)) {
    return isCommunityLocale("zh-Hant") ? "zh-Hant" : "fr";
  }
  while (parts.length) {
    const candidate = parts.join("-");
    if (isCommunityLocale(candidate)) return candidate;
    parts.pop();
  }
  return "fr";
}

/** Direction is local to the community view; never change the device-wide setting. */
export function communityDirection(value: unknown): "ltr" | "rtl" {
  return localeDirection(communityInterfaceLocale(value)) as "ltr" | "rtl";
}
