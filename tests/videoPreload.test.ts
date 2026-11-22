import { describe, expect, it } from "vitest";
import { conserveVideoData, nextPreloadVideo, preparedVideoWindow } from "../src/lib/videoPreload";

describe("bounded feed preparation", () => {
  const keys = ["short:a", "post:b", "short:c", "short:d"];
  it("reserves the connection for the active video until it plays a decoded frame", () => {
    expect(nextPreloadVideo(keys, null, null, false)).toBeNull();
    expect(nextPreloadVideo(keys, keys[0], null, false)).toBeNull();
    expect(nextPreloadVideo(keys, keys[0], keys[0], false)).toBe(keys[1]);
  });
  it("does not cascade downloads during fast swipes or stale playback callbacks", () => {
    expect(nextPreloadVideo(keys, keys[2], keys[0], false)).toBeNull();
    expect(nextPreloadVideo(keys, keys[2], keys[2], false)).toBe(keys[3]);
    expect(nextPreloadVideo(keys, keys[3], keys[3], false)).toBeNull();
    expect(nextPreloadVideo(keys, "removed", "removed", false)).toBeNull();
  });
  it("retains at most the loaded pair through repeated viewability gaps and promotion", () => {
    let prepared = preparedVideoWindow(keys, keys[0], keys[0], false, []);
    expect(prepared).toEqual([keys[0], keys[1]]);
    prepared = preparedVideoWindow(keys, null, null, false, prepared);
    expect(prepared).toEqual([keys[0], keys[1]]);
    prepared = preparedVideoWindow(keys, keys[1], keys[0], false, prepared);
    expect(prepared).toEqual([keys[1]]);
    prepared = preparedVideoWindow(keys, keys[1], keys[1], false, prepared);
    expect(prepared).toEqual([keys[1], keys[2]]);
    expect(preparedVideoWindow(keys, null, null, false, prepared)).toEqual(prepared);
    expect(preparedVideoWindow(keys, keys[1], null, false, prepared)).toEqual(prepared);
    expect(preparedVideoWindow(keys, keys[3], keys[1], false, prepared)).toEqual([keys[3]]);
    expect(preparedVideoWindow(keys, null, null, true, prepared)).toEqual([]);
    expect(preparedVideoWindow(keys.slice(3), null, null, false, prepared)).toEqual([]);
  });
  it("releases preloading when playback pauses or data saving is enabled", () => {
    expect(nextPreloadVideo(keys, keys[0], null, false)).toBeNull();
    expect(nextPreloadVideo(keys, keys[0], keys[0], true)).toBeNull();
  });
  it("works backwards without preloading a second neighbor", () => {
    expect(nextPreloadVideo(keys, keys[1], keys[1], false)).toBe(keys[2]);
    expect(nextPreloadVideo(keys, keys[0], keys[1], false)).toBeNull();
  });
});

it("honors browser data saver and very slow networks without blocking playback", () => {
  expect(conserveVideoData({ saveData: true, effectiveType: "4g" })).toBe(true);
  expect(conserveVideoData({ effectiveType: "slow-2g" })).toBe(true);
  expect(conserveVideoData({ effectiveType: "2g" })).toBe(true);
  expect(conserveVideoData({ saveData: false, effectiveType: "4g" })).toBe(
    false,
  );
  expect(conserveVideoData()).toBe(false);
});
