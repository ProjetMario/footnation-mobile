import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rpc: vi.fn(),
  header: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession }, rpc: mocks.rpc },
}));
import {
  completeSocialSignup,
  finishSocialAuth,
  getSocialSignupStatus,
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
  mocks.header.mockResolvedValue({
    data: { required: true, full_name: "Sam Test" },
    error: null,
  });
});
describe("social admission", () => {
  it("preserves only safe destinations and normalized referral codes", () => {
    expect(socialSignupPath("https://evil.test", "bad input")).toBe(
      "/social-signup",
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
    ).toBe("/social-signup?next=%2Fclubs");
    mocks.header.mockResolvedValue({
      data: { required: false, full_name: "Existing" },
      error: null,
    });
    expect(
      await finishSocialAuth(session, { provider: "google", next: "/clubs" }),
    ).toBe("/clubs");
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
    expect(mocks.rpc).toHaveBeenCalledWith("complete_social_signup", {
      p_full_name: "Sam Test",
      p_username: "sam_test",
      p_birthdate: "2000-01-01",
      p_account_type: "personal",
      p_primary_role: "Joueur amateur",
      p_terms_version: "1.0",
      p_referral: "ABC123",
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
