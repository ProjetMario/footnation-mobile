import { afterEach, expect, it, vi } from "vitest";
vi.mock("../src/lib/supabase", () => ({ requireBackend: vi.fn() }));
import { getSocialAuthProviders } from "../src/lib/socialAuthProviders";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("reflects the public backend configuration without turning on disabled providers", async () => {
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://fixture.example");
  vi.stubEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", "fixture-only");
  const fetcher = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ external: { google: true, apple: false } }),
    });
  vi.stubGlobal("fetch", fetcher);
  expect(await getSocialAuthProviders()).toEqual({
    google: true,
    apple: false,
  });
  expect(fetcher).toHaveBeenCalledWith(
    "https://fixture.example/auth/v1/settings",
    expect.objectContaining({
      headers: { apikey: "fixture-only" },
      signal: expect.any(AbortSignal),
    }),
  );
});

it("does not advertise an unverified provider after a network or malformed response", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetcher);
  await expect(getSocialAuthProviders()).rejects.toThrow();
  await expect(getSocialAuthProviders()).rejects.toThrow();
});
