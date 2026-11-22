import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({
  auth: { getSession: vi.fn() },
  functions: { invoke: vi.fn() },
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: client,
  requireBackend: vi.fn(),
}));
import {
  deactivateOwnAccount,
  type DeactivationDuration,
} from "../src/lib/accountDeactivation";
beforeEach(() => {
  vi.clearAllMocks();
  client.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "me" }, access_token: "test-token" } },
  });
  client.functions.invoke.mockResolvedValue({
    data: { deactivatedUntil: "2026-10-09T12:00:00Z" },
    error: null,
  });
});
it.each([7, 30, 180] as const)(
  "uses the existing endpoint for %s days with a pinned session",
  async (duration) => {
    expect(await deactivateOwnAccount("me", duration)).toBe(
      "2026-10-09T12:00:00Z",
    );
    expect(client.functions.invoke).toHaveBeenCalledWith("account/deactivate", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
      body: { durationDays: duration },
    });
  },
);
it("rejects unsupported durations without calling the service", async () => {
  await expect(
    deactivateOwnAccount("me", 0 as DeactivationDuration),
  ).rejects.toThrow("durée");
  expect(client.functions.invoke).not.toHaveBeenCalled();
});
it("never deactivates a different signed-in account", async () => {
  await expect(deactivateOwnAccount("other", 7)).rejects.toThrow("session");
  expect(client.functions.invoke).not.toHaveBeenCalled();
});
it.each([
  { data: null, error: new Error("offline") },
  { data: {}, error: null },
  { data: { deactivatedUntil: "bad date" }, error: null },
])("does not claim success for an unconfirmed response", async (response) => {
  client.functions.invoke.mockResolvedValue(response);
  await expect(deactivateOwnAccount("me", 7)).rejects.toThrow(
    "pas pu être confirmée",
  );
  expect(client.functions.invoke).toHaveBeenCalledTimes(1);
});
