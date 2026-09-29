import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, getUser } = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({
  supabase: { rpc, auth: { getUser } },
}));
import { requireClubAdmin } from "../src/lib/clubAccess";
describe("club administration authorization", () => {
  beforeEach(() => {
    rpc.mockReset();
    getUser.mockReset();
  });
  it("checks the requested club with the server", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await expect(requireClubAdmin("club-a")).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("is_club_admin", { p_club_id: "club-a" });
  });
  it.each([false, null, undefined, "true", {}])(
    "denies a non-boolean grant: %s",
    async (data) => {
      rpc.mockResolvedValue({ data, error: null });
      await expect(requireClubAdmin("club-a")).rejects.toThrow("réservé");
    },
  );
  it("fails closed on a backend error even with a cached-looking grant", async () => {
    const error = new Error("Permission check unavailable");
    rpc.mockResolvedValue({ data: true, error });
    await expect(requireClubAdmin("club-a")).rejects.toBe(error);
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
