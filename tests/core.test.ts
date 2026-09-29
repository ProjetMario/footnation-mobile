import { test } from "node:test";
import assert from "node:assert/strict";
import { createChunkedStorage } from "../src/lib/chunkedStorage.ts";
import {
  isSuspended,
  safeInternalPath,
  strongPassword,
  validEmail,
  ownConversationPeer,
} from "../src/lib/validation.ts";
function harness() {
  const data = new Map<string, string>();
  let n = 0;
  let fail = false;
  const store = createChunkedStorage(
    {
      getItem: async (k) => data.get(k) || null,
      setItem: async (k, v) => {
        if (fail && k.endsWith(".1")) throw new Error("disk full");
        data.set(k, v);
      },
      removeItem: async (k) => {
        data.delete(k);
      },
    },
    () => `generation${++n}`,
  );
  return {
    data,
    store,
    setFail: () => {
      fail = true;
    },
  };
}
test("large and Unicode sessions survive chunking and replacement", async () => {
  const { store, data } = harness();
  const value = "⚽Bonjour ".repeat(1200);
  await store.setItem("session", value);
  assert.equal(await store.getItem("session"), value);
  await store.setItem("session", "new");
  assert.equal(await store.getItem("session"), "new");
  assert.equal(data.size, 2);
  await store.removeItem("session");
  assert.equal(await store.getItem("session"), null);
  assert.equal(data.size, 0);
});
test("a failed partial write retains the previous complete session", async () => {
  const { store, setFail } = harness();
  await store.setItem("session", "old");
  setFail();
  await assert.rejects(store.setItem("session", "x".repeat(1000)));
  assert.equal(await store.getItem("session"), "old");
});
test("secure UTF-8 chunk roundtrips preserve emoji at every chunk boundary", async () => {
  const data = new Map<string, string>();
  const store = createChunkedStorage(
    {
      getItem: async (key) => data.get(key) ?? null,
      setItem: async (key, value) => {
        data.set(key, Buffer.from(value, "utf8").toString("utf8"));
      },
      removeItem: async (key) => {
        data.delete(key);
      },
    },
    () => "unicode",
  );
  const value = "x".repeat(399) + "🌍" + "⚽".repeat(399) + "🇫🇷" + " مرحبا";
  await store.setItem("session", value);
  assert.equal(await store.getItem("session"), value);
  assert.ok(
    [...data.values()].every((part) => Buffer.byteLength(part, "utf8") < 2048),
  );
});
test("concurrent writes and reads remain serialized per session", async () => {
  const { store } = harness();
  const a = store.setItem("session", "first"),
    b = store.setItem("session", "second"),
    c = store.getItem("session");
  await Promise.all([a, b]);
  assert.equal(await c, "second");
});
test("broken stored sessions are reported instead of partially returned", async () => {
  const { store, data } = harness();
  await store.setItem("session", "a".repeat(500));
  data.delete("session.generation1.1");
  await assert.rejects(store.getItem("session"));
});
test("suspensions include indefinite and invalid expiry and exclude expired ones", () => {
  assert.equal(isSuspended({ is_suspended: true }), true);
  assert.equal(
    isSuspended({ is_suspended: true, suspended_until: "invalid" }),
    true,
  );
  assert.equal(
    isSuspended(
      { is_suspended: true, suspended_until: "2020-01-01" },
      Date.parse("2026-01-01"),
    ),
    false,
  );
  assert.equal(isSuspended({ is_suspended: false }), false);
});
test("notification links cannot redirect outside the app", () => {
  for (const link of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/\nmalformed",
  ])
    assert.equal(safeInternalPath(link), "/");
  assert.equal(safeInternalPath("/posts/abc"), "/posts/abc");
});
test("credentials preserve source password requirements", () => {
  assert.equal(strongPassword("Football9"), true);
  assert.equal(strongPassword("football9"), false);
  assert.equal(strongPassword("FOOTBALL9"), false);
  assert.equal(strongPassword("Football"), false);
  assert.equal(validEmail("hello@example.test"), true);
  assert.equal(validEmail("hello"), false);
});
test("messages not involving the viewer have no conversation peer", () => {
  assert.equal(ownConversationPeer("a", "b", "a"), "b");
  assert.equal(ownConversationPeer("a", "b", "b"), "a");
  assert.equal(ownConversationPeer("a", "b", "c"), null);
});
