import { describe, expect, it } from "vitest";
import {
  createGrowthActivityRecorder,
  growthCount,
  growthPercent,
  parseGrowthSnapshot,
  type GrowthSnapshot,
} from "../src/lib/growthMetrics";

const now = Date.parse("2026-09-10T20:00:00Z");
const tick = (userId = "a", time = now, enabled = true) => ({
  userId,
  now: time,
  enabled,
  platform: "ios" as const,
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
function snapshot(): GrowthSnapshot {
  return {
    version: 1,
    generated_at: "2026-09-10T20:00:00Z",
    measurement_started_at: "2026-09-10T10:00:00Z",
    sources: { posts: true, convocations: false, teams: true, referrals: true },
    metrics: {
      profiles_total: 3,
      signups_7d: 2,
      signups_30d: 3,
      active_7d: 1,
      active_30d: 1,
      posts_7d: 0,
      publishers_7d: 0,
      convocation_replies_7d: null,
      active_teams_7d: 0,
      referred_signups_30d: 1,
      referred_active_7d: 1,
      activation_7d: null,
    },
    daily: [
      { date: "2026-09-09", signups: 1, active: null },
      { date: "2026-09-10", signups: 1, active: 1 },
    ],
    cohorts: [
      {
        week: "2026-09-07",
        signups: 1,
        d7_eligible: 0,
        d7_returned: 0,
        d30_eligible: 0,
        d30_returned: 0,
      },
    ],
  };
}

describe("daily activity recording", () => {
  it("deduplicates concurrent and successful same-day calls, then records a new UTC day", async () => {
    const call = deferred<boolean>();
    const attempts: string[] = [];
    const recorder = createGrowthActivityRecorder(async (id) => {
      attempts.push(id);
      return attempts.length === 1 ? call.promise : true;
    });
    const first = recorder.attempt(tick());
    await recorder.attempt(tick());
    expect(attempts).toEqual(["a"]);
    call.resolve(true);
    await first;
    await recorder.attempt(tick());
    expect(attempts).toHaveLength(1);
    await recorder.attempt(tick("a", Date.parse("2026-09-11T00:00:00Z")));
    expect(attempts).toHaveLength(2);
  });
  it("does not record offline/background and retries transient failure without caching success", async () => {
    let attempts = 0;
    const recorder = createGrowthActivityRecorder(async () => {
      attempts++;
      return attempts > 1;
    });
    await recorder.attempt(tick("a", now, false));
    expect(attempts).toBe(0);
    await recorder.attempt(tick());
    await recorder.attempt(tick("a", now + 59_999));
    expect(attempts).toBe(1);
    await recorder.attempt(tick("a", now + 60_000));
    expect(attempts).toBe(2);
    await recorder.attempt(tick("a", now + 120_000));
    expect(attempts).toBe(2);
  });
  it("does not let stale A completion suppress or clear B recording", async () => {
    const a = deferred<boolean>(),
      b = deferred<boolean>();
    const attempts: string[] = [];
    const recorder = createGrowthActivityRecorder(async (id) => {
      attempts.push(id);
      return id === "a" ? a.promise : b.promise;
    });
    const first = recorder.attempt(tick("a"));
    const second = recorder.attempt(tick("b"));
    a.resolve(true);
    await first;
    await recorder.attempt(tick("b"));
    expect(attempts).toEqual(["a", "b"]);
    b.resolve(true);
    await second;
    await recorder.attempt(tick("b"));
    expect(attempts).toEqual(["a", "b"]);
  });
  it("clears pending identity on logout and absorbs exceptions", async () => {
    const pending = deferred<boolean>();
    let attempts = 0;
    const recorder = createGrowthActivityRecorder(async () => {
      attempts++;
      return attempts === 1 ? pending.promise : true;
    });
    const first = recorder.attempt(tick());
    recorder.reset();
    await recorder.attempt(tick("b"));
    pending.reject(new Error("offline"));
    await first;
    await recorder.attempt(tick("b"));
    expect(attempts).toBe(2);
  });
});

describe("honest metric formatting and contract", () => {
  it("distinguishes no observation from measured zero and preserves null sources", () => {
    expect(growthCount(null)).toBe("Indisponible");
    expect(growthCount(0)).toBe("0");
    expect(growthPercent(0, 0)).toBe("En observation");
    expect(growthPercent(0, 4)).toBe("0 %");
    expect(growthPercent(1, 4)).toBe("25 %");
    expect(growthPercent(5, 4)).toBe("En observation");
    expect(parseGrowthSnapshot(snapshot()).daily[0].active).toBeNull();
  });
  it("rejects missing fields from an incomplete deployment rather than filling zero", () => {
    const data: any = snapshot();
    delete data.metrics.posts_7d;
    expect(() => parseGrowthSnapshot(data)).toThrow(/incomplets/);
    expect(() => parseGrowthSnapshot({ ...snapshot(), version: 2 })).toThrow(
      /incomplets/,
    );
  });
  it("rejects fabricated percentages and impossible cohort denominators", () => {
    const data = snapshot();
    data.cohorts[0].d7_returned = 1;
    expect(() => parseGrowthSnapshot(data)).toThrow(/incomplets/);
    const activation = snapshot();
    activation.metrics.activation_7d = { activated: 4, eligible: 3 };
    expect(() => parseGrowthSnapshot(activation)).toThrow(/incomplets/);
  });
});
