import { describe, expect, it, vi } from "vitest";
import {
  clipPosition,
  createShortAudioSync,
  missingGoalColumn,
  musicFields,
  playbackClip,
  shortClip,
  shortGoals,
  soundtrackPosition,
} from "../src/lib/shortEditing";
import { musicLibrary } from "../src/data/shortMusicLibrary";
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
describe("Short excerpt and metadata", () => {
  it("keeps an untrimmed upload unbounded and parses explicit decimal clip positions", () => {
    expect(shortClip("0", "", 60)).toBeNull();
    expect(shortClip("0", "", 0)).toBeNull();
    expect(shortClip("2,5", "12.5", 60)).toEqual({ start: 2.5, duration: 10 });
    expect(shortClip("12", "", 60)).toEqual({ start: 12, duration: 48 });
  });
  it("rejects unknown duration, backwards, nonfinite and outside-media excerpts", () => {
    for (const input of [
      ["5", "10", 0],
      ["-1", "5", 10],
      ["5", "5", 10],
      ["2", "11", 10],
      ["bad", "8", 10],
      ["0", "Infinity", 10],
      ["0", "0.05", 1],
    ] as const)
      expect(() => shortClip(...input)).toThrow();
  });
  it("clamps read-side ranges to real metadata and loops only outside the excerpt", () => {
    const clip = playbackClip({ start: 10, duration: 15 }, 20);
    expect(clip).toEqual({ start: 10, end: 20 });
    expect(clipPosition(0, clip)).toBe(10);
    expect(clipPosition(12.5, clip)).toBe(12.5);
    expect(clipPosition(20, clip)).toBe(10);
    expect(clipPosition(12.5, null)).toBe(12.5);
    expect(playbackClip({ start: NaN, duration: 1 }, 60)).toBeNull();
  });
  it("stores sorted unique absolute goal positions and refuses out-of-excerpt values", () => {
    const clip = { start: 30, duration: 10 };
    expect(shortGoals([35, 30, 35], clip, 60)).toEqual([30, 35]);
    for (const marks of [
      [29],
      [40],
      [Infinity],
      [NaN],
      Array.from({ length: 51 }, (_, i) => 30 + i / 10),
    ])
      expect(() => shortGoals(marks, clip, 60)).toThrow();
    expect(() => shortGoals([1], null, 0)).toThrow();
    expect(shortGoals([], null, 0)).toEqual([]);
  });
  it("requires an explicit catalogue choice and never assigns the website's default automatically", () => {
    expect(musicFields(null)).toEqual({
      music: null,
      artist: null,
      music_url: null,
    });
    const chosen = musicLibrary[0];
    expect(musicFields(chosen.id)).toEqual({
      music: chosen.title,
      artist: chosen.artist,
      music_url: chosen.audioUrl,
    });
    expect(() => musicFields("absent")).toThrow("catalogue");
  });
  it("distinguishes a missing column from network and permission errors", () => {
    expect(
      missingGoalColumn({
        code: "42703",
        message: "column goal_timestamps does not exist",
      }),
    ).toBe(true);
    for (const error of [
      { code: "42703", message: "column unrelated does not exist" },
      { code: "42501", message: "goal_timestamps denied" },
      Error("offline"),
    ])
      expect(missingGoalColumn(error)).toBe(false);
  });
});
describe("Short soundtrack synchronization", () => {
  it("starts music at excerpt zero and loops a shorter catalogue track", () => {
    expect(soundtrackPosition(30, 30, 5)).toBe(0);
    expect(soundtrackPosition(37, 30, 5)).toBe(2);
    expect(soundtrackPosition(20, 30, 5)).toBe(0);
  });
  it("never resumes a stale seek after pause, call or unmount", async () => {
    const seek = deferred(),
      sync = createShortAudioSync();
    const port = {
      time: () => 0,
      seek: vi.fn(() => seek.promise),
      pause: vi.fn(),
      play: vi.fn(),
    };
    const running = sync.sync({ target: 10, play: true }, port);
    sync.stop(port.pause);
    seek.resolve();
    await running;
    expect(port.pause).toHaveBeenCalled();
    expect(port.play).not.toHaveBeenCalled();
  });
  it("serializes a new seek after an earlier one and plays only the latest position", async () => {
    const first = deferred(),
      sync = createShortAudioSync();
    let position = 0;
    const port = {
      time: () => position,
      seek: vi
        .fn()
        .mockImplementationOnce(async () => {
          await first.promise;
          position = 10;
        })
        .mockImplementationOnce(async (n: number) => {
          position = n;
        }),
      pause: vi.fn(),
      play: vi.fn(),
    };
    const running = sync.sync({ target: 10, play: true }, port);
    await sync.sync({ target: 2, play: true }, port);
    first.resolve();
    await running;
    expect(port.seek.mock.calls.map((call) => call[0])).toEqual([10, 2]);
    expect(position).toBe(2);
    expect(port.play).toHaveBeenCalledTimes(1);
  });
  it("pauses immediately while an old seek is pending and does not invent a resume", async () => {
    const seek = deferred(),
      sync = createShortAudioSync(),
      port = {
        time: () => 0,
        seek: vi.fn(() => seek.promise),
        pause: vi.fn(),
        play: vi.fn(),
      };
    const running = sync.sync({ target: 10, play: true }, port);
    await sync.sync({ target: 0, play: false }, port);
    expect(port.pause).toHaveBeenCalled();
    seek.resolve();
    await running;
    expect(port.play).not.toHaveBeenCalled();
  });
});
