import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  requireBackend: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getUser: mocks.getUser }, rpc: mocks.rpc },
  requireBackend: mocks.requireBackend,
}));
import {
  supportDraft,
  supportRpc,
  supportUnavailable,
} from "../src/lib/support";

beforeEach(() => vi.resetAllMocks());
describe("support session boundary", () => {
  it("blocks stale-account reads and mutations before any RPC", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "other" } },
      error: null,
    });
    await expect(supportRpc("owner", "reply_support_request")).rejects.toThrow(
      "session a changé",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("always binds the expected actor and propagates server authorization errors", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "owner" } },
      error: null,
    });
    const denied = { code: "42501", message: "Forbidden" };
    mocks.rpc.mockResolvedValue({ data: null, error: denied });
    await expect(
      supportRpc("owner", "list_support_requests", { p_actor_id: "spoof" }),
    ).rejects.toBe(denied);
    expect(mocks.rpc).toHaveBeenCalledWith("list_support_requests", {
      p_actor_id: "owner",
    });
  });
  it("validates draft bounds and distinguishes unavailable backend from denied access", () => {
    expect(supportDraft(" Sujet ", "account", " Message ")).toEqual({
      subject: "Sujet",
      category: "account",
      message: "Message",
    });
    expect(() => supportDraft("ok", "account", "message")).toThrow();
    expect(() => supportDraft("Sujet", "account", "x".repeat(5001))).toThrow();
    expect(supportUnavailable({ code: "PGRST202" })).toBe(true);
    expect(supportUnavailable({ code: "42501" })).toBe(false);
  });
});
