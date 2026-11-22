import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({
  supabase: { rpc, auth: { getUser } },
}));
import { loadClubAdminAccess, loadClubAdminStatus, requireClubAdmin } from "../src/lib/clubAccess";
beforeEach(() => {
    rpc.mockReset();
    getUser.mockReset();
  });
describe("club administration authorization", () => {
  it("checks the requested club with the server", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(requireClubAdmin("club-a")).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("can_manage_native_calendar_event", { p_club_id: "club-a", p_team_id: null });
  });
  it.each([false, null, undefined, "true", {}])(
    "denies a non-boolean grant: %s",
    async (data) => {
      rpc.mockResolvedValue({ data, error: null });
      await expect(requireClubAdmin("club-a")).rejects.toThrow();
    },
  );
  it("fails closed on a backend error even with a cached-looking grant", async () => {
    const error = new Error("Permission check unavailable");
    rpc.mockResolvedValue({ data: true, error });
    await expect(requireClubAdmin("club-a")).rejects.toBe(error);
  });
  it("distinguishes a confirmed non-admin from a failed check for the club CTA", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "member" } }, error: null });
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(loadClubAdminStatus("club-a", "member")).resolves.toBe(false);
    rpc.mockResolvedValue({ data: null, error: new Error("Unavailable") });
    await expect(loadClubAdminStatus("club-a", "member")).rejects.toThrow("Unavailable");
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(loadClubAdminStatus("club-a", "member")).resolves.toBe(true);
  });
});

describe("club administration entry", () => {
  const user = { data: { user: { id: "coach" } }, error: null };
  beforeEach(() => getUser.mockResolvedValue(user));
  it("recognizes an explicit club admin without a team fallback", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(loadClubAdminAccess("club-a", "coach")).resolves.toEqual({ clubAdmin: true });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("grants an approved coach only the coach entry", async () => {
    rpc.mockImplementation(async (name) => name === "can_manage_native_calendar_event"
      ? { data: false, error: null }
      : { data: [{ id: "team-a", is_active: true }], error: null });
    await expect(loadClubAdminAccess("club-a", "coach")).resolves.toEqual({ clubAdmin: false });
    expect(rpc).toHaveBeenCalledWith("get_native_calendar_editor_teams", { p_club_id: "club-a" });
  });
  it.each([[], [{ id: "team-a", is_active: false }], null])("denies rejected, removed or inactive assignments", async (data) => {
    rpc.mockImplementation(async (name) => name === "can_manage_native_calendar_event"
      ? { data: false, error: null } : { data, error: null });
    await expect(loadClubAdminAccess("club-a", "coach")).rejects.toThrow("réservé");
  });
  it("does not fall back after an authorization error", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("authorization unavailable") });
    await expect(loadClubAdminAccess("club-a", "coach")).rejects.toThrow("authorization unavailable");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("fails closed when the account expires or changes during permission checks", async () => {
    getUser.mockResolvedValueOnce(user).mockResolvedValueOnce({ data: { user: null }, error: new Error("expired") });
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(loadClubAdminAccess("club-a", "coach")).rejects.toThrow("expired");
  });
  it("rejects a different account after an asynchronous permission check", async () => {
    getUser.mockResolvedValueOnce(user).mockResolvedValueOnce({ data: { user: { id: "other" } }, error: null });
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(loadClubAdminAccess("club-a", "coach")).rejects.toThrow("session a changé");
  });
});

it("requires the original verified account before checking club authority", async () => {
  getUser.mockResolvedValue({
    data: { user: { id: "original" } },
    error: null,
  });
  rpc.mockResolvedValue({ data: true, error: null });
  await expect(requireClubAdmin("club-a", "original")).resolves.toBeUndefined();
  expect(getUser).toHaveBeenCalledOnce();
});
it("does not check club authority after an account change or failed identity check", async () => {
  rpc.mockClear();
  getUser.mockResolvedValue({ data: { user: { id: "other" } }, error: null });
  await expect(requireClubAdmin("club-a", "original")).rejects.toThrow(
    "session a changé",
  );
  expect(rpc).not.toHaveBeenCalled();
  getUser.mockResolvedValue({
    data: { user: null },
    error: new Error("Identity unavailable"),
  });
  await expect(requireClubAdmin("club-a", "original")).rejects.toThrow(
    "Identity unavailable",
  );
  expect(rpc).not.toHaveBeenCalled();
});
