import { expect, it, vi } from "vitest";
import { createMediaPlaybackControl } from "../src/lib/mediaPlaybackControl";

function deferred() {
  let resolve!: () => void, reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function setup(play: () => void | Promise<void>) {
  const port = {
    play: vi.fn(play),
    pause: vi.fn(),
    playing: vi.fn(() => false),
    onError: vi.fn(),
  };
  return { port, control: createMediaPlaybackControl(port) };
}
it("starts synchronously and coalesces pending requests from focus and readiness", async () => {
  const pending = deferred();
  const { port, control } = setup(() => pending.promise);
  control.play();
  expect(port.play).toHaveBeenCalledTimes(1);
  control.play();
  expect(port.play).toHaveBeenCalledTimes(1);
  pending.resolve();
  await flush();
  port.playing.mockReturnValue(true);
  control.play();
  expect(port.play).toHaveBeenCalledTimes(1);
});
it("handles a pending play interrupted by pause without reporting broken media", async () => {
  const pending = deferred();
  const { port, control } = setup(() => pending.promise);
  control.play();
  control.pause();
  pending.reject(
    new DOMException(
      "The play() request was interrupted by pause()",
      "AbortError",
    ),
  );
  await flush();
  expect(port.pause).toHaveBeenCalledTimes(1);
  expect(port.onError).not.toHaveBeenCalled();
});
it("does not let a late previous request reset the pending replay", async () => {
  const first = deferred(),
    second = deferred();
  const { port, control } = setup(() => first.promise);
  port.play
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  control.play();
  control.pause();
  control.play();
  first.reject(new DOMException("Interrupted", "AbortError"));
  await flush();
  control.play();
  expect(port.play).toHaveBeenCalledTimes(2);
  second.resolve();
  await flush();
});
it.each(["NotSupportedError", "NotAllowedError"])(
  "still exposes real playback failure %s",
  async (name) => {
    const error = new DOMException("Failed", name);
    const { port, control } = setup(() => Promise.reject(error));
    control.play();
    await flush();
    expect(port.onError).toHaveBeenCalledExactlyOnceWith(error);
  },
);
it("handles element removal even when the player did not emit pause first", async () => {
  const { port, control } = setup(() =>
    Promise.reject(new DOMException("Removed", "AbortError")),
  );
  control.play();
  await flush();
  expect(port.onError).not.toHaveBeenCalled();
});
it("keeps the synchronous native-player contract and reports native errors", () => {
  const { port, control } = setup(() => undefined);
  control.play();
  control.pause();
  control.play();
  expect(port.play).toHaveBeenCalledTimes(2);
  const error = new Error("Native player released");
  port.play.mockImplementation(() => {
    throw error;
  });
  control.play();
  expect(port.onError).toHaveBeenCalledExactlyOnceWith(error);
});
it("allows cleanup after Expo has released the native player, without updating an unmounted screen", () => {
  const { port, control } = setup(() => undefined);
  port.pause.mockImplementation(() => {
    throw new Error("Shared object released");
  });
  expect(() => control.pause({ reportFailure: false })).not.toThrow();
  expect(port.onError).not.toHaveBeenCalled();
});
it("still reports pause failures while the player is active", () => {
  const { port, control } = setup(() => undefined);
  const error = new Error("Native pause failed");
  port.pause.mockImplementation(() => {
    throw error;
  });
  expect(() => control.pause()).not.toThrow();
  expect(port.onError).toHaveBeenCalledExactlyOnceWith(error);
});
it("handles a native playing getter that has become unavailable", () => {
  const { port, control } = setup(() => undefined);
  const error = new Error("Shared object released");
  port.playing.mockImplementation(() => {
    throw error;
  });
  expect(() => control.play()).not.toThrow();
  expect(port.onError).toHaveBeenCalledExactlyOnceWith(error);
});
