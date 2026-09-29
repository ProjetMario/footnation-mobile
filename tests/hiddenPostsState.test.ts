import { describe, expect, it } from "vitest";
import {
  createHiddenPostStore,
  parseHiddenPosts,
} from "../src/lib/hiddenPostsState";
const a = "00000000-0000-0000-0000-000000000001";
const b = "00000000-0000-0000-0000-000000000002";
const post1 = "10000000-0000-0000-0000-000000000001";
const post2 = "10000000-0000-0000-0000-000000000002";
function harness() {
  const data = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: async (key: string) => {
      data.delete(key);
    },
  };
  return { store: createHiddenPostStore(storage), storage };
}
describe("per-account hidden publications", () => {
  it("serializes quick hides and survives reload without affecting the next account", async () => {
    const { store, storage } = harness();
    await Promise.all([
      store.hide(a, post1),
      store.hide(a, post2),
      store.hide(a, post1),
    ]);
    expect(await createHiddenPostStore(storage).list(a)).toEqual([
      post1,
      post2,
    ]);
    expect(await store.list(b)).toEqual([]);
  });
  it("cleans confirmed account deletion and fences later writes", async () => {
    const { store } = harness();
    await store.hide(a, post1);
    await store.hide(b, post2);
    await store.forget(a);
    await expect(store.hide(a, post2)).rejects.toThrow("supprimé");
    expect(await store.list(a)).toEqual([]);
    expect(await store.list(b)).toEqual([post2]);
  });
  it("keeps a failed write from pretending content is hidden", async () => {
    const { storage } = harness();
    const store = createHiddenPostStore({
      ...storage,
      setItem: async () => {
        throw new Error("disk full");
      },
    });
    await expect(store.hide(a, post1)).rejects.toThrow("disk full");
    expect(await store.list(a)).toEqual([]);
  });
  it("rejects damaged storage rather than silently replacing it", () => {
    expect(() => parseHiddenPosts("{broken")).toThrow();
    expect(() => parseHiddenPosts('["not-an-id"]')).toThrow();
  });
});
