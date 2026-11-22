import { describe, expect, it } from "vitest";
import {
  GUEST_PREVIEW_STORAGE_KEY,
  guestPreviewRemaining,
  readGuestPreviewDeadline,
  startGuestPreview,
  type GuestPreviewStorage,
} from "../src/lib/guestPreviewPolicy";

function storage(initial?: string) {
  const values = new Map<string, string>(
    initial ? [[GUEST_PREVIEW_STORAGE_KEY, initial]] : [],
  );
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("anonymous public preview", () => {
  it("does not start before the first content view", () => {
    const state = storage();
    expect(readGuestPreviewDeadline(state, 1000)).toBeNull();
    expect(state.getItem(GUEST_PREVIEW_STORAGE_KEY)).toBeNull();
  });
  it("shares exactly thirty seconds across screens and reloads", () => {
    const state = storage();
    expect(startGuestPreview(state, 1000)).toBe(31000);
    expect(startGuestPreview(state, 20000)).toBe(31000);
    const reloaded = storage(state.getItem(GUEST_PREVIEW_STORAGE_KEY)!);
    expect(startGuestPreview(reloaded, 25000)).toBe(31000);
    expect(guestPreviewRemaining(31000, 30999)).toBe(1);
    expect(guestPreviewRemaining(31000, 31000)).toBe(0);
  });
  it("never renews an expired preview", () => {
    expect(startGuestPreview(storage("1000"), 90000)).toBe(31000);
    expect(guestPreviewRemaining(31000, 90000)).toBe(0);
  });
  it("keeps a deadline even when the browser refuses writes", () => {
    const state: GuestPreviewStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("storage unavailable");
      },
    };
    expect(startGuestPreview(state, 1000)).toBe(31000);
    expect(startGuestPreview(state, 5000)).toBe(31000);
  });
  it("keeps a deadline even when the browser refuses reads and writes", () => {
    const state: GuestPreviewStorage = {
      getItem: () => {
        throw new Error("unavailable");
      },
      setItem: () => {
        throw new Error("unavailable");
      },
    };
    expect(startGuestPreview(state, 1000)).toBe(31000);
    expect(startGuestPreview(state, 50000)).toBe(31000);
  });
  it.each(["not-a-date", "-100", "Infinity", "99999999999999"])(
    "recovers from invalid storage: %s",
    (value) => {
      expect(startGuestPreview(storage(value), 1000)).toBe(31000);
    },
  );
});
