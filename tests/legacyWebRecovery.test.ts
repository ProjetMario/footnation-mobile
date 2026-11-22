import { expect, it, vi } from "vitest";
import {
  createLegacyRecoveryRestorer,
  legacyRecoveryTokens,
} from "../src/lib/legacyWebRecovery";
const tokens = { access_token: "old-access", refresh_token: "old-refresh" };
const user = { id: "A" };
function fixture() {
  let stored: any = null;
  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    getSession: vi.fn(async () => ({ data: { session: stored }, error: null })),
    setSession: vi.fn(async (value: any) => {
      stored = { ...value, user };
      return { data: { session: stored }, error: null };
    }),
  };
  return { auth, restore: createLegacyRecoveryRestorer(auth as any) };
}
it("recognizes only complete legacy recovery fragments", () => {
  expect(
    legacyRecoveryTokens(
      "#access_token=old-access&refresh_token=old-refresh&type=recovery",
    ),
  ).toEqual(tokens);
  expect(legacyRecoveryTokens("#section")).toBeNull();
  expect(() => legacyRecoveryTokens("#access_token=one&type=recovery")).toThrow(
    "incomplet",
  );
  expect(() =>
    legacyRecoveryTokens("#access_token=one&refresh_token=two&type=signup"),
  ).toThrow("incomplet");
});
it("validates old emailed tokens and deduplicates React callback replays", async () => {
  const { auth, restore } = fixture();
  await Promise.all([restore(tokens), restore(tokens)]);
  expect(auth.getUser).toHaveBeenCalledWith(tokens.access_token);
  expect(auth.setSession).toHaveBeenCalledTimes(1);
});
it("never sets an invalid or expired emailed session", async () => {
  const { auth, restore } = fixture();
  auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { status: 401 },
  });
  await expect(restore(tokens)).rejects.toThrow("expiré");
  expect(auth.setSession).not.toHaveBeenCalled();
});
it("does not replace a different active account", async () => {
  const { auth, restore } = fixture();
  auth.getSession.mockResolvedValue({
    data: { session: { ...tokens, user: { id: "B" } } },
    error: null,
  });
  await expect(restore(tokens)).rejects.toThrow("autre compte");
  expect(auth.setSession).not.toHaveBeenCalled();
});
