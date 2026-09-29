import { it, expect, vi } from "vitest";
import {
  createAuthCodeExchange,
  createAuthNavigationClaims,
} from "../src/lib/authCodeExchange";
it("exchanges once for concurrent callbacks and a repeated mount", async () => {
  const operation = vi.fn(async () => {});
  const exchange = createAuthCodeExchange(operation);
  await Promise.all([exchange("one-use-code"), exchange("one-use-code")]);
  await exchange("one-use-code");
  expect(operation).toHaveBeenCalledTimes(1);
  await exchange("another-code");
  expect(operation).toHaveBeenCalledTimes(2);
});
it("partage l’identité réellement échangée et ne navigue qu’une fois", async () => {
  const exchange = createAuthCodeExchange(async () => "user-a");
  expect(await exchange("code")).toBe("user-a");
  const claim = createAuthNavigationClaims();
  expect(claim("code", "user-a", "user-b")).toBe(false);
  expect(claim("code", "user-a", "user-a")).toBe(true);
  expect(claim("code", "user-a", "user-a")).toBe(false);
  expect(claim("code", "user-b", "user-b")).toBe(false);
  expect(claim("other-code", "user-b", "user-b")).toBe(true);
});
it("allows a failed network exchange to be retried", async () => {
  const operation = vi
    .fn(async () => {})
    .mockRejectedValueOnce(new Error("offline"));
  const exchange = createAuthCodeExchange(operation);
  await expect(exchange("code")).rejects.toThrow("offline");
  await exchange("code");
  expect(operation).toHaveBeenCalledTimes(2);
});
