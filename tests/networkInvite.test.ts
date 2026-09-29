import { describe, expect, it } from "vitest";
import {
  canPresentNetworkInvite,
  createNetworkInviteQueue,
  hasInviteReadyProfile,
  isInvitationAuthCallback,
} from "../src/lib/networkInvite";
import type { Profile } from "../src/lib/models";
import {
  createActivationPromptCoordinator,
  invitationPromptReady,
  invitationPromptCooldown,
} from "../src/lib/activationPrompts";

const login = (id = "a", last_sign_in_at = "2026-09-09T18:00:00Z") => ({
  user: { id, last_sign_in_at },
});
const profile = (extra: Partial<Profile> = {}): Profile => ({
  id: "a",
  username: "football",
  full_name: "Alex Martin",
  avatar_url: null,
  first_name: "Alex",
  last_name: "Martin",
  ...extra,
});
const presentation = (
  extra: Partial<Parameters<typeof canPresentNetworkInvite>[0]> = {},
) => ({
  request: { userId: "a", key: "login-1" },
  userId: "a",
  profile: profile(),
  profileStatus: "ready" as const,
  loading: false,
  error: null,
  pathname: "/",
  ...extra,
});

describe("post-authentication invitation", () => {
  it("requires an explicit successful login/signup callback and excludes recovery or email changes", () => {
    expect(isInvitationAuthCallback({ code: "exchanged", invite: "1" })).toBe(
      true,
    );
    expect(isInvitationAuthCallback({ invite: "1" })).toBe(false);
    expect(isInvitationAuthCallback({ code: "exchanged" })).toBe(false);
    expect(
      isInvitationAuthCallback({
        code: "exchanged",
        invite: "1",
        recovery: "1",
      }),
    ).toBe(false);
  });

  it("cancels a deferred invitation when password recovery begins without reviving a late callback", () => {
    const queue = createNetworkInviteQueue();
    queue.adoptAccount("a");
    queue.request(login());
    expect(queue.cancel()).toBeNull();
    expect(queue.adoptAccount("a")).toBeNull();
    expect(queue.request(login())).toBeNull();
  });

  it("does not invite on startup, session refresh or refocus alone", () => {
    const queue = createNetworkInviteQueue();
    expect(queue.adoptAccount(null)).toBeNull();
    expect(queue.adoptAccount("a")).toBeNull();
    expect(queue.adoptAccount("a")).toBeNull();
  });

  it("keeps an explicit successful login pending through profile loads and token updates", () => {
    const queue = createNetworkInviteQueue();
    queue.adoptAccount("a");
    const request = queue.request(login());
    expect(request?.userId).toBe("a");
    expect(queue.adoptAccount("a")).toEqual(request);
    expect(
      canPresentNetworkInvite(presentation({ request, loading: true })),
    ).toBe(false);
    expect(
      canPresentNetworkInvite(
        presentation({ request, profile: null, profileStatus: "missing" }),
      ),
    ).toBe(false);
    expect(canPresentNetworkInvite(presentation({ request }))).toBe(true);
  });

  it("deduplicates OAuth completion from browser and route, even after dismissal", () => {
    const queue = createNetworkInviteQueue();
    queue.adoptAccount("a");
    const request = queue.request(login())!;
    expect(queue.request(login())).toEqual(request);
    expect(queue.dismiss(request.key)).toBeNull();
    expect(queue.adoptAccount("a")).toBeNull();
    expect(queue.request(login())).toBeNull();
  });

  it("invites again on a later explicit login and ignores an old close callback", () => {
    const queue = createNetworkInviteQueue();
    queue.adoptAccount("a");
    const old = queue.request(login())!;
    queue.dismiss(old.key);
    const next = queue.request(login("a", "2026-09-10T18:00:00Z"))!;
    expect(next.key).not.toBe(old.key);
    expect(queue.dismiss(old.key)).toEqual(next);
  });

  it("clears account-specific invitations at logout or account switch and ignores stale accounts", () => {
    const queue = createNetworkInviteQueue();
    queue.adoptAccount("a");
    queue.request(login());
    expect(queue.adoptAccount(null)).toBeNull();
    expect(queue.request(login())).toBeNull();
    queue.adoptAccount("b");
    const request = queue.request(login("b"));
    expect(queue.request(login("a"))).toEqual(request);
    expect(queue.adoptAccount("a")).toBeNull();
  });

  it("deduplicates a session without last-sign-in metadata", () => {
    const queue = createNetworkInviteQueue();
    queue.adoptAccount("a");
    const session = { user: { id: "a" } };
    const request = queue.request(session)!;
    queue.dismiss(request.key);
    expect(queue.request(session)).toBeNull();
  });

  it.each([
    "/login",
    "/signup",
    "/settings",
    "/profile-setup",
    "/reset-password",
    "/account-settings",
    "/suppression-compte",
    "/invite",
    "/auth/callback",
    "/auth/apply-referral",
  ])("waits while %s is handling authentication or account setup", (pathname) =>
    expect(canPresentNetworkInvite(presentation({ pathname }))).toBe(false),
  );

  it("preserves a deep-link destination and waits until active calls finish", () => {
    const state = presentation({ pathname: "/talent/alex" });
    expect(canPresentNetworkInvite({ ...state, callBusy: true })).toBe(false);
    expect(canPresentNetworkInvite({ ...state, callBusy: false })).toBe(false);
    expect(
      canPresentNetworkInvite({ ...state, pathname: "/", callBusy: false }),
    ).toBe(true);
    expect(state.pathname).toBe("/talent/alex");
  });

  it.each([
    { request: null },
    { userId: undefined },
    { userId: "b" },
    { profile: profile({ id: "b" }) },
    { profile: null },
    { loading: true },
    { error: "offline verification failed" },
    { profileStatus: "unverified" as const },
    { profileStatus: "suspended" as const },
    { profileStatus: "missing" as const },
  ])("does not display for invalid or unverified account state %j", (extra) => {
    expect(canPresentNetworkInvite(presentation(extra))).toBe(false);
  });
});

