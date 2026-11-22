import { describe, expect, it, vi } from "vitest";
import { recoverAuthRead } from "../src/lib/authServiceRecovery";
describe("temporary auth service failures", () => {
  it("recovers a 504 by re-reading through the SDK", async () => {
    const read = vi.fn().mockResolvedValueOnce({ error: { status: 504 } }).mockResolvedValueOnce({ data: "verified", error: null });
    const pause = vi.fn().mockResolvedValue(undefined);
    expect(await recoverAuthRead(read, pause)).toEqual({ data: "verified", error: null });
    expect(read).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledTimes(1);
  });
  it("stops after one retry and never turns an unavailable service into a session", async () => {
    const read = vi.fn().mockResolvedValue({ error: new Error("HTTP 504") });
    await expect(recoverAuthRead(read, async () => {})).rejects.toThrow("serveur de connexion");
    expect(read).toHaveBeenCalledTimes(2);
  });
  it.each([400, 401, 403, 409])("does not retry authentication rejection %s", async status => {
    const response = { error: { status } };
    const read = vi.fn().mockResolvedValue(response);
    expect(await recoverAuthRead(read, async () => {})).toBe(response);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("also recovers a thrown gateway error", async () => {
    const read = vi.fn().mockRejectedValueOnce(Object.assign(new Error("unavailable"), { status: 503 })).mockResolvedValueOnce({ error: null });
    expect(await recoverAuthRead(read, async () => {})).toEqual({ error: null });
  });
});
