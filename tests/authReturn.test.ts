import { expect, it } from "vitest";
import {
  authReturnPath,
  authCallbackPath,
  authEntryPath,
  authGateReturnPath,
  normalizeTeamInvite,
} from "../src/lib/authReturn";
it("reprend uniquement une fiche publique et normalise son slug", () => {
  expect(authReturnPath("/talent/joueur")).toBe("/talent/joueur");
  expect(authReturnPath("/talent/équipe%20A")).toBe("/talent/%C3%A9quipe%20A");
});

it("conserve l’invitation du coach depuis le lien historique et après la création du profil", () => {
  const next = "/member/invitations?teamInvite=ABCDEFGHJK";
  expect(authEntryPath({ teamInvite: "abcdefghjk" })).toBe(next);
  expect(authReturnPath(next)).toBe(next);
  expect(
    authGateReturnPath("/member/invitations", {
      teamInvite: "ABCDEFGHJK",
      next: "//evil.test",
    }),
  ).toBe(next);
  expect(authCallbackPath(false, false, next)).toBe(next);
  const referral = authCallbackPath(false, true, next);
  expect(authReturnPath(referral)).toBe(referral);
  expect(authGateReturnPath("/referral", { apply: "1", next })).toBe(referral);
  expect(authCallbackPath(true, true, next)).toBe(
    `/reset-password?recovery=1&next=${encodeURIComponent(next)}`,
  );
});

it.each([
  "/club/club-id",
  "/club/club-id/member",
  "/posts/publication-id",
  "/profile/joueur",
  "/opportunity/essai-id",
  "/member/convocations",
  "/feedback",
  "/admin/growth",
  "/admin/feedback",
  "/followers",
  "/profile-views",
  "/profile-qr",
  "/cv-football",
  "/career-preferences",
  "/experience",
  "/education",
  "/predictions",
  "/my-followed-clubs",
  "/club-claims",
  "/my-club-reports",
  "/club-dashboard",
  "/club-chat",
  "/pro-pages",
  "/organizations",
  "/groups",
  "/stories",
  "/live",
  "/events-dashboard",
  "/events/dashboard",
  "/account-activity",
  "/account-settings",
  "/settings",
  "/message-outbox",
  "/invite",
  "/referral",
  "/verification",
])("retrouve %s après connexion", (path) => {
  expect(authReturnPath(path)).toBe(path);
  expect(
    authGateReturnPath(path, { autoAccept: "1", next: "https://evil.test" }),
  ).toBe(path);
  expect(authCallbackPath(false, false, path)).toBe(path);
});

it("refuse les codes forgés et les retours qui déclenchent une action", () => {
  for (const code of [
    "",
    "ABC",
    "ABCDEFGHIJ",
    "ABCDEFGHJK&accept=1",
    ["ABCDEFGHJK"],
  ])
    expect(normalizeTeamInvite(code)).toBeNull();
  for (const path of [
    "/club/id/member?accept=1",
    "/member/invitations?teamInvite=ABCDEFGHJK&accept=1",
    "/member/invitations?teamInvite=ABC",
    "/posts/create",
    "/post/id",
    "/post/id/edit",
    "/club/%2fadmin",
    "/referral?apply=1&next=%2Freferral%3Fapply%3D1",
    "/admin",
  ])
    expect(authReturnPath(path)).toBeNull();
  expect(
    authEntryPath({ teamInvite: "ABCDEFGHJK", next: "/suppression-compte" }),
  ).toBe("/suppression-compte");
});
it("autorise le retour exact à la confirmation de suppression, sans action automatique ni redirection libre", () => {
  expect(authReturnPath("/suppression-compte")).toBe("/suppression-compte");
  expect(authReturnPath("/suppression-compte?deleted=1")).toBeNull();
  expect(authReturnPath("/suppression-compte#confirmer")).toBeNull();
  expect(authReturnPath("/suppression-compte/../admin")).toBeNull();
  expect(authCallbackPath(false, true, "/suppression-compte")).toBe(
    "/suppression-compte",
  );
  expect(authCallbackPath(true, false, "/suppression-compte")).toBe(
    "/reset-password?recovery=1&next=%2Fsuppression-compte",
  );
});
it("refuse les redirections externes, routes à effets et chemins ambigus", () => {
  for (const value of [
    undefined,
    ["/talent/x"],
    "https://evil.test",
    "//evil.test",
    "/conversation/id",
    "/auth/callback",
    "/talent/x?next=/admin",
    "/talent/x#hash",
    "/talent/..",
    "/talent/%2e%2e",
    "/talent/%2Fadmin",
    "/talent/%5cadmin",
    "/talent/%00",
    "/talent/%",
    "/talent/ ",
    "/talent/",
  ])
    expect(authReturnPath(value)).toBeNull();
});

