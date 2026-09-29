import { validCalendarDate } from "./calendarDate";

export type MemberAccessState =
  | "eligible"
  | "birthdate_required"
  | "profile_required"
  | "underage"
  | "parent_required"
  | "parent_pending"
  | "parent_refused";
export type MemberAccess = {
  state: MemberAccessState;
  allowed: boolean;
  resend_available_at: string | null;
  onboarding_required?: boolean;
};
const states: MemberAccessState[] = [
  "eligible",
  "birthdate_required",
  "profile_required",
  "underage",
  "parent_required",
  "parent_pending",
  "parent_refused",
];
export function parseMemberAccess(value: unknown): MemberAccess {
  if (!value || typeof value !== "object")
    throw new Error("La vérification du compte est indisponible.");
  const row = value as Record<string, unknown>;
  if (
    !states.includes(row.state as MemberAccessState) ||
    typeof row.allowed !== "boolean" ||
    row.allowed !== (row.state === "eligible") ||
    (row.onboarding_required !== undefined &&
      typeof row.onboarding_required !== "boolean") ||
    (row.onboarding_required === true && row.allowed)
  )
    throw new Error("La vérification du compte est indisponible.");
  return {
    state: row.state as MemberAccessState,
    allowed: row.allowed,
    ...(typeof row.onboarding_required === "boolean"
      ? { onboarding_required: row.onboarding_required }
      : {}),
    resend_available_at:
      typeof row.resend_available_at === "string" &&
      Number.isFinite(Date.parse(row.resend_available_at))
        ? row.resend_available_at
        : null,
  };
}
export function declaredAge(value: string, today = new Date()): number | null {
  if (
    !validCalendarDate(value) ||
    Number(value.slice(0, 4)) < 1900 ||
    !Number.isFinite(today.getTime())
  )
    return null;
  // Match the web client and Auth server's UTC civil date at the birthday boundary.
  const current = today.toISOString().slice(0, 10);
  if (value > current) return null;
  return (
    Number(current.slice(0, 4)) -
    Number(value.slice(0, 4)) -
    (current.slice(5) < value.slice(5) ? 1 : 0)
  );
}
export function signupBirthdateError(
  value: string,
  today = new Date(),
): string | null {
  const age = declaredAge(value, today);
  if (age === null) return "Indique une date de naissance valide.";
  if (age < 13)
    return "Tu dois avoir au moins 13 ans pour créer un compte FootNation.";
  return null;
}
export function memberAccessPublicPath(path: string): boolean {
  return [
    "/help",
    "/contact",
    "/auth/callback",
    "/social-signup",
    "/login",
    "/signup",
    "/reset-password",
    "/forgot-password",
    "/parental-consent",
    "/suppression-compte",
    "/documents/legal",
    "/documents/privacy",
    "/documents/safety",
    "/documents/mentions-legales",
    "/documents/conditions-generales-vente",
    "/documents/politique-confidentialite",
    "/documents/securite-des-mineurs",
    "/securite-mineurs",
    "/securite-des-mineurs",
    "/mentions-legales",
    "/legal",
    "/politique-confidentialite",
    "/conditions-generales",
    "/conditions-generales-vente",
    "/conditions-vente",
    "/cgu",
  ].includes(path);
}
export function memberAccessRoutePath(route: {
  name: string;
  params?: Readonly<object>;
}): string {
  // Use each scene's route. Opening Help must not exempt a background scene.
  if (route.name === "documents/[slug]") {
    const slug = (route.params as { slug?: unknown } | undefined)?.slug;
    return typeof slug === "string" ? `/documents/${slug}` : "/documents";
  }
  return `/${route.name}`;
}
export function parentalConsentToken(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const token = new URLSearchParams(parsed.hash.slice(1)).get("token");
    return token && /^[A-Za-z0-9_-]{32,256}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}
