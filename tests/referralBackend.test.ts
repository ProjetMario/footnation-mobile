import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  user: vi.fn(),
  from: vi.fn(),
  header: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getSession: m.session, getUser: m.user }, from: m.from },
}));
import { applySignupReferral } from "../src/lib/referralBackend";
beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({
    data: { session: { user: { id: "a" }, access_token: "snapshot-a" } },
    error: null,
  });
  m.user.mockResolvedValue({
    data: { user: { id: "a", user_metadata: { referrer_id: "ABC123" } } },
    error: null,
  });
  const query: any = {};
  for (const method of [
    "select",
    "eq",
    "single",
    "maybeSingle",
    "update",
    "is",
  ])
    query[method] = vi.fn(() => query);
  query.setHeader = m.header;
  m.from.mockReturnValue(query);
  m.header
    .mockResolvedValueOnce({ data: { referred_by: null }, error: null })
    .mockResolvedValueOnce({ data: { id: "referrer" }, error: null })
    .mockResolvedValueOnce({ data: [{ id: "a" }], error: null });
});
it("uses fresh server metadata after social completion and binds all reads/writes to the original account", async () => {
  expect(await applySignupReferral(undefined, "a")).toBe("assigned");
  expect(m.user).toHaveBeenCalledWith("snapshot-a");
  expect(m.header).toHaveBeenCalledTimes(3);
  for (const args of m.header.mock.calls)
    expect(args).toEqual(["Authorization", "Bearer snapshot-a"]);
});
it("rejects an identity mismatch before referral queries", async () => {
  m.user.mockResolvedValue({ data: { user: { id: "b" } }, error: null });
  await expect(applySignupReferral(undefined, "a")).rejects.toThrow("vérifiée");
  expect(m.from).not.toHaveBeenCalled();
});
