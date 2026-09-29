import { describe, expect, it } from "vitest";
import {
  createAccountSessionStorage,
  authStorageKey,
} from "../src/lib/accountSessionStorage";
import {
  enabledSocialProviders,
  isSocialAuthCancellation,
  missingAppleNameMetadata,
  socialAuthErrorMessage,
  socialCallbackParams,
  socialProvider,
} from "../src/lib/socialAuthPolicy";

describe("social sign-in policy", () => {
  it("requires explicit provider configuration and an available Apple equivalent on iOS", () => {
    expect(
      enabledSocialProviders({ platform: "ios", appleAvailable: true }),
    ).toEqual({ google: false, apple: false });
    expect(
      enabledSocialProviders({
        platform: "ios",
        appleAvailable: false,
        apple: "true",
        google: "true",
      }),
    ).toEqual({ google: false, apple: false });
    expect(
      enabledSocialProviders({
        platform: "ios",
        appleAvailable: true,
        google: "true",
      }),
    ).toEqual({ google: false, apple: false });
    expect(
      enabledSocialProviders({
        platform: "ios",
        appleAvailable: true,
        google: "true",
        apple: "true",
      }),
    ).toEqual({ google: true, apple: true });
    expect(
      enabledSocialProviders({
        platform: "android",
        appleAvailable: false,
        google: "true",
        apple: "true",
      }),
    ).toEqual({ google: true, apple: true });
  });
  it("sanitizes callbacks and preserves explicit deletion and team invitations", () => {
    expect(
      socialCallbackParams("apple", {
        next: "https://evil.example",
        referral: "invalid",
      }),
    ).toEqual({ social: "apple" });
    expect(
      socialCallbackParams("google", {
        next: "/suppression-compte",
        referral: "ABC123",
      }),
    ).toEqual({ social: "google", next: "/suppression-compte", ref: "ABC123" });
    expect(
      socialCallbackParams("apple", {
        next: "/my-invitations?teamInvite=ABCDEFGHJK",
      }),
    ).toEqual({
      social: "apple",
      next: "/member/invitations?teamInvite=ABCDEFGHJK",
    });
    expect(socialProvider("github")).toBeNull();
  });
  it("does not expose provider error payloads and treats cancellation separately", () => {
    expect(
      socialAuthErrorMessage(new Error("secret-token response body")),
    ).not.toContain("secret");
    expect(isSocialAuthCancellation({ code: "ERR_REQUEST_CANCELED" })).toBe(
      true,
    );
    expect(isSocialAuthCancellation({ code: "network_error" })).toBe(false);
  });
  it("preserves existing private-relay profiles and customized names", () => {
    expect(
      missingAppleNameMetadata(
        { first_name: "Choisi", last_name: "Public", full_name: "Pseudo" },
        { givenName: "Apple", familyName: "Identité" },
      ),
    ).toEqual({});
    expect(
      missingAppleNameMetadata(
        {},
        { givenName: "  Marie ", familyName: "Dupont" },
      ),
    ).toEqual({
      first_name: "Marie",
      last_name: "Dupont",
      full_name: "Marie Dupont",
    });
    expect(missingAppleNameMetadata({}, undefined)).toEqual({});
  });
  it("never stores provider credentials, retaining Supabase and PKCE credentials", async () => {
    const values = new Map<string, string>();
    const store = createAccountSessionStorage({
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        values.set(key, value);
      },
      removeItem: async (key) => {
        values.delete(key);
      },
    });
    const raw = JSON.stringify({
      user: { id: "user-a" },
      access_token: "supabase-access",
      refresh_token: "supabase-refresh",
      provider_token: "provider-access",
      provider_refresh_token: "provider-refresh",
    });
    await store.setItem(authStorageKey, raw);
    expect(JSON.parse(values.get(authStorageKey)!)).toEqual({
      user: { id: "user-a" },
      access_token: "supabase-access",
      refresh_token: "supabase-refresh",
    });
    await store.setItem(
      `${authStorageKey}-code-verifier`,
      "verifier/password_recovery",
    );
    expect(await store.getItem(`${authStorageKey}-code-verifier`)).toBe(
      "verifier/password_recovery",
    );
    values.set(authStorageKey, raw); // Clean up credentials written by an older app version as well.
    expect(await store.getItem(authStorageKey)).not.toContain("provider");
    expect(values.get(authStorageKey)).not.toContain("provider");
  });
});
