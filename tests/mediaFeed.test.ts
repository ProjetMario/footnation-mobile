import { describe, expect, it, vi } from "vitest";
import {
  createPageRequestGate,
  nextMediaPosition,
  uniqueFeedItems,
  visibleMediaId,
} from "../src/lib/mediaFeed";

describe("feed media visibility", () => {
  it("keeps the currently visible video stable and releases it when it leaves", () => {
    const first = { id: "first", video_url: "first.mp4" };
    const second = { id: "second", video_url: "second.mp4" };
    expect(visibleMediaId([{ item: first }, { item: second }], "second")).toBe(
      "second",
    );
    expect(
      visibleMediaId(
        [{ item: first }, { item: second, isViewable: false }],
        "second",
      ),
    ).toBe("first");
    expect(
      visibleMediaId([{ item: { id: "photo", video_url: null } }], "first"),
    ).toBeNull();
    expect(visibleMediaId([], "first")).toBeNull();
  });

  it("includes photo/text soundtracks only when requested by the home feed", () => {
    const items = [
      { item: { id: "photo", video_url: null } },
      { item: { id: "video", video_url: "video.mp4" }, isViewable: false },
    ];
    expect(visibleMediaId(items, "video", true)).toBe("photo");
    expect(visibleMediaId(items, "video")).toBeNull();
    expect(visibleMediaId([], "photo", true)).toBeNull();
  });

  it("removes overlap between pages without changing content or chronological order", () => {
    const latest = { id: "a", content: "latest content" };
    const other = { id: "b", content: "other content" };
    const end = { id: "c", content: "last content" };
    expect(
      uniqueFeedItems([
        [latest, other],
        [{ id: "b", content: "stale duplicate" }, end],
      ]),
    ).toEqual([latest, other, end]);
    expect(uniqueFeedItems()).toEqual([]);
  });
});

describe("feed pagination", () => {
  const page = {
    key: "account:all:20:last-post",
    hasNextPage: true,
    isFetching: false,
    isError: false,
  };
  it("coalesces end-reached events even before query state rerenders", async () => {
    const gate = createPageRequestGate();
    let finish!: () => void;
    const fetch = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const first = gate.run(page, fetch);
    expect(await gate.run(page, fetch)).toBe(false);
    expect(await gate.run({ ...page, retry: true }, fetch)).toBe(false);
    finish();
    expect(await first).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not loop on a failed page but permits an explicit retry", async () => {
    const gate = createPageRequestGate();
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    expect(await gate.run(page, fetch)).toBe(false);
    expect(await gate.run({ ...page, isError: true }, fetch)).toBe(false);
    expect(await gate.run(page, fetch)).toBe(false);
    expect(await gate.run({ ...page, isError: true, retry: true }, fetch)).toBe(
      true,
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("requires list progress before another automatic page", async () => {
    const gate = createPageRequestGate();
    const fetch = vi.fn().mockResolvedValue(undefined);
    await gate.run(page, fetch);
    expect(await gate.run(page, fetch)).toBe(false);
    expect(
      await gate.run({ ...page, key: "account:all:40:next-last" }, fetch),
    ).toBe(true);
    expect(
      await gate.run({ ...page, key: "account:network:20:last-post" }, fetch),
    ).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("does not compete with refresh or request a known final page", async () => {
    const gate = createPageRequestGate();
    const fetch = vi.fn().mockResolvedValue(undefined);
    expect(
      await gate.run({ ...page, isFetching: true, retry: true }, fetch),
    ).toBe(false);
    expect(
      await gate.run({ ...page, hasNextPage: false, retry: true }, fetch),
    ).toBe(false);
    expect(await gate.run({ ...page, isError: true }, fetch)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("video reload and replay seeking", () => {
  it("restores playback position without replaying an already consumed highlight", () => {
    const seek = { seconds: 12, play: true, request: 1 };
    expect(
      nextMediaPosition({ seconds: 0, seekRequest: null }, seek, 90),
    ).toEqual({ seconds: 12, play: true, seekRequest: 1 });
    expect(
      nextMediaPosition({ seconds: 38.5, seekRequest: 1 }, seek, 90),
    ).toEqual({ seconds: 38.5, play: false, seekRequest: 1 });
    expect(
      nextMediaPosition(
        { seconds: 38.5, seekRequest: 1 },
        { ...seek, request: 2 },
        90,
      ),
    ).toEqual({ seconds: 12, play: true, seekRequest: 2 });
  });
  it("clamps highlights to duration and preserves pause-only seek requests", () => {
    expect(
      nextMediaPosition(
        { seconds: 10, seekRequest: null },
        { seconds: 140, play: false, request: 4 },
        90,
      ),
    ).toEqual({ seconds: 89.9, play: false, seekRequest: 4 });
    expect(
      nextMediaPosition({ seconds: 80, seekRequest: 4 }, undefined, 60),
    ).toEqual({ seconds: 59.9, play: false, seekRequest: 4 });
  });
  it("ignores invalid seek values without losing the last valid position", () => {
    for (const seconds of [-1, NaN, Infinity, Number.MAX_VALUE]) {
      expect(
        nextMediaPosition(
          { seconds: 5, seekRequest: 1 },
          { seconds, play: true, request: 2 },
          0,
        ),
      ).toEqual({ seconds: 5, play: false, seekRequest: 1 });
    }
    expect(
      nextMediaPosition({ seconds: NaN, seekRequest: null }, undefined, 0)
        .seconds,
    ).toBe(0);
  });
});
