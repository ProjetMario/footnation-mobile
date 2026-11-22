import { afterEach, describe, expect, it, vi } from "vitest";
import { createScoreboardRequests } from "../src/lib/scoreboardRequests";

afterEach(() => vi.useRealTimers());

describe("public scoreboard request sharing", () => {
  it("deduplicates readers while allowing one to leave without cancelling the other", async () => {
    let finish!: (value: string) => void;
    let transport!: AbortSignal;
    const load = vi.fn((_key: string, signal: AbortSignal) => {
      transport = signal;
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    });
    const requests = createScoreboardRequests(load);
    const first = new AbortController(),
      second = new AbortController();
    const a = requests.get("same-day", first.signal);
    const b = requests.get("same-day", second.signal);
    const cancelled = expect(a).rejects.toMatchObject({ name: "AbortError" });
    first.abort();
    await cancelled;
    expect(transport.aborted).toBe(false);
    finish("real scores");
    await expect(b).resolves.toBe("real scores");
    await expect(requests.get("same-day")).resolves.toBe("real scores");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("aborts when the last reader leaves, including queued requests", async () => {
    const signals: AbortSignal[] = [];
    const load = vi.fn(
      (_key: string, signal: AbortSignal) =>
        new Promise<string>((_, reject) => {
          signals.push(signal);
          signal.addEventListener(
            "abort",
            () => reject(new Error("cancelled")),
            { once: true },
          );
        }),
    );
    const requests = createScoreboardRequests(load, { concurrency: 1 });
    const a = new AbortController(),
      b = new AbortController();
    const first = requests.get("active", a.signal),
      queued = requests.get("queued", b.signal);
    const assertion = Promise.all([
      expect(first).rejects.toMatchObject({ name: "AbortError" }),
      expect(queued).rejects.toMatchObject({ name: "AbortError" }),
    ]);
    b.abort();
    a.abort();
    await assertion;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(signals[0].aborted).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("bounds concurrency across sections, expires scores and never caches errors", async () => {
    vi.useFakeTimers();
    let active = 0,
      peak = 0;
    const load = vi.fn(async (key: string) => {
      active++;
      peak = Math.max(active, peak);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      if (key === "failed") throw new Error("offline");
      return key;
    });
    const requests = createScoreboardRequests(load, {
      concurrency: 2,
      ttl: 100,
      capacity: 3,
    });
    const result = Promise.all(
      ["a", "b", "a", "c"].map((key) => requests.get(key)),
    );
    await vi.advanceTimersByTimeAsync(25);
    expect(await result).toEqual(["a", "b", "a", "c"]);
    expect(peak).toBe(2);
    expect(load).toHaveBeenCalledTimes(3);
    await expect(requests.get("c")).resolves.toBe("c");
    await vi.advanceTimersByTimeAsync(100);
    const refreshed = requests.get("c");
    await vi.advanceTimersByTimeAsync(10);
    await refreshed;
    expect(load).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 2; i++) {
      const failed = expect(requests.get("failed")).rejects.toThrow("offline");
      await vi.advanceTimersByTimeAsync(10);
      await failed;
    }
    expect(load).toHaveBeenCalledTimes(6);
  });
});