describe("welcome and sharing prompts", () => {
  const memoryStorage = () => {
    const values = new Map<string, string>();
    return {
      getItem: async (key: string) => values.get(key) || null,
      setItem: async (key: string, value: string) => {
        values.set(key, value);
      },
    };
  };
  it("shows the welcome first and postpones the invitation for seven days", async () => {
    let now = 1000;
    const storage = memoryStorage();
    const coordinator = createActivationPromptCoordinator(storage, () => now);
    await coordinator.adoptAccount("a");
    expect(coordinator.snapshot().onboardingSeen).toBe(false);
    expect(invitationPromptReady(coordinator.snapshot(), "a", now)).toBe(false);
    coordinator.dismissOnboarding("a");
    expect(coordinator.dismissOnboarding("a")).toBe(false);
    expect(coordinator.snapshot().onboardingSeen).toBe(true);
    expect(invitationPromptReady(coordinator.snapshot(), "a", now)).toBe(false);
    now += invitationPromptCooldown;
    const restarted = createActivationPromptCoordinator(storage, () => now);
    await restarted.adoptAccount("a");
    expect(invitationPromptReady(restarted.snapshot(), "a", now)).toBe(true);
    restarted.dismissInvitation("a");
    expect(invitationPromptReady(restarted.snapshot(), "a", now)).toBe(false);
  });
  it("ignores stale reads and dismissals after account switching", async () => {
    const pending: Array<(value: string | null) => void> = [];
    const coordinator = createActivationPromptCoordinator({
      getItem: () => new Promise((resolve) => pending.push(resolve)),
      setItem: async () => {},
    });
    const first = coordinator.adoptAccount("a");
    const second = coordinator.adoptAccount("b");
    pending[0]("seen");
    pending[1]("0");
    await first;
    expect(coordinator.snapshot()).toMatchObject({ userId: "b", ready: false });
    pending[2](null);
    pending[3](null);
    await second;
    expect(coordinator.dismissOnboarding("a")).toBe(false);
    expect(coordinator.snapshot().onboardingSeen).toBe(false);
    expect(invitationPromptReady(coordinator.snapshot(), "a")).toBe(false);
  });
  it("storage failures leave the app usable without repeated interruptions", async () => {
    const coordinator = createActivationPromptCoordinator({
      getItem: async () => {
        throw new Error("unavailable");
      },
      setItem: async () => {},
    });
    await coordinator.adoptAccount("a");
    expect(coordinator.snapshot()).toMatchObject({
      ready: true,
      onboardingSeen: true,
    });
    expect(invitationPromptReady(coordinator.snapshot(), "a")).toBe(false);
  });
  it.each([
    "/member/invitations",
    "/member/convocations",
    "/club/id/member",
    "/referral",
    "/post/id",
    "/talent/alex",
  ])("does not cover a destination the user came for: %s", (pathname) => {
    expect(canPresentNetworkInvite(presentation({ pathname }))).toBe(false);
  });
});

describe("invitation after registration completion", () => {
  it("requires personal registration fields, accepting old full-name-only profiles", () => {
    expect(hasInviteReadyProfile(profile())).toBe(true);
    expect(
      hasInviteReadyProfile(
        profile({ first_name: undefined, last_name: undefined }),
      ),
    ).toBe(true);
    expect(
      hasInviteReadyProfile(profile({ first_name: "", last_name: "" })),
    ).toBe(false);
    expect(hasInviteReadyProfile(profile({ last_name: " " }))).toBe(false);
    expect(hasInviteReadyProfile(profile({ username: null }))).toBe(false);
    expect(hasInviteReadyProfile(null)).toBe(false);
  });

  it.each([
    [
      {
        account_type: "club",
        club_official_name: "FC Paris",
        bio: "Club local",
      },
      true,
    ],
    [{ account_type: "club", club_official_name: "FC Paris", bio: " " }, false],
    [{ account_type: "business", business_name: "Équipement Football" }, true],
    [{ account_type: "business", business_name: " " }, false],
    [{ account_type: "institution", institution_name: "Ligue" }, true],
    [{ account_type: "institution", institution_name: null }, false],
    [{ account_type: "unknown" }, false],
  ] as [Partial<Profile>, boolean][])(
    "checks the completion rules for %j",
    (extra, ready) => {
      expect(hasInviteReadyProfile(profile(extra))).toBe(ready);
    },
  );
});
