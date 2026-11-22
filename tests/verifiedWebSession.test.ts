import { describe, expect, it, vi } from "vitest";
import { readVerifiedWebSession } from "../src/lib/verifiedWebSession";

const session = (id = "A", token = `token-${id}`) => ({
  access_token: token,
  refresh_token: `refresh-${id}`,
  user: { id, user_metadata: { full_name: "Untrusted local label" } },
});
const result = (value: unknown) => ({ data: { session: value }, error: null });
function auth(value: unknown = session()) {
  return {
    getSession: vi.fn().mockResolvedValue(result(value)),
    getUser: vi.fn().mockResolvedValue({
      data: {
        user: { id: "A", user_metadata: { full_name: "Verified name" } },
      },
      error: null,
    }),
  };
}
describe("web session adoption", () => {
  it("recovers a temporary 504 and still verifies the server identity", async () => {
    vi.useFakeTimers();
    try {
      const client = auth();
      client.getSession.mockResolvedValueOnce({ data: { session: null }, error: { status: 504 } });
      const pending = readVerifiedWebSession(client as any);
      await vi.runAllTimersAsync();
      expect((await pending)?.user.user_metadata.full_name).toBe("Verified name");
      expect(client.getSession).toHaveBeenCalledTimes(3);
      expect(client.getUser).toHaveBeenCalledWith("token-A");
    } finally {
      vi.useRealTimers();
    }
  });
  it("validates the old web token and replaces local identity with the server user", async () => {
    const client = auth();
    const adopted = await readVerifiedWebSession(client as any);
    expect(client.getUser).toHaveBeenCalledWith("token-A");
    expect(adopted?.user.user_metadata.full_name).toBe("Verified name");
  });
  it("does not issue a user lookup when logged out", async () => {
    const client = auth(null);
    expect(await readVerifiedWebSession(client as any)).toBeNull();
    expect(client.getUser).not.toHaveBeenCalled();
  });
  it("rejects a local user id which does not match the verified token identity", async () => {
    const client = auth(session("B"));
    await expect(readVerifiedWebSession(client as any)).rejects.toThrow(
      "vérifiée",
    );
  });
  it("fails closed when the server rejects or cannot verify a legacy session", async () => {
    const client = auth();
    client.getUser.mockResolvedValue({
      data: { user: null },
      error: { status: 401 },
    });
    await expect(readVerifiedWebSession(client as any)).rejects.toThrow(
      "vérifiée",
    );
  });
  it("does not restore the user after a cross-tab sign-out during verification", async () => {
    const client = auth();
    client.getSession
      .mockResolvedValueOnce(result(session()))
      .mockResolvedValueOnce(result(null));
    expect(await readVerifiedWebSession(client as any)).toBeNull();
  });
  it.each([session("B"), session("A", "new-token")])(
    "rejects a superseded session without writing over the current one",
    async (latest) => {
      const client = auth();
      client.getSession
        .mockResolvedValueOnce(result(session()))
        .mockResolvedValueOnce(result(latest));
      await expect(readVerifiedWebSession(client as any)).rejects.toThrow(
        "changé",
      );
    },
  );
});
