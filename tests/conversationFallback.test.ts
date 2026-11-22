import { expect, it, vi } from "vitest";
import { readLegacyConversationPage } from "../src/lib/conversationFallback";

const page = (offset: number, unread: number[] = []) =>
  Array.from({ length: 30 }, (_, index) => ({
    id: offset + index,
    unread_count: unread.includes(index) ? 1 : 0,
  }));

it("finds older unread conversations and retains the next source offset", async () => {
  const fetch = vi.fn(async (offset: number) => ({
    data: page(offset, offset === 30 ? [2, 5] : []),
    error: null,
  }));
  const result = await readLegacyConversationPage(fetch, 0, true);
  expect(fetch.mock.calls.map(([offset]) => offset)).toEqual([0, 30]);
  expect(result.items.map((item) => item.id)).toEqual([32, 35]);
  expect(result.next).toBe(60);
});

it("bounds empty scans and lets the user continue without skipping pages", async () => {
  const fetch = vi.fn(async (offset: number) => ({ data: page(offset), error: null }));
  expect(await readLegacyConversationPage(fetch, 0, true)).toEqual({ items: [], next: 90 });
  expect(fetch.mock.calls.map(([offset]) => offset)).toEqual([0, 30, 60]);
});

it("stops on the final short page and preserves the ordinary unfiltered page", async () => {
  const fetch = vi.fn(async () => ({ data: page(0).slice(0, 5), error: null }));
  expect(await readLegacyConversationPage(fetch, 0, true)).toEqual({ items: [], next: undefined });
  expect((await readLegacyConversationPage(fetch, 0, false)).items).toHaveLength(5);
});

it("propagates a failed page instead of claiming no unread messages", async () => {
  const failure = new Error("read failed");
  await expect(readLegacyConversationPage(async () => ({ data: null, error: failure }), 0, true)).rejects.toThrow("read failed");
});
