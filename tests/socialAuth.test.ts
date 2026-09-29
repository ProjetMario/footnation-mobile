import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  platform: { OS: "ios" },
  getSession: vi.fn(),
  signOut: vi.fn(),
  invoke: vi.fn(),
  native: vi.fn(),
  token: vi.fn(),
  oauth: vi.fn(),
  exchange: vi.fn(),
  getUser: vi.fn(),
  fetch: vi.fn(),
  finish: vi.fn(),
  browser: vi.fn(),
  beginAttempt: vi.fn(),
  checkAttempt: vi.fn(),
  clearAttempt: vi.fn(),
  checkLegacy: vi.fn(),
  current: null as any,
}));
vi.mock("react-native", () => ({ Platform: mock.platform }));
vi.mock("expo-auth-session", () => ({
  makeRedirectUri: ({ queryParams }: any) =>
    `com.footnation.app://auth/callback?${new URLSearchParams(queryParams)}`,
}));
vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: mock.browser,
}));
vi.mock("expo-apple-authentication", () => ({
  signInAsync: mock.native,
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
vi.mock("expo-crypto", async () => {
  const crypto = await import("node:crypto");
  return {
    getRandomBytesAsync: async (count: number) => crypto.randomBytes(count),
    randomUUID: () => "request-state",
    CryptoDigestAlgorithm: { SHA256: "SHA256" },
    digestStringAsync: async (_algorithm: string, text: string) =>
      crypto.createHash("sha256").update(text).digest("hex"),
  };
});
vi.mock("../src/lib/supabase", () => ({
  requireBackend: vi.fn(),
  supabase: {
    auth: {
      getSession: mock.getSession,
      signOut: mock.signOut,
      signInWithIdToken: mock.token,
      signInWithOAuth: mock.oauth,
      exchangeCodeForSession: mock.exchange,
      getUser: mock.getUser,
    },
    functions: { invoke: mock.invoke },
  },
}));
vi.mock("../src/lib/socialOnboarding", () => ({
  finishSocialAuth: mock.finish,
}));
vi.mock("../src/lib/socialAuthAttempt", () => ({
  socialAuthAttempts: {
    begin: mock.beginAttempt,
    check: mock.checkAttempt,
    clear: mock.clearAttempt,
    checkLegacy: mock.checkLegacy,
  },
}));
import { signInSocial, finishSocialCallback } from "../src/lib/socialAuth";
import { exchangeAuthCode } from "../src/lib/exchangeAuthCode";
import {
  registerAppleCredentials,
  saveMissingAppleName,
} from "../src/lib/appleCredentialRegistration";

function session(userId = "user-a") {
  return {
    user: { id: userId, user_metadata: {} },
    access_token: `access-${userId}`,
    refresh_token: `refresh-${userId}`,
  } as any;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.platform.OS = "ios";
  mock.current = null;
  mock.getSession.mockImplementation(async () => ({
    data: { session: mock.current },
    error: null,
  }));
  mock.native.mockResolvedValue({
    state: "request-state",
    identityToken: "apple-id-token",
    authorizationCode: "one-use-code",
    fullName: { givenName: "Camille", familyName: "Martin" },
  });
  mock.token.mockImplementation(async () => {
    mock.current = session();
    return { data: { session: mock.current }, error: null };
  });
  mock.oauth.mockResolvedValue({
    data: { url: "https://provider.example/authorize" },
    error: null,
  });
  mock.exchange.mockImplementation(async () => {
    mock.current = session();
    return { data: { session: mock.current }, error: null };
  });
  mock.invoke.mockResolvedValue({ data: { stored: true }, error: null });
  mock.getUser.mockImplementation(async () => ({
    data: { user: mock.current?.user },
    error: null,
  }));
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://backend.example");
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "public-key");
  vi.stubGlobal("fetch", mock.fetch);
  mock.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ id: "user-a" }),
  });
  mock.finish.mockResolvedValue("/social-signup?next=%2Fclubs");
  mock.beginAttempt.mockResolvedValue({ id: "oauth-attempt" });
  mock.checkAttempt.mockResolvedValue(undefined);
  mock.clearAttempt.mockResolvedValue(undefined);
  mock.checkLegacy.mockResolvedValue(undefined);
  mock.signOut.mockImplementation(async () => {
    mock.current = null;
    return { error: null };
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("native Apple authentication", () => {
  it("binds hashed nonce, returned state, server capture and onboarding to the authenticated user", async () => {
    const result = await signInSocial("apple", {
      next: "/clubs",
      referral: "ABC123",
    });
    const nonce = mock.token.mock.calls[0][0].nonce;
    expect(nonce).toMatch(/^[a-f0-9]{64}$/);
    const { createHash } = await import("node:crypto");
    expect(mock.native.mock.calls[0][0].nonce).toBe(
      createHash("sha256").update(nonce).digest("hex"),
    );
    expect(mock.invoke).toHaveBeenCalledWith("apple-auth-credentials", {
      body: { authorizationCode: "one-use-code", nonce },
      headers: { Authorization: "Bearer access-user-a" },
    });
    expect(mock.fetch).toHaveBeenCalledWith(
      "https://backend.example/auth/v1/user",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: "public-key",
          Authorization: "Bearer access-user-a",
        },
        body: JSON.stringify({
          data: {
            first_name: "Camille",
            last_name: "Martin",
            full_name: "Camille Martin",
          },
        }),
      },
    );
    expect(mock.finish).toHaveBeenCalledWith(mock.current, {
      provider: "apple",
      next: "/clubs",
      referral: "ABC123",
    });
    expect(result?.route).toContain("social-signup");
  });
  it("cancels without signing in or returning an error", async () => {
    mock.native.mockRejectedValue({ code: "ERR_REQUEST_CANCELED" });
    expect(await signInSocial("apple", {})).toBeNull();
    expect(mock.token).not.toHaveBeenCalled();
  });
  it("rejects a mismatched state before giving a token to Supabase", async () => {
    mock.native.mockResolvedValue({
      state: "another-request",
      identityToken: "token",
      authorizationCode: "code",
    });
    await expect(signInSocial("apple", {})).rejects.toThrow("retour Apple");
    expect(mock.token).not.toHaveBeenCalled();
  });
  it("does not replace another account signed in while the Apple sheet was open", async () => {
    mock.native.mockImplementation(async () => {
      mock.current = session("other");
      return {
        state: "request-state",
        identityToken: "token",
        authorizationCode: "code",
      };
    });
    await expect(signInSocial("apple", {})).rejects.toThrow(
      "compte connecté a changé",
    );
    expect(mock.token).not.toHaveBeenCalled();
  });
  it("holds completion and signs out locally if revocation credentials cannot be stored", async () => {
    mock.invoke.mockResolvedValue({
      data: null,
      error: new Error("backend missing"),
    });
    await expect(signInSocial("apple", {})).rejects.toThrow(
      "n’a pas pu être finalisée",
    );
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mock.finish).not.toHaveBeenCalled();
  });
  it("never signs out a replacement account after a failed credential request", async () => {
    const a = session();
    mock.current = a;
    mock.invoke.mockImplementation(async () => {
      mock.current = session("other");
      return { data: null, error: new Error("network") };
    });
    await expect(
      registerAppleCredentials(a, {
        authorizationCode: "code",
        nonce: "nonce",
      }),
    ).rejects.toThrow();
    expect(mock.signOut).not.toHaveBeenCalled();
  });
  it("does not overwrite a customized profile name or require a second Apple name response", async () => {
    mock.token.mockImplementation(async () => {
      mock.current = session();
      mock.current.user.user_metadata = {
        first_name: "Perso",
        last_name: "Choisi",
        full_name: "Pseudo",
      };
      return { data: { session: mock.current }, error: null };
    });
    await signInSocial("apple", {});
    expect(mock.fetch).not.toHaveBeenCalled();
    mock.native.mockResolvedValue({
      state: "request-state",
      identityToken: "token",
      authorizationCode: "code",
      fullName: null,
    });
    await signInSocial("apple", {});
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it("pins the name update to the captured account when another sign-in happens during the request", async () => {
    const a = session();
    mock.current = a;
    mock.fetch.mockImplementation(async (_url, request) => {
      expect(request.headers.Authorization).toBe("Bearer access-user-a");
      mock.current = session("other");
      return { ok: true, json: async () => ({ id: "user-a" }) };
    });
    await expect(
      saveMissingAppleName(a, { givenName: "Camille" }),
    ).rejects.toThrow("compte connecté a changé");
  });
});

describe("provider OAuth callbacks", () => {
  it("does not let stripped OAuth parameters fall through to the legacy code exchange", async () => {
    mock.checkLegacy.mockRejectedValue(new Error("tentative incomplète"));
    await expect(exchangeAuthCode("stripped-params-code")).rejects.toThrow(
      "incomplète",
    );
    expect(mock.exchange).not.toHaveBeenCalled();
  });
  it("uses a full-page Web PKCE redirect on the current Expo origin", async () => {
    mock.platform.OS = "web";
    vi.stubGlobal("window", {
      location: {
        origin: "http://localhost:8082",
        assign: vi.fn(),
      },
    });
    expect(
      await signInSocial("google", {
        next: "/member/invitations?teamInvite=ABCDEFGHJK",
      }),
    ).toBeNull();
    expect(mock.oauth.mock.calls[0][0].options.skipBrowserRedirect).toBe(true);
    const redirectTo = mock.oauth.mock.calls[0][0].options.redirectTo;
    expect(redirectTo).toMatch(/^http:\/\/localhost:8082\/auth\/callback\?/);
    expect(redirectTo).toContain("social=google");
    expect(redirectTo).toContain("teamInvite");
    expect((window.location.assign as any).mock.calls[0][0]).toBe(
      "https://provider.example/authorize",
    );
    expect(mock.browser).not.toHaveBeenCalled();
  });
  it("opens the system browser on Android and treats closing it as cancellation", async () => {
    mock.platform.OS = "android";
    mock.browser.mockResolvedValue({ type: "cancel" });
    expect(await signInSocial("google", {})).toBeNull();
    expect(mock.oauth.mock.calls[0][0].options.skipBrowserRedirect).toBe(true);
    expect(mock.finish).not.toHaveBeenCalled();
  });
  it("completes a native Google browser return while preserving its safe destination", async () => {
    mock.platform.OS = "android";
    mock.browser.mockResolvedValue({
      type: "success",
      url: "com.footnation.app://auth/callback?code=native-google",
    });
    const result = await signInSocial("google", {
      next: "/suppression-compte",
    });
    expect(mock.checkAttempt).toHaveBeenCalledWith("oauth-attempt", "google");
    expect(mock.finish).toHaveBeenCalledWith(mock.current, {
      provider: "google",
      next: "/suppression-compte",
    });
    expect(result?.claim).toBe("native-google");
  });
  it("does not exchange an unexpected browser return URL", async () => {
    mock.platform.OS = "android";
    mock.browser.mockResolvedValue({
      type: "success",
      url: "https://other.example/auth/callback?code=unexpected-url",
    });
    await expect(signInSocial("google", {})).rejects.toThrow(
      "retour de connexion est invalide",
    );
    expect(mock.exchange).not.toHaveBeenCalled();
  });
  it("shares a single exchange and Apple registration across repeated callbacks", async () => {
    mock.exchange.mockImplementation(async () => {
      mock.current = session();
      return {
        data: {
          session: {
            ...mock.current,
            provider_refresh_token: "apple-refresh",
            provider_token: "apple-access",
          },
        },
        error: null,
      };
    });
    await Promise.all([
      finishSocialCallback("apple-shared-code", "apple", {}),
      finishSocialCallback("apple-shared-code", "apple", {}),
    ]);
    expect(mock.exchange).toHaveBeenCalledTimes(1);
    expect(mock.invoke).toHaveBeenCalledTimes(1);
    expect(mock.checkAttempt).toHaveBeenCalledTimes(1);
    expect(mock.invoke.mock.calls[0][1].body).toEqual({
      providerRefreshToken: "apple-refresh",
    });
  });
  it("refuses an authenticated-user change before completing a callback", async () => {
    mock.finish.mockImplementation(async () => {
      mock.current = session("other");
      return "/";
    });
    await expect(
      finishSocialCallback("switched-user-code", "google", {}),
    ).rejects.toThrow("compte connecté a changé");
  });
  it("refuses an account change before consuming the OAuth code", async () => {
    mock.checkAttempt.mockRejectedValue(
      new Error("Le compte connecté a changé."),
    );
    await expect(
      finishSocialCallback("code-after-switch", "google", {}, "oauth-attempt"),
    ).rejects.toThrow("compte connecté a changé");
    expect(mock.exchange).not.toHaveBeenCalled();
    expect(mock.finish).not.toHaveBeenCalled();
  });
});
