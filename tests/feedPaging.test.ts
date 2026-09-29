import { describe, expect, it } from "vitest";
import {
  feedPageIndex,
  feedPageOffset,
  feedSnapOffsets,
} from "../src/lib/feedPaging";

describe("full-screen feed paging", () => {
  it("keeps the intro and first publication separate for variable intro heights", () => {
    for (const introHeight of [124, 268.5, 920]) {
      expect(feedSnapOffsets(3, introHeight, 640)).toEqual([
        0,
        introHeight,
        introHeight + 640,
        introHeight + 1280,
      ]);
      expect(feedPageIndex(0, introHeight, 640, 3)).toBe(-1);
      expect(feedPageIndex(introHeight / 2 - 0.01, introHeight, 640, 3)).toBe(
        -1,
      );
      expect(feedPageIndex(introHeight / 2, introHeight, 640, 3)).toBe(0);
      expect(feedPageIndex(introHeight, introHeight, 640, 3)).toBe(0);
    }
  });

  it("deduplicates the intro stop when the first publication starts at zero", () => {
    expect(feedSnapOffsets(3, 0, 640)).toEqual([0, 640, 1280]);
    expect(feedPageIndex(0, 0, 640, 3)).toBe(0);
    expect(feedPageIndex(-45, 0, 640, 3)).toBe(0);
  });

  it("uses the nearest publication, resolving halfway ties toward the next page", () => {
    expect(feedPageIndex(200 + 300 - 0.01, 200, 600, 4)).toBe(0);
    expect(feedPageIndex(200 + 300, 200, 600, 4)).toBe(1);
    expect(feedPageIndex(200 + 600 + 299, 200, 600, 4)).toBe(1);
    expect(feedPageIndex(200 + 600 + 300, 200, 600, 4)).toBe(2);
    expect(feedPageIndex(-100, 200, 600, 4)).toBe(-1);
    expect(feedPageIndex(100_000, 200, 600, 4)).toBe(3);
  });

  it("preserves the current publication or intro when remeasured after rotation", () => {
    const before = { intro: 252.5, page: 702.25 };
    const after = { intro: 198.25, page: 326.5 };
    for (const index of [-1, 0, 1, 7, 11]) {
      const oldOffset = feedPageOffset(index, before.intro, before.page);
      const current = feedPageIndex(oldOffset, before.intro, before.page, 12);
      expect(current).toBe(index);
      const newOffset = feedPageOffset(current, after.intro, after.page);
      expect(feedPageIndex(newOffset, after.intro, after.page, 12)).toBe(index);
      expect(feedSnapOffsets(12, after.intro, after.page)).toContain(newOffset);
    }
  });

  it("ends at the last publication start and never adds a trailing empty page", () => {
    expect(feedSnapOffsets(1, 150, 650)).toEqual([0, 150]);
    const offsets = feedSnapOffsets(4, 150, 650);
    expect(offsets).toEqual([0, 150, 800, 1450, 2100]);
    expect(offsets.at(-1)).toBe(feedPageOffset(3, 150, 650));
    expect(offsets).not.toContain(feedPageOffset(4, 150, 650));
    expect(feedPageIndex(2750, 150, 650, 4)).toBe(3);
  });

  it("preserves fractional measurements and floors fractional indices/counts", () => {
    expect(feedPageOffset(2.9, 80.25, 600.5)).toBe(1281.25);
    expect(feedSnapOffsets(2.9, 80.25, 600.5)).toEqual([0, 80.25, 680.75]);
    expect(feedPageIndex(1281.25, 80.25, 600.5, 2.9)).toBe(1);
    expect(feedPageOffset(-1, 80.25, 600.5)).toBe(0);
  });

  it("returns safe empty states while dimensions or counts are unavailable", () => {
    for (const [intro, page] of [
      [0, 0],
      [200, -1],
      [-1, 600],
      [NaN, 600],
      [Infinity, 600],
      [200, NaN],
      [200, Infinity],
    ]) {
      expect(feedPageOffset(2, intro, page)).toBe(0);
      expect(feedSnapOffsets(3, intro, page)).toEqual([0]);
      expect(feedPageIndex(200, intro, page, 3)).toBe(-1);
    }
    for (const count of [0, 0.9, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      expect(feedSnapOffsets(count, 200, 600)).toEqual([0]);
      expect(feedPageIndex(200, 200, 600, count)).toBe(-1);
    }
    for (const invalid of [NaN, Infinity, -Infinity]) {
      expect(feedPageOffset(invalid, 200, 600)).toBe(0);
      expect(feedPageIndex(invalid, 200, 600, 3)).toBe(-1);
    }
  });

  it("keeps extreme finite inputs finite, ordered and deduplicated", () => {
    const offsets = feedSnapOffsets(4, Number.MAX_VALUE, Number.MAX_VALUE);
    expect(offsets).toEqual([0, Number.MAX_SAFE_INTEGER]);
    expect(feedPageOffset(Number.MAX_VALUE, 200, Number.MAX_VALUE)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(feedPageIndex(Number.MAX_VALUE, 200, Number.MIN_VALUE, 4)).toBe(3);
    expect(feedPageIndex(0, Number.MIN_VALUE, 600, 4)).toBe(-1);
    expect(offsets.every(Number.isFinite)).toBe(true);
  });
});
