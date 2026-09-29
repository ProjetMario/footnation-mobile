import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  unregister: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getUser: mocks.getUser, signOut: mocks.signOut } },
}));
vi.mock("../src/lib/pushDevice", () => ({
  unregisterPushDevice: mocks.unregister,
}));
import { signOutCurrentDevice } from "../src/lib/logout";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "owner" } },
    error: null,
  });
  mocks.unregister.mockResolvedValue(undefined);
  mocks.signOut.mockResolvedValue({ error: null });
});

it("révoque l’appareil avant de fermer la session", async () => {
  const calls: string[] = [];
  mocks.unregister.mockImplementation(async () => {
    calls.push("unregister");
  });
  mocks.signOut.mockImplementation(async () => {
    calls.push("signout");
    return { error: null };
  });
  await signOutCurrentDevice("owner");
  expect(calls).toEqual(["unregister", "signout"]);
  expect(mocks.getUser).toHaveBeenCalledTimes(2);
});

it("conserve la session lorsque la révocation doit être reprise", async () => {
  mocks.unregister.mockRejectedValueOnce(new Error("Réseau"));
  await expect(signOutCurrentDevice("owner")).rejects.toThrow("Réseau");
  expect(mocks.signOut).not.toHaveBeenCalled();
});

it("refuse de fermer une autre session avant ou après la révocation", async () => {
  mocks.getUser.mockResolvedValueOnce({
    data: { user: { id: "other" } },
    error: null,
  });
  await expect(signOutCurrentDevice("owner")).rejects.toThrow("session");
  expect(mocks.unregister).not.toHaveBeenCalled();

  mocks.getUser
    .mockResolvedValueOnce({ data: { user: { id: "owner" } }, error: null })
    .mockResolvedValueOnce({ data: { user: { id: "other" } }, error: null });
  await expect(signOutCurrentDevice("owner")).rejects.toThrow("session");
  expect(mocks.unregister).toHaveBeenCalledTimes(1);
  expect(mocks.signOut).not.toHaveBeenCalled();
});
