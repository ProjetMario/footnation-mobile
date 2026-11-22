import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rpc: vi.fn(),
  header: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  markOnboardingComplete: vi.fn(),
}));
vi.mock("../src/lib/onboardingCompletion", () => ({
  markOnboardingComplete: mocks.markOnboardingComplete,
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));
import {
  completeSocialSignup,
  finishSocialAuth,
  getSocialSignupStatus,
  postSocialCallbackRoute,
  socialSignupError,
  socialSignupPath,
  type SocialSignupValues,
} from "../src/lib/socialOnboarding";
const session = {
  user: { id: "account-a", user_metadata: {} },
  access_token: "test-a",
} as Session;
const values: SocialSignupValues = {
  fullName: "Sam Test",
  username: "sam_test",
  birthdate: "2000-01-01",
  accountType: "personal",
  role: "Joueur amateur",
  acceptedTerms: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session }, error: null });
  mocks.rpc.mockImplementation(() => ({ setHeader: mocks.header }));
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ data: null, error: null });
  mocks.markOnboardingComplete.mockResolvedValue(undefined);
  mocks.header.mockResolvedValue({
    data: { required: true, full_name: "Sam Test" },
    error: null,
  });
});
describe("social admission", () => {
  it("returns to an admin detail without interrupting reauthentication with an invitation", async () => {
    mocks.header.mockResolvedValue({ data: { required: false, full_name: "Existing", username: "existing", birthdate: "2000-01-01" }, error: null });
    const next = "/admin/user/00000000-0000-4000-8000-000000000001?tab=admin";
    await expect(postSocialCallbackRoute(session, { next })).resolves.toEqual({
      route: next,
      inviteNetwork: false,
    });
  });
  it("preserves only safe destinations and normalized referral codes", () => {
    expect(socialSignupPath("https://evil.test", "bad input")).toBe(
      "/onboarding",
    );
    const path = socialSignupPath(
      "/member/invitations?teamInvite=ABCDEFGHJK",
      "abc123",
    );
    expect(new URL(path, "https://local.test").searchParams.get("next")).toBe(
      "/member/invitations?teamInvite=ABCDEFGHJK",
    );
    expect(new URL(path, "https://local.test").searchParams.get("ref")).toBe(
      "ABC123",
    );
  });
  it("routes new users to completion, established users to content", async () => {
    expect(
      await finishSocialAuth(session, { provider: "apple", next: "/clubs" }),
    ).toBe("/onboarding?next=%2Fclubs");
    mocks.header.mockResolvedValue({
      data: {
        required: false,
        full_name: "Existing",
        username: "existing",
        birthdate: "2000-01-01",
      },
      error: null,
    });
    expect(
      await finishSocialAuth(session, { provider: "google", next: "/clubs" }),
    ).toBe("/clubs");
  });
  it("routes generic Apple/Supabase callbacks for unfinished users into the completion tunnel", async () => {
    await expect(
      postSocialCallbackRoute(session, {
        next: "/my-profile",
        referral: "abc123",
      }),
    ).resolves.toEqual({
      route: "/onboarding?next=%2Fmy-profile&ref=ABC123",
      inviteNetwork: false,
    });
    mocks.header.mockResolvedValue({
      data: {
        required: false,
        full_name: "Existing",
        username: "existing",
        birthdate: "2000-01-01",
      },
      error: null,
    });
    await expect(
      postSocialCallbackRoute(session, {
        next: "/my-profile",
        referral: "abc123",
      }),
    ).resolves.toEqual({
      route: "/my-profile",
      inviteNetwork: true,
    });
  });

  it.each(["/compose", "/shorts/create", "/stories/create"])(
    "returns to the retained draft in %s after profile completion or social reauthentication",
    async (path) => {
      const next = `${path}?draft=10000000-0000-4000-8000-000000000001`;
      const onboarding = await finishSocialAuth(session, {
        provider: "apple",
        next,
        referral: "abc123",
      });
      expect(onboarding).toBe(
        `/onboarding?next=${encodeURIComponent(next)}&ref=ABC123`,
      );
      expect(await postSocialCallbackRoute(session, { next })).toEqual({
        route: `/onboarding?next=${encodeURIComponent(next)}`,
        inviteNetwork: false,
      });
      mocks.header.mockResolvedValue({
        data: {
          required: false,
          full_name: "Existing",
          username: "existing",
          birthdate: "2000-01-01",
        },
        error: null,
      });
      expect(
        await finishSocialAuth(session, { provider: "google", next }),
      ).toBe(next);
      expect(await postSocialCallbackRoute(session, { next })).toEqual({
        route: next,
        inviteNetwork: true,
      });
    },
  );

  it("uses the default content feed for absent or unsafe return routes", async () => {
    mocks.header.mockResolvedValue({
      data: {
        required: false,
        full_name: "Existing",
        username: "existing",
        birthdate: "2000-01-01",
      },
      error: null,
    });
    for (const next of [
      undefined,
      "https://evil.test",
      "/compose?draft=10000000-0000-4000-8000-000000000001&publish=1",
    ]) {
      expect(await finishSocialAuth(session, { provider: "apple", next })).toBe(
        "/shorts?mode=all",
      );
      expect(await postSocialCallbackRoute(session, { next })).toEqual({
        route: "/shorts?mode=all",
        inviteNetwork: true,
      });
    }
  });

  it("falls back to the legacy status RPC when the shared database still blocks the new one", async () => {
    mocks.header
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42501",
          message: "MEMBER_AGE_ACCESS_REQUIRED",
        },
      })
      .mockResolvedValueOnce({
        data: { required: true, full_name: "Sam Test" },
        error: null,
      });

    await expect(getSocialSignupStatus(session.user.id)).resolves.toMatchObject(
      {
        required: true,
        fullName: "Sam Test",
      },
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "get_signup_status");
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "get_social_signup_status");
  });

  it("falls back to the legacy completion RPC when the shared database still blocks the new one", async () => {
    mocks.header
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42501",
          message: "Forbidden",
        },
      })
      .mockResolvedValueOnce({
        data: { state: "eligible", allowed: true, onboarding_required: false },
        error: null,
      });

    await expect(
      completeSocialSignup(session.user.id, values, "abc123"),
    ).resolves.toMatchObject({ allowed: true });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "complete_signup", {
      p_full_name: "Sam Test",
      p_username: "sam_test",
      p_birthdate: "2000-01-01",
      p_account_type: "personal",
      p_primary_role: "Joueur amateur",
      p_terms_version: "1.0",
      p_referral: "ABC123",
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "complete_social_signup", {
      p_full_name: "Sam Test",
      p_username: "sam_test",
      p_birthdate: "2000-01-01",
      p_account_type: "personal",
      p_primary_role: "Joueur amateur",
      p_terms_version: "1.0",
      p_referral: "ABC123",
    });
  });

  it("does not report completion or mutate profiles when both signup RPCs fail", async () => {
    mocks.header
      .mockResolvedValueOnce({
        data: null,
        error: { code: "404", message: "Not Found" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "42501", message: "Forbidden" },
      });
    await expect(completeSocialSignup(session.user.id, values)).rejects.toThrow(
      "côté serveur",
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.markOnboardingComplete).not.toHaveBeenCalled();
  });

  it("does not force the completion tunnel for recovery or deletion callbacks", async () => {
    await expect(
      postSocialCallbackRoute(session, {
        next: "/my-profile",
        recovery: true,
      }),
    ).resolves.toEqual({
      route: "/reset-password?recovery=1&next=%2Fmy-profile",
      inviteNetwork: false,
    });
    await expect(
      postSocialCallbackRoute(session, { next: "/suppression-compte" }),
    ).resolves.toEqual({
      route: "/suppression-compte",
      inviteNetwork: false,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps account deletion accessible even for an unfinished signup", async () => {
    expect(
      await finishSocialAuth(session, {
        provider: "apple",
        next: "/suppression-compte",
      }),
    ).toBe("/suppression-compte");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("fails closed if the migration is absent or reply malformed", async () => {
    mocks.header.mockResolvedValue({ data: { required: false }, error: null });
    await expect(getSocialSignupStatus(session.user.id)).rejects.toThrow(
      "indisponible",
    );
  });
  it("pins RPC authorization and refuses late responses from another session", async () => {
    mocks.getSession
      .mockResolvedValueOnce({ data: { session }, error: null })
      .mockResolvedValueOnce({
        data: { session: { user: { id: "account-b" } } },
        error: null,
      });
    await expect(getSocialSignupStatus(session.user.id)).rejects.toThrow(
      "session a changé",
    );
    expect(mocks.header).toHaveBeenCalledWith("Authorization", "Bearer test-a");
  });
  it("sends only allowed self profile fields, server remains age authority", async () => {
    mocks.header.mockResolvedValue({
      data: {
        state: "parent_required",
        allowed: false,
        onboarding_required: false,
      },
      error: null,
    });
    const access = await completeSocialSignup(
      session.user.id,
      values,
      "abc123",
    );
    expect(access.allowed).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith("complete_signup", {
      p_full_name: "Sam Test",
      p_username: "sam_test",
      p_birthdate: "2000-01-01",
      p_account_type: "personal",
      p_primary_role: "Joueur amateur",
      p_terms_version: "1.0",
      p_referral: "ABC123",
    });
  });
  it("uses the first selected role as the primary role for multi-role signups", async () => {
    mocks.header.mockResolvedValue({
      data: { state: "eligible", allowed: true, onboarding_required: false },
      error: null,
    });

    await completeSocialSignup(session.user.id, {
      ...values,
      role: "Joueur amateur, Joueur pro, Passionné(e)",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("complete_signup", {
      p_full_name: "Sam Test",
      p_username: "sam_test",
      p_birthdate: "2000-01-01",
      p_account_type: "personal",
      p_primary_role: "Joueur amateur",
      p_terms_version: "1.0",
      p_referral: null,
    });
  });

  it("never submits missing consent or default/invalid age", async () => {
    expect(socialSignupError({ ...values, birthdate: "" })).toContain("date");
    await expect(
      completeSocialSignup(session.user.id, {
        ...values,
        acceptedTerms: false,
      }),
    ).rejects.toThrow("conditions");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not infer privileged roles or expose database messages", async () => {
    expect(socialSignupError({ ...values, role: "Admin" })).toContain("rôle");
    mocks.header.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "private details" },
    });
    await expect(completeSocialSignup(session.user.id, values)).rejects.toThrow(
      "pseudo est déjà utilisé",
    );
  });
});
