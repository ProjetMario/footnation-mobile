import { expect, it } from "vitest";
import { memberAccessRoutePath } from "../src/lib/memberAccess";
import {
  authReturnPath,
  authCallbackPath,
  authEntryPath,
  authGateReturnPath,
  normalizeTeamInvite,
} from "../src/lib/authReturn";

it("returns to only the admin user detail after reauthentication, without an action", () => {
  const path = "/admin/user/5b65328a-ca63-4fff-9b28-b4e19041feaf?tab=admin";
  expect(authReturnPath(path)).toBe(path);
  expect(authEntryPath({ next: `/app${path}` })).toBe(path);
  expect(authReturnPath(`${path}&delete=1`)).toBeNull();
  expect(authReturnPath(path.replace("?tab=admin", "?tab=admin#delete"))).toBeNull();
  expect(authReturnPath("/admin/user/not-a-uuid?tab=admin")).toBeNull();
});
const draftId = "10000000-0000-4000-8000-000000000001";

it("returns to approved club-admin navigation after login without replaying actions", () => {
  const clubId = "20000000-0000-4000-8000-000000000001";
  const sections = ["coach-kit", "team-players", "sessions", "attendance", "organigramme", "matches", "convocations", "members", "settings"];
  const base = `/club-admin/${clubId}`;
  for (const path of [base, ...sections.map((section) => `${base}/${section}`), `${base}/convocation/${draftId}`, `${base}/match/${draftId}`, `/club/${clubId}/admin`]) {
    expect(authReturnPath(path)).toBe(path);
    expect(authReturnPath(`/app${path}`)).toBe(path);
    expect(authEntryPath({ next: path })).toBe(path);
    expect(authCallbackPath(false, false, path)).toBe(path);
    expect(authGateReturnPath(path, { delete: "1", send: "1" })).toBe(path);
    expect(authReturnPath(`${path}?delete=1`)).toBeNull();
  }
  const convocation = `${base}/convocation/${draftId}`;
  expect(authGateReturnPath(convocation, { attendance: "1", delete: "1" })).toBe(`${convocation}?attendance=1`);
  expect(authCallbackPath(false, false, `${convocation}?attendance=1`)).toBe(`${convocation}?attendance=1`);
  expect(authReturnPath(`${convocation}?attendance=1&delete=1`)).toBeNull();
  expect(authGateReturnPath(convocation, { attendance: ["1"] })).toBeNull();
  expect(authGateReturnPath(`${base}/attendance`, { sessionId: draftId })).toBe(`${base}/attendance?sessionId=${draftId}`);
  expect(authGateReturnPath(`${base}/attendance`, { sessionId: "../private" })).toBeNull();
  expect(authGateReturnPath(`${base}/members`, { invitation: "team-link" })).toBe(`${base}/members?invitation=team-link`);
  for (const invalid of [
    "/club-admin/not-a-uuid", `${base}/unknown`, `${base}/matches/extra`,
    `${base}/convocation/../matches`, `${base}/convocation/${draftId}?attendance=1#x`,
    `${base}/convocation/${draftId}?attendance=1&send=1`, `${base}/match/${draftId}?attendance=1`,
    `${base}/members?invitation=https://evil.test`, `${base}/attendance?sessionId=../admin`,
    `//evil.test${base}`, `/club/${clubId}/admin?delete=1`,
  ]) expect(authReturnPath(invalid)).toBeNull();
});

it("preserves validated club routes through member onboarding", () => {
  const id = "20000000-0000-4000-8000-000000000001";
  const routes = [
    { name: "club-admin/[id]/index", params: { id }, path: `/club-admin/${id}` },
    { name: "club-admin/[id]/[section]", params: { id, section: "sessions" }, path: `/club-admin/${id}/sessions` },
    { name: "club-admin/[id]/convocation/[convocation]", params: { id, convocation: draftId }, path: `/club-admin/${id}/convocation/${draftId}` },
    { name: "club-admin/[id]/match/[matchId]", params: { id, matchId: draftId }, path: `/club-admin/${id}/match/${draftId}` },
    { name: "club/[id]/admin", params: { id }, path: `/club/${id}/admin` },
  ];
  for (const { name, params, path } of routes) {
    expect(memberAccessRoutePath({ name, params })).toBe(path);
    expect(authGateReturnPath(path, params)).toBe(path);
  }
  expect(memberAccessRoutePath({ name: "club-admin/[id]/[section]", params: { id, section: "../../unsafe" } })).toBe("/club-dashboard");
  expect(memberAccessRoutePath({ name: "club-admin/[id]/index", params: { id: "../unsafe" } })).toBe("/club-dashboard");
});