it("priorise la récupération tout en conservant un retour public valide", () => {
  expect(authCallbackPath(true, true, "/talent/joueur")).toBe(
    "/reset-password?recovery=1&next=%2Ftalent%2Fjoueur",
  );
  expect(authCallbackPath(true, false, "https://evil.test")).toBe(
    "/reset-password?recovery=1",
  );
  expect(authCallbackPath(false, true, "/talent/joueur")).toBe(
    "/referral?apply=1&next=%2Ftalent%2Fjoueur",
  );
  expect(authCallbackPath(false, false, "/talent/joueur")).toBe(
    "/talent/joueur",
  );
  expect(authCallbackPath(false, false, undefined)).toBe("/");
});

it("préserve le retour après parrainage sans accepter de destination arbitraire", () => {
  const route = authCallbackPath(false, true, "/talent/équipe%20A");
  const next = new URL(route, "https://www.foot-nation.com").searchParams.get(
    "next",
  );
  expect(authReturnPath(next)).toBe("/talent/%C3%A9quipe%20A");
  expect(authCallbackPath(false, true, "//evil.test")).toBe(
    "/referral?apply=1",
  );
});

it("preserves a notification's conversation through login without allowing send parameters", () => {
  const path = "/conversation/00000000-0000-4000-8000-000000000002";
  const next = authGateReturnPath(path, {});
  expect(authEntryPath({ next })).toBe(path);
  expect(authCallbackPath(false, false, next)).toBe(path);
  expect(authReturnPath(path + "?send=hello")).toBeNull();
});

it("keeps a match day and requested short comments through login without accepting mutation parameters", () => {
  for (const [path, params, expected] of [
    [
      "/match/espn%3Afra.1%3A123",
      { date: "2026-09-20" },
      "/match/espn%3Afra.1%3A123?date=2026-09-20",
    ],
    ["/shorts/example", { comments: "1" }, "/shorts/example?comments=1"],
    ["/posts/example", { comments: "1" }, "/posts/example?comments=1"],
  ] as const) {
    const next = authGateReturnPath(path, params);
    expect(next).toBe(expected);
    expect(authCallbackPath(false, false, next)).toBe(expected);
  }
  for (const path of [
    "/match/123?date=2026-02-30",
    "/match/123?date=2026-09-20&vote=home",
    "/shorts/example?comments=1&send=hello",
    "/posts/example?comments=1&send=hello",
  ])
    expect(authReturnPath(path)).toBeNull();
});

it("preserves only a content reference through sign-in before an explicit report", () => {
  const path = "/report/10000000-0000-4000-8000-000000000001";
  const contentId = "20000000-0000-4000-8000-000000000002";
  expect(authReturnPath(path)).toBe(path);
  for (const kind of ["post", "short", "story"]) {
    const next = authGateReturnPath(path, { kind, contentId, send: "1" });
    expect(next).toBe(`${path}?kind=${kind}&contentId=${contentId}`);
    expect(authEntryPath({ next })).toBe(next);
    expect(authCallbackPath(false, false, next)).toBe(next);
  }
  for (const value of [
    "/report/not-an-id",
    `${path}?kind=profiles&contentId=${contentId}`,
    `${path}?kind=post&contentId=../private`,
    `${path}?kind=post&contentId=${contentId}&send=1`,
    `${path}?kind=post&contentId=${contentId}#x`,
    `${path}?kind=post&contentId=${contentId}&contentId=${contentId}`,
    `${path}?reason=spam`,
  ])
    expect(authReturnPath(value)).toBeNull();
  expect(authGateReturnPath(path, { kind: ["post"], contentId })).toBeNull();
  expect(authGateReturnPath(path, { kind: "post" })).toBeNull();
});
