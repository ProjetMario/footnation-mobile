import { describe, expect, it, vi } from "vitest";
import {
  createWebSoundtrackPlayer,
  type SoundtrackStatus,
} from "../src/lib/soundtrackPlayer";

function fixture() {
  const audio = Object.assign(new EventTarget(), {
    muted: true,
    loop: false,
    volume: 1,
    playbackRate: 1,
    currentTime: 0,
    duration: 60,
    paused: true,
    ended: false,
    readyState: 1,
    play: vi.fn(async () => {
      audio.paused = false;
    }),
    pause: vi.fn(() => {
      audio.paused = true;
      audio.dispatchEvent(new Event("pause"));
    }),
    removeAttribute: vi.fn(),
    load: vi.fn(),
    remove: vi.fn(),
  });
  const states: SoundtrackStatus[] = [];
  return {
    audio,
    states,
    ...createWebSoundtrackPlayer(audio as unknown as HTMLAudioElement, (s) =>
      states.push(s),
    ),
  };
}
describe("soundtrack browser playback", () => {
  it("shows blocked sound rather than claiming it is playing, and retries on the next tap", async () => {
    const f = fixture();
    f.audio.play.mockRejectedValueOnce(
      Object.assign(new Error("gesture required"), { name: "NotAllowedError" }),
    );
    await expect(f.player.play()).resolves.toBeUndefined();
    expect(f.states.at(-1)).toMatchObject({
      playing: false,
      blocked: true,
      failed: false,
    });
    await f.player.play();
    expect(f.states.at(-1)).toMatchObject({
      playing: true,
      blocked: false,
      failed: false,
    });
  });
  it("starts play synchronously in the user gesture", async () => {
    const f = fixture();
    const promise = f.player.play();
    expect(f.audio.play).toHaveBeenCalledTimes(1);
    await promise;
  });
  it("cannot restart an offscreen track when a pending play resolves", async () => {
    const f = fixture();
    let finish!: () => void;
    f.audio.play.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const playing = f.player.play();
    f.player.pause();
    finish();
    await playing;
    expect(f.audio.paused).toBe(true);
    expect(f.states.every((s) => !s.playing)).toBe(true);
  });
  it("handles failed media separately from browser permissions", async () => {
    const f = fixture();
    f.audio.play.mockRejectedValueOnce(
      Object.assign(new Error("source unavailable"), {
        name: "NotSupportedError",
      }),
    );
    await f.player.play();
    expect(f.states.at(-1)).toMatchObject({
      playing: false,
      blocked: false,
      failed: true,
    });
  });
  it("releases media and listeners on leaving the publication", async () => {
    const f = fixture();
    await f.player.play();
    f.dispose();
    const count = f.states.length;
    f.audio.dispatchEvent(new Event("playing"));
    await f.player.play();
    expect(f.states).toHaveLength(count);
    expect(f.audio.paused).toBe(true);
    expect(f.audio.removeAttribute).toHaveBeenCalledWith("src");
    expect(f.audio.remove).toHaveBeenCalledOnce();
  });
});
