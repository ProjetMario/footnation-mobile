import { expect, it, vi } from "vitest";
import {
  createSocialAuthFlow,
  type SocialAuthResult,
} from "../src/lib/socialAuthFlow";
import { SocialAuthError } from "../src/lib/socialAuthPolicy";

it("delivers the result to the replacement screen after the session remounts", async () => {
  let finish!: (result: SocialAuthResult) => void;
  const signIn = vi.fn(
    () =>
      new Promise<SocialAuthResult>((resolve) => {
        finish = resolve;
      }),
  );
  const flow = createSocialAuthFlow(signIn);
  const first = vi.fn();
  const unmount = flow.subscribe(first);
  const running = flow.start("apple", { next: "/clubs" });
  expect(flow.getSnapshot().busy).toBe("apple");
  unmount();
  const replacement = vi.fn();
  flow.subscribe(replacement);
  await flow.start("google", {});
  expect(signIn).toHaveBeenCalledTimes(1);
  const result = {
    session: { user: { id: "a" } },
    route: "/clubs",
    claim: "apple-state",
  } as SocialAuthResult;
  finish(result);
  await running;
  expect(first).toHaveBeenCalledTimes(1);
  expect(replacement).toHaveBeenCalledTimes(1);
  expect(flow.getSnapshot()).toEqual({ busy: null, result, error: "" });
  flow.consume(result);
  expect(flow.getSnapshot().result).toBeNull();
});

it("retains an Apple failure after a sign-out remount and permits a fresh attempt", async () => {
  const signIn = vi
    .fn()
    .mockRejectedValueOnce(new SocialAuthError("Connexion Apple indisponible"))
    .mockResolvedValueOnce(null);
  const flow = createSocialAuthFlow(signIn);
  await flow.start("apple", {});
  expect(flow.getSnapshot()).toMatchObject({
    busy: null,
    error: "Connexion Apple indisponible",
  });
  await flow.start("apple", {});
  expect(flow.getSnapshot()).toEqual({ busy: null, result: null, error: "" });
});
