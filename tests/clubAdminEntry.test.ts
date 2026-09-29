import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({
  supabase: { rpc: client.rpc, auth: { getUser: client.getUser } },
}));
import { loadClubAdminAccess } from "../src/lib/clubAccess";
beforeEach(() => {
  client.rpc.mockReset();
  client.getUser
    .mockReset()
    .mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
});
it("distinguishes a club administrator from staff limited to their team", async () => {
  client.rpc.mockResolvedValueOnce({ data: true, error: null });
  await expect(loadClubAdminAccess("club-a", "owner")).resolves.toEqual({
    clubAdmin: true,
  });
  expect(client.rpc).toHaveBeenCalledTimes(1);
  client.rpc
    .mockResolvedValueOnce({ data: false, error: null })
    .mockResolvedValueOnce({ data: true, error: null });
  await expect(loadClubAdminAccess("club-a", "owner")).resolves.toEqual({
    clubAdmin: false,
  });
  expect(client.rpc).toHaveBeenLastCalledWith("is_native_club_or_team_staff", {
    p_club_id: "club-a",
  });
});
it("refuses to reuse a gate after changing accounts even if the new user is staff", async () => {
  client.getUser.mockResolvedValue({
    data: { user: { id: "other" } },
    error: null,
  });
  client.rpc.mockResolvedValue({ data: true, error: null });
  await expect(loadClubAdminAccess("club-a", "owner")).rejects.toThrow(
    "session a changé",
  );
  expect(client.rpc).not.toHaveBeenCalled();
});
it("does not fall back to staff when authentication is unavailable", async () => {
  client.getUser.mockResolvedValue({
    data: { user: null },
    error: new Error("Session expirée"),
  });
  await expect(loadClubAdminAccess("club-a", "owner")).rejects.toThrow(
    "Session expirée",
  );
  expect(client.rpc).not.toHaveBeenCalled();
});
it.each([false, null, "true"])(
  "denies a user without an explicit staff grant (%s)",
  async (data) => {
    client.rpc
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data, error: null });
    await expect(loadClubAdminAccess("club-a", "owner")).rejects.toThrow(
      "réservé",
    );
  },
);
it("denies a failed staff check", async () => {
  client.rpc
    .mockResolvedValueOnce({ data: false, error: null })
    .mockResolvedValueOnce({ data: true, error: new Error("Indisponible") });
  await expect(loadClubAdminAccess("club-a", "owner")).rejects.toThrow(
    "réservé",
  );
});
