import { it, expect } from "vitest";
import { playbackTime, clampedPlaybackTime } from "../src/lib/playbackTime";
it("accepts zero and numeric timestamps but rejects malformed links", () => {
  expect(playbackTime("0")).toBe(0);
  expect(playbackTime(61.8)).toBe(61);
  for (const value of [
    null,
    undefined,
    "",
    "bad",
    -1,
    Infinity,
    Number.MAX_VALUE,
    NaN,
    [],
    {},
  ])
    expect(playbackTime(value)).toBeNull();
});
it("keeps seeking within a known video duration", () => {
  expect(clampedPlaybackTime(120, 90)).toBe(89.9);
  expect(clampedPlaybackTime(40, 90)).toBe(40);
  expect(clampedPlaybackTime(40, 0)).toBe(40);
});