it("preserves safe club view parameters across member onboarding without duplicating or replaying actions", () => {
  const id = "20000000-0000-4000-8000-000000000001";
  const routes = [
    { name: "club-admin/[id]/convocation/[convocation]", params: { id, convocation: draftId, attendance: "1", send: "1" }, expected: `/club-admin/${id}/convocation/${draftId}?attendance=1` },
    { name: "club-admin/[id]/[section]", params: { id, section: "attendance", sessionId: draftId, delete: "1" }, expected: `/club-admin/${id}/attendance?sessionId=${draftId}` },
    { name: "club-admin/[id]/[section]", params: { id, section: "members", invitation: "team-link", confirm: "1" }, expected: `/club-admin/${id}/members?invitation=team-link` },
  ];
  for (const { name, params, expected } of routes) {
    const path = memberAccessRoutePath({ name, params });
    expect(path).toBe(expected);
    expect(authGateReturnPath(path, params)).toBe(expected);
    expect(authCallbackPath(false, false, path)).toBe(expected);
  }
  expect(memberAccessRoutePath({ name: "club-admin/[id]/convocation/[convocation]", params: { id, convocation: draftId, attendance: ["1"] } })).toBe("/club-dashboard");
  expect(memberAccessRoutePath({ name: "club-admin/[id]/[section]", params: { id, section: "attendance", sessionId: "../unsafe" } })).toBe("/club-dashboard");
  expect(memberAccessRoutePath({ name: "club-admin/[id]/[section]", params: { id, section: "members", invitation: "https://evil.test" } })).toBe("/club-dashboard");
  expect(authGateReturnPath(`/club-admin/${id}/convocation/${draftId}?attendance=1`, { attendance: "0" })).toBeNull();
  expect(authGateReturnPath(`/club-admin/${id}/attendance?sessionId=${draftId}`, { sessionId: "30000000-0000-4000-8000-000000000001" })).toBeNull();
});

it("preserves the community language across login without carrying mutation or external redirect parameters", () => {
  const base = "/club/paris-saint-germain/discussions/new";
  for (const locale of ["ar", "sr-Latn", "tpi"]) {
    const path = `${base}?communityLocale=${locale}`;
    expect(authReturnPath(`/app${path}`)).toBe(path);
    expect(authGateReturnPath(base, { communityLocale: locale, publish: "1" })).toBe(path);
    expect(authCallbackPath(false, false, path)).toBe(path);
    expect(authReturnPath(`${path}&publish=1`)).toBeNull();
  }
  expect(authReturnPath(`${base}?communityLocale=https://evil.test`)).toBeNull();
});

it("preserves discussion reading and compose routes through sign-in without publishing", () => {
  for (const path of ["/discussions", "/club/paris-saint-germain/discussions", "/club/paris-saint-germain/discussions/new", `/club/paris-saint-germain/discussions/${draftId}`]) {
    expect(authReturnPath(`/app${path}`)).toBe(path);
    expect(authCallbackPath(false, false, path)).toBe(path);
    expect(authGateReturnPath(path, { publish: "1" })).toBe(path);
    expect(authReturnPath(`${path}?publish=1`)).toBeNull();
  }
  expect(authReturnPath(`/club/%2fadmin/discussions/${draftId}`)).toBeNull();
  expect(authReturnPath("/club/example/discussions/not-a-uuid")).toBeNull();
});

it("preserves supporter invitations and the creation form through login without joining automatically", () => {
  for (const path of [
    "/supporters",
    "/supporters/new",
    `/supporters/${draftId}`,
  ]) {
    expect(authReturnPath(path)).toBe(path);
    expect(authReturnPath(`/app${path}`)).toBe(path);
    expect(authEntryPath({ next: path })).toBe(path);
    expect(authCallbackPath(false, false, path)).toBe(path);
    expect(authGateReturnPath(path, { join: "1", attending: "1" })).toBe(path);
    expect(authReturnPath(`${path}?join=1`)).toBeNull();
    expect(authReturnPath(`${path}?attending=1`)).toBeNull();
  }
  expect(
    memberAccessRoutePath({ name: "supporters/[id]", params: { id: draftId } }),
  ).toBe(`/supporters/${draftId}`);
  expect(
    memberAccessRoutePath({
      name: "supporters/[id]",
      params: { id: "../admin" },
    }),
  ).toBe("/supporters");
  for (const path of [
    "/supporters/not-a-uuid",
    "/supporters/%2fadmin",
    "/supporters/..",
    `/supporters/${draftId}#join`,
    "/supporters/new?publish=1",
  ])
    expect(authReturnPath(path)).toBeNull();
});

