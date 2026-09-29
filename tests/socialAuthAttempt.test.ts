import { describe, expect, it } from "vitest";
import { createSocialAuthAttempts } from "../src/lib/socialAuthAttemptState";

function setup() {
  const values = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
  let user: string | null = null,
    time = 1000,
    id = 0;
  const options = {
    storage,
    randomId: () => `attempt-${++id}`,
    currentUser: async () => user,
    now: () => time,
  };
  return {
    values,
    attempts: createSocialAuthAttempts(options),
    reload: () => createSocialAuthAttempts(options),
    account: (value: string | null) => {
      user = value;
    },
    advance: (amount: number) => {
      time += amount;
    },
  };
}
describe("OAuth attempt account binding", () => {
  it("rejects a callback missing its OAuth parameters while a social attempt exists", async () => {
    const test = setup();
    await test.attempts.begin("google");
    await expect(test.attempts.checkLegacy()).rejects.toThrow("incomplète");
  });
  it("allows a legitimate e-mail callback after the user explicitly starts an e-mail journey", async () => {
    const test = setup();
    const attempt = await test.attempts.begin("apple");
    await test.attempts.beginEmail();
    await expect(test.attempts.checkLegacy()).resolves.toBeUndefined();
    await expect(test.attempts.check(attempt.id, "apple")).rejects.toThrow(
      "expiré",
    );
  });
  it("survives Web navigation without keeping tokens or a verifier in the context", async () => {
    const test = setup();
    const attempt = await test.attempts.begin("apple");
    await expect(
      test.reload().check(attempt.id, "apple"),
    ).resolves.toBeUndefined();
    expect(JSON.parse([...test.values.values()][0])).toEqual({
      id: attempt.id,
      userId: null,
      provider: "apple",
      createdAt: 1000,
    });
  });
  it("allows deliberate reauthentication of the same existing account", async () => {
    const test = setup();
    test.account("a");
    const attempt = await test.attempts.begin("google");
    await expect(
      test.attempts.check(attempt.id, "google"),
    ).resolves.toBeUndefined();
  });
  it("rejects another account becoming current before the callback", async () => {
    const test = setup();
    const attempt = await test.attempts.begin("google");
    test.account("b");
    await expect(test.attempts.check(attempt.id, "google")).rejects.toThrow(
      "compte connecté a changé",
    );
  });
  it("also rejects signing out during reauthentication", async () => {
    const test = setup();
    test.account("a");
    const attempt = await test.attempts.begin("google");
    test.account(null);
    await expect(test.attempts.check(attempt.id, "google")).rejects.toThrow(
      "compte connecté a changé",
    );
  });
  it("rejects missing IDs and a different provider", async () => {
    const test = setup();
    const attempt = await test.attempts.begin("apple");
    await expect(test.attempts.check(undefined, "apple")).rejects.toThrow(
      "expiré",
    );
    await expect(test.attempts.check(attempt.id, "google")).rejects.toThrow(
      "expiré",
    );
  });
  it("expires after ten minutes", async () => {
    const test = setup();
    const attempt = await test.attempts.begin("apple");
    test.advance(600001);
    await expect(test.attempts.check(attempt.id, "apple")).rejects.toThrow(
      "expiré",
    );
  });
  it("does not let an older callback clear or use a new attempt", async () => {
    const test = setup();
    const first = await test.attempts.begin("apple");
    const second = await test.attempts.begin("google");
    await test.attempts.clear(first.id);
    await expect(test.attempts.check(first.id, "apple")).rejects.toThrow(
      "expiré",
    );
    await expect(
      test.attempts.check(second.id, "google"),
    ).resolves.toBeUndefined();
    expect(test.values.size).toBe(1);
  });
  it("removes only a completed or canceled attempt", async () => {
    const test = setup();
    const attempt = await test.attempts.begin("apple");
    await test.attempts.clear(attempt.id);
    expect(test.values.size).toBe(0);
  });
});
