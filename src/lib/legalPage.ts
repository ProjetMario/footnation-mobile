import content from "../content/legal.json";
/** Resolve only owned document keys; unknown URLs must not show an unrelated legal text. */
export function legalPage(slug: unknown) {
  if (typeof slug !== "string") return null;
  const key =
    slug === "privacy"
      ? "politique-confidentialite"
      : slug === "safety"
        ? "securite-des-mineurs"
        : slug;
  return Object.hasOwn(content, key)
    ? content[key as keyof typeof content]
    : null;
}
