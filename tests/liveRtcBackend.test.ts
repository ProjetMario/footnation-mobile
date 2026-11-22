import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSession: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: fake.createClient }));
vi.mock("../src/lib/supabase", () => ({
  requireBackend: vi.fn(),
  supabase: { auth: { getSession: fake.getSession } },
}));
import {
  createLiveRtcBackend,
  liveRtcBackendForClient,
} from "../src/lib/liveRtcBackend";
const client = {
  rpc: (...args: unknown[]) => ({
    abortSignal: (signal: AbortSignal) => fake.rpc(...args),
  }),
  functions: { invoke: fake.invoke },
} as any;
beforeEach(() => {
  vi.resetAllMocks();
  fake.getSession.mockResolvedValue({
    error: null,
    data: { session: { user: { id: "owner" }, access_token: "token-a" } },
  });
  fake.createClient.mockReturnValue(client);
  fake.rpc.mockResolvedValue({ data: { id: "stream" }, error: null });
});
describe("live RPC adapter", () => {
  it("derives identity from the authenticated session and sends only allowed creation fields", async () => {
    const backend = await createLiveRtcBackend("owner");
    await backend.start({ id: "stream", title: "Mon live", clubId: "club" });
    expect(fake.rpc).toHaveBeenCalledWith("start_live_stream", {
      p_stream_id: "stream",
      p_title: "Mon live",
      p_club_id: "club",
      p_match_id: null,
      p_home_team: null,
      p_away_team: null,
    });
    const options = fake.createClient.mock.calls[0][2];
    expect(options.auth.persistSession).toBe(false);
    expect(await options.accessToken()).toBe("token-a");
    fake.getSession.mockResolvedValue({
      error: null,
      data: {
        session: { user: { id: "owner" }, access_token: "token-refreshed" },
      },
    });
    expect(await options.accessToken()).toBe("token-refreshed");
    fake.getSession.mockResolvedValue({
      error: null,
      data: { session: { user: { id: "other" }, access_token: "token-other" } },
    });
    await expect(options.accessToken()).rejects.toThrow("session a changé");
  });
  it("rejects a changed initial account before constructing a client", async () => {
    await expect(createLiveRtcBackend("other")).rejects.toThrow(
      "session a changé",
    );
    expect(fake.createClient).not.toHaveBeenCalled();
  });
  it("omits p_answer for heartbeat and leave, preserving SQL-null semantics", async () => {
    const backend = liveRtcBackendForClient(client);
    await backend.respond("peer", "heartbeat");
    await backend.respond("peer", "leave");
    expect(fake.rpc).toHaveBeenNthCalledWith(1, "respond_live_stream_peer", {
      p_peer_id: "peer",
      p_action: "heartbeat",
    });
    expect(fake.rpc).toHaveBeenNthCalledWith(2, "respond_live_stream_peer", {
      p_peer_id: "peer",
      p_action: "leave",
    });
  });
  it("preserves only the specific profile prerequisite as an actionable code", async () => {
    const backend = liveRtcBackendForClient(client);
    for (const error of [
      {
        code: "23503",
        message: "foreign key live_streams_broadcaster_id_fkey",
      },
      { code: "42501", message: "Complétez votre profil pour lancer un live." },
    ]) {
      fake.rpc.mockResolvedValue({ data: null, error });
      await expect(
        backend.start({ id: "stream", title: "Mon live" }),
      ).rejects.toMatchObject({ code: "PROFILE_REQUIRED" });
    }
    fake.rpc.mockResolvedValue({
      data: null,
      error: { code: "23503", message: "unrelated foreign key" },
    });
    await expect(
      backend.start({ id: "stream", title: "Mon live" }),
    ).rejects.not.toHaveProperty("code");
  });
  it("explains the server's French capacity message and hides raw database errors", async () => {
    const backend = liveRtcBackendForClient(client);
    fake.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message:
          "Ce live accueille déjà huit spectateurs. Réessayez dans un instant.",
      },
    });
    await expect(
      backend.join("stream", "peer", { type: "offer", sdp: "test" }),
    ).rejects.toThrow("8 spectateurs");
    fake.rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "private SQL trace" },
    });
    await expect(backend.manage("stream", "end")).rejects.not.toThrow(
      "private SQL",
    );
  });
  it("requests ephemeral relay configuration for the selected stream only", async () => {
    const backend = liveRtcBackendForClient(client);
    fake.invoke.mockResolvedValue({
      data: {
        iceServers: [
          {
            urls: "turns:relay.test",
            username: "ephemeral",
            credential: "test",
          },
        ],
      },
      error: null,
    });
    expect(await backend.ice("stream")).toHaveLength(1);
    expect(fake.invoke).toHaveBeenCalledWith("live-ice-config", {
      body: { streamId: "stream" },
      signal: expect.any(AbortSignal),
    });
    fake.invoke.mockResolvedValue({ data: {}, error: null });
    await expect(backend.ice("stream")).rejects.toThrow("relais");
  });
  it("bounds an unresponsive end request so the user can retry confirmation", async () => {
    vi.useFakeTimers();
    try {
      fake.rpc.mockImplementation(() => new Promise(() => {}));
      const backend = liveRtcBackendForClient(client);
      const rejection = expect(backend.manage("stream", "end")).rejects.toThrow(
        "serveur ne répond pas",
      );
      await vi.advanceTimersByTimeAsync(15_000);
      await rejection;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
