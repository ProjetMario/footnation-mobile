import { afterEach, expect, it, vi } from "vitest";
import { optionalRpc } from "../src/lib/optionalRpc";

afterEach(() => vi.useRealTimers());

it("backs off a missing function across polls and retries after deployment cooldown", async () => {
  vi.useFakeTimers();
  const missing = { code: "PGRST202" };
  const request = vi
    .fn()
    .mockRejectedValueOnce(missing)
    .mockResolvedValue("ready");
  await expect(optionalRpc("missing-filter", request)).rejects.toBe(missing);
  await expect(optionalRpc("missing-filter", request)).rejects.toMatchObject(
    missing,
  );
  expect(request).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(5 * 60_000);
  await expect(optionalRpc("missing-filter", request)).resolves.toBe("ready");
  expect(request).toHaveBeenCalledTimes(2);
});

it.each(["42501", "PGRST301", "PGRST003", "NETWORK_ERROR"])(
  "propagates %s without disabling the next request",
  async (code) => {
    const failure = { code };
    const request = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(true);
    await expect(optionalRpc(`error-${code}`, request)).rejects.toBe(failure);
    await expect(optionalRpc(`error-${code}`, request)).resolves.toBe(true);
  },
);

it("does not disable unrelated RPCs when one optional feature is absent", async () => {
  await expect(
    optionalRpc("missing-presence", async () => {
      throw { code: "42883" };
    }),
  ).rejects.toMatchObject({ code: "42883" });
  await expect(
    optionalRpc("working-inbox", async () => ["message"]),
  ).resolves.toEqual(["message"]);
});
