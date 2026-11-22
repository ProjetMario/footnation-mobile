import { describe, expect, it } from "vitest";
import {
  createAccountSessionStorage,
  authStorageKey,
} from "../src/lib/accountSessionStorage";
function fixture() {
  const values = new Map<string, string>();
  const store = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
  return {
    values,
    store,
    web: createAccountSessionStorage(store, {
      authStorageKey: "footnation-auth",
    }),
  };
}
const payload = (id: string) =>
  JSON.stringify({ user: { id }, access_token: `token-${id}` });
describe("shared website / Expo Web auth storage", () => {
  it("reads the website's session and strips provider secrets without copying a native key", async () => {
    const { values, web } = fixture();
    values.set(
      "footnation-auth",
      JSON.stringify({ user: { id: "A" }, provider_token: "private" }),
    );
    expect(await web.getItem("footnation-auth")).toBe(
      JSON.stringify({ user: { id: "A" } }),
    );
    expect(values.has(authStorageKey)).toBe(false);
  });
  it("keeps the new account when an older account deletion finishes", async () => {
    const { web } = fixture();
    await web.setItem("footnation-auth", payload("B"));
    expect(await web.removeAccountSession("A")).toBe("other");
    expect(await web.getItem("footnation-auth")).toBe(payload("B"));
    await expect(web.setItem("footnation-auth", payload("A"))).rejects.toThrow(
      "supprimé",
    );
  });
  it("removes the shared session and never falls back to an old Expo browser account", async () => {
    const { values, web } = fixture();
    values.set(authStorageKey, payload("old-preview"));
    await web.setItem("footnation-auth", payload("A"));
    await web.removeItem("footnation-auth");
    expect(await web.getItem("footnation-auth")).toBeNull();
  });
  it("retains the native storage namespace by default", async () => {
    const { store, values } = fixture();
    const native = createAccountSessionStorage(store);
    await native.setItem(authStorageKey, payload("A"));
    await native.removeAccountSession("A");
    expect(values.get(authStorageKey)).toBeUndefined();
    expect(values.get("footnation-auth")).toBeUndefined();
  });
});
