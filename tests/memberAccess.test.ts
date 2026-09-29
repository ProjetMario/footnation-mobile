import { expect, it } from "vitest";
import {
  declaredAge,
  signupBirthdateError,
  parseMemberAccess,
  parentalConsentToken,
  memberAccessPublicPath,
  memberAccessRoutePath,
} from "../src/lib/memberAccess";
const day = (value: string) => new Date(value + "T12:00:00");
it("rejects signup until the thirteenth civil birthday", () => {
  expect(declaredAge("2013-09-12", new Date("2026-09-11T23:59:59Z"))).toBe(12);
  expect(declaredAge("2013-09-12", new Date("2026-09-12T00:00:00Z"))).toBe(13);
  expect(declaredAge("2013-09-12", day("2026-09-11"))).toBe(12);
  expect(signupBirthdateError("2013-09-12", day("2026-09-11"))).toContain(
    "13 ans",
  );
  expect(signupBirthdateError("2013-09-12", day("2026-09-12"))).toBeNull();
});
it("validates real dates and leap-day birthdays without dividing days by 365", () => {
  for (const value of [
    "",
    "1899-12-31",
    "2013-02-30",
    "2030-01-01",
    "2013-9-1",
  ])
    expect(signupBirthdateError(value, day("2026-09-12"))).not.toBeNull();
  expect(declaredAge("2012-02-29", day("2025-02-28"))).toBe(12);
  expect(declaredAge("2012-02-29", day("2025-03-01"))).toBe(13);
});
it("never grants access from an absent, unknown or contradictory server status", () => {
  for (const value of [
    null,
    {},
    { state: "unknown", allowed: true },
    { state: "parent_pending", allowed: true },
    { state: "eligible", allowed: true, onboarding_required: true },
    { state: "profile_required", allowed: true, onboarding_required: true },
  ])
    expect(() => parseMemberAccess(value)).toThrow();
  expect(
    parseMemberAccess({ state: "parent_pending", allowed: false }).allowed,
  ).toBe(false);
  expect(parseMemberAccess({ state: "eligible", allowed: true }).allowed).toBe(
    true,
  );
  expect(
    parseMemberAccess({
      state: "profile_required",
      allowed: false,
      onboarding_required: true,
    }).onboarding_required,
  ).toBe(true);
});
it("allows support and auth callbacks, never a prefix trick to a member screen", () => {
  expect(memberAccessPublicPath("/help")).toBe(true);
  expect(memberAccessPublicPath("/auth/callback")).toBe(true);
  expect(memberAccessPublicPath("/social-signup")).toBe(true);
  expect(memberAccessPublicPath("/login")).toBe(true);
  expect(memberAccessPublicPath("/signup")).toBe(true);
  expect(memberAccessPublicPath("/parental-consent")).toBe(true);
  for (const path of [
    "/help/profile",
    "/messages",
    "/club-dashboard",
    "/settings",
  ])
    expect(memberAccessPublicPath(path)).toBe(false);
});
it("takes parental secrets only from fragments, never query strings or malformed tokens", () => {
  const token = "a".repeat(64);
  expect(
    parentalConsentToken(
      "https://www.foot-nation.com/parental-consent#token=" + token,
    ),
  ).toBe(token);
  expect(
    parentalConsentToken(
      "https://www.foot-nation.com/parental-consent?token=" + token,
    ),
  ).toBeNull();
  expect(
    parentalConsentToken(
      "https://www.foot-nation.com/parental-consent#token=short",
    ),
  ).toBeNull();
});
it("checks the scene itself so help cannot exempt a background member route", () => {
  expect(memberAccessPublicPath(memberAccessRoutePath({ name: "help" }))).toBe(
    true,
  );
  expect(
    memberAccessPublicPath(memberAccessRoutePath({ name: "(tabs)" })),
  ).toBe(false);
  expect(
    memberAccessPublicPath(memberAccessRoutePath({ name: "messages" })),
  ).toBe(false);
  expect(
    memberAccessPublicPath(
      memberAccessRoutePath({
        name: "documents/[slug]",
        params: { slug: "privacy" },
      }),
    ),
  ).toBe(true);
  expect(
    memberAccessPublicPath(
      memberAccessRoutePath({
        name: "documents/[slug]",
        params: { slug: "../messages" },
      }),
    ),
  ).toBe(false);
});

it.each([
  "securite-des-mineurs",
  "mentions-legales",
  "politique-confidentialite",
  "conditions-generales",
  "conditions-generales-vente",
  "conditions-vente",
  "legal",
  "cgu",
])("keeps %s reachable for a restricted account", (name) => {
  expect(memberAccessPublicPath(memberAccessRoutePath({ name }))).toBe(true);
  expect(memberAccessPublicPath("/" + name + "/private")).toBe(false);
});

it.each([
  "mentions-legales",
  "conditions-generales-vente",
  "politique-confidentialite",
  "securite-des-mineurs",
])("preserves access after the legal alias redirects to %s", (slug) => {
  expect(
    memberAccessPublicPath(
      memberAccessRoutePath({ name: "documents/[slug]", params: { slug } }),
    ),
  ).toBe(true);
});