it.each(["/compose", "/shorts/create", "/stories/create"])(
  "retrouve le brouillon %s après inscription sans transmettre d’action de publication",
  (path) => {
    const next = `${path}?draft=${draftId}`;
    expect(authReturnPath(next)).toBe(next);
    expect(authGateReturnPath(path, { draft: draftId })).toBe(next);
    expect(
      authGateReturnPath(path, {
        draft: draftId,
        publish: "1",
        send: "1",
        next: "https://evil.test",
      }),
    ).toBe(next);
    expect(authEntryPath({ next })).toBe(next);
    expect(authCallbackPath(false, false, next)).toBe(next);
    expect(authGateReturnPath(path, { draft: [draftId] })).toBeNull();
    expect(authGateReturnPath(path, { draft: "../private" })).toBeNull();
    expect(authGateReturnPath(path, {})).toBeNull();
  },
);

it("refuse les paramètres supplémentaires et les références de brouillon ambiguës", () => {
  for (const path of ["/compose", "/shorts/create", "/stories/create"]) {
    for (const next of [
      path,
      `${path}?draft=`,
      `${path}?draft=not-a-uuid`,
      `${path}?draft=../private`,
      `${path}?draft=https://evil.test`,
      `${path}?draft=${draftId}&publish=1`,
      `${path}?draft=${draftId}&send=1`,
      `${path}?draft=${draftId}&next=/admin`,
      `${path}?draft=${draftId}&draft=${draftId}`,
      `${path}?draft=${draftId}#publish`,
      `${path}?draft=${draftId}%26publish%3D1`,
      `https://evil.test${path}?draft=${draftId}`,
      `//evil.test${path}?draft=${draftId}`,
    ])
      expect(authReturnPath(next)).toBeNull();
  }
  expect(authReturnPath(`/posts/create?draft=${draftId}`)).toBeNull();
  expect(authReturnPath(`/compose/legacy?draft=${draftId}`)).toBeNull();
});

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

it("keeps inherited website return links inside the application mount", () => {
  expect(authEntryPath({ redirect: "/messages" })).toBe("/messages");
  expect(authEntryPath({ returnTo: "/app/home" })).toBe("/home");
  expect(
    authEntryPath({ next: "/app/my-profile", redirect: "/messages" }),
  ).toBe("/my-profile");
  expect(authReturnPath("/app//evil.example")).toBeNull();
  expect(authReturnPath("//evil.example/app/home")).toBeNull();
  expect(authEntryPath({ redirect: "https://evil.example" })).toBeNull();
});

it("preserves live compatibility and club preparation through login without starting capture", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const stream = "00000000-0000-4000-8000-000000000002";
  for (const type of ["watch", "legacy", "replay", "broadcast"])
    expect(authReturnPath(`/live/${type}/${id}`)).toBe(`/live/${type}/${id}`);
  expect(
    authGateReturnPath("/live/create", {
      mode: "match",
      clubId: id,
      start: "1",
    }),
  ).toBe(`/live/create?mode=match&clubId=${id}`);
  expect(authGateReturnPath(`/live/legacy/${id}`, { stream })).toBe(
    `/live/legacy/${id}?stream=${stream}`,
  );
  expect(authReturnPath(`/app/live/watch/${id}?stream=${stream}`)).toBe(
    `/live/watch/${id}?stream=${stream}`,
  );
  for (const value of [
    `/live/create?mode=match&clubId=${id}&start=1`,
    `/live/create?mode=match&clubId=../${id}`,
    `/live/legacy/${id}?stream=${stream}&autoplay=1`,
    `/live/watch/${id}?stream=${stream}&stream=${id}`,
    `/live/broadcast/${id}?capture=1`,
  ])
    expect(authReturnPath(value)).toBeNull();
});
