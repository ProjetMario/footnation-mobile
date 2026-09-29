import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { scheduleStoryView } from "../src/lib/storyViewRecording";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());
function options() {
  return {
    uid: "viewer",
    owner: "author",
    expiresAt: "2026-09-08T13:00:00Z",
    isCurrent: vi.fn(() => true),
    authenticate: vi.fn(async () => "viewer"),
    record: vi.fn(async () => {}),
    onSuccess: vi.fn(),
    onError: vi.fn(),
  };
}
it("waits one second before recording a loaded active story", async () => {
  const o = options();
  scheduleStoryView(o);
  await vi.advanceTimersByTimeAsync(999);
  expect(o.record).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(o.record).toHaveBeenCalledOnce();
  expect(o.onSuccess).toHaveBeenCalledOnce();
});
it("cancels before the delay when the screen closes", async () => {
  const o = options();
  const cancel = scheduleStoryView(o);
  cancel();
  await vi.advanceTimersByTimeAsync(1000);
  expect(o.authenticate).not.toHaveBeenCalled();
});
it("checks current visibility again when the timer fires", async () => {
  const o = options();
  scheduleStoryView(o);
  o.isCurrent.mockReturnValue(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(o.record).not.toHaveBeenCalled();
  expect(o.authenticate).not.toHaveBeenCalled();
});
it("does not record when cancelled during session verification", async () => {
  const o = options();
  let resolve!: (id: string) => void;
  o.authenticate.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const cancel = scheduleStoryView(o);
  await vi.advanceTimersByTimeAsync(1000);
  cancel();
  resolve("viewer");
  await vi.advanceTimersByTimeAsync(0);
  expect(o.record).not.toHaveBeenCalled();
});
it("rejects a changed session without recording another account", async () => {
  const o = options();
  o.authenticate.mockResolvedValue("other");
  scheduleStoryView(o);
  await vi.advanceTimersByTimeAsync(1000);
  expect(o.record).not.toHaveBeenCalled();
  expect(o.onError).toHaveBeenCalledOnce();
});
it("does not record own, expired, invalid-date or initially invisible stories", async () => {
  for (const patch of [
    { owner: "viewer" },
    { expiresAt: "invalid" },
    { expiresAt: "2026-09-08T11:00:00Z" },
    { isCurrent: () => false },
  ]) {
    const o = { ...options(), ...patch };
    scheduleStoryView(o);
    await vi.advanceTimersByTimeAsync(1000);
    expect(o.record).not.toHaveBeenCalled();
  }
});
it("reports a write failure only while the original screen is current", async () => {
  const o = options();
  o.record.mockRejectedValue(new Error("network"));
  scheduleStoryView(o);
  await vi.advanceTimersByTimeAsync(1000);
  expect(o.onError).toHaveBeenCalledOnce();
  expect(o.onSuccess).not.toHaveBeenCalled();
  const second = options();
  let reject!: (error: Error) => void;
  second.record.mockReturnValue(
    new Promise((_r, r) => {
      reject = r;
    }),
  );
  const cancel = scheduleStoryView(second);
  await vi.advanceTimersByTimeAsync(1000);
  cancel();
  reject(new Error("network"));
  await vi.advanceTimersByTimeAsync(0);
  expect(second.onError).not.toHaveBeenCalled();
});
