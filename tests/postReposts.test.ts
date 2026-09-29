import { describe, expect, it } from "vitest";
import {
  parseRepostState,
  repostBackendMissing,
  setPostRepost,
  setShortRepost,
} from "../src/lib/postReposts";

function backend() {
  const state = {
    user: "alice",
    reposted: false,
    lostResponse: false,
    error: "",
    requests: [] as {
      name: string;
      args: Record<string, unknown>;
      token: string;
    }[],
  };
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session: { user: { id: state.user }, access_token: "token-alice" },
        },
        error: null,
      }),
    },
    rpc: (name: string, args: Record<string, unknown>) => ({
      setHeader: async (header: string, token: string) => {
        expect(header).toBe("Authorization");
        state.requests.push({ name, args, token });
        if (state.error) return { data: null, error: { code: state.error } };
        state.reposted = args.p_reposted as boolean;
        if (state.lostResponse) {
          state.lostResponse = false;
          return { data: null, error: { code: "network" } };
        }
        return {
          data: [
            { repost_count: state.reposted ? 1 : 0, reposted: state.reposted },
          ],
          error: null,
        };
      },
    }),
  } as unknown as Parameters<typeof setPostRepost>[0];
  return { state, client };
}

describe("repost intents", () => {
  it("routes Shorts to their own backend, with idempotent undo and account binding", async () => {
    const { client, state } = backend();
    expect(await setShortRepost(client, "alice", "short-1", true)).toEqual({
      count: 1,
      reposted: true,
    });
    expect(state.requests[0]).toEqual({
      name: "set_short_repost",
      args: { p_short_id: "short-1", p_reposted: true },
      token: "Bearer token-alice",
    });
    expect(await setShortRepost(client, "alice", "short-1", false)).toEqual({
      count: 0,
      reposted: false,
    });
    state.user = "bob";
    await expect(
      setShortRepost(client, "alice", "short-1", true),
    ).rejects.toThrow("Reconnectez");
    expect(state.requests).toHaveLength(2);
  });
  it("sends a fixed intent bound to the initiating account, without trusting a supplied author", async () => {
    const { client, state } = backend();
    expect(await setPostRepost(client, "alice", "post", true)).toEqual({
      count: 1,
      reposted: true,
    });
    expect(state.requests).toEqual([
      {
        name: "set_post_repost",
        args: { p_post_id: "post", p_reposted: true },
        token: "Bearer token-alice",
      },
    ]);
    expect(await setPostRepost(client, "alice", "post", false)).toEqual({
      count: 0,
      reposted: false,
    });
  });
  it("reconciles a lost response by retrying the same desired value", async () => {
    const { client, state } = backend();
    state.lostResponse = true;
    await expect(setPostRepost(client, "alice", "post", true)).rejects.toThrow(
      "Réessayez",
    );
    expect(state.reposted).toBe(true);
    expect(await setPostRepost(client, "alice", "post", true)).toEqual({
      count: 1,
      reposted: true,
    });
  });
  it("does not mutate under a switched account", async () => {
    const { client, state } = backend();
    state.user = "bob";
    await expect(setPostRepost(client, "alice", "post", true)).rejects.toThrow(
      "Reconnectez",
    );
    expect(state.requests).toEqual([]);
  });
  it("reports a permission denial without claiming success", async () => {
    const { client, state } = backend();
    state.error = "42501";
    await expect(setPostRepost(client, "alice", "post", true)).rejects.toThrow(
      "ne peut pas",
    );
    expect(state.reposted).toBe(false);
  });
  it("distinguishes an undeployed backend from a network or RLS failure", () => {
    expect(repostBackendMissing({ code: "PGRST202" })).toBe(true);
    expect(repostBackendMissing({ code: "42883" })).toBe(true);
    for (const code of ["42501", "PGRST301", "network"])
      expect(repostBackendMissing({ code })).toBe(false);
  });
  it("parses bigint counts and rejects invalid or absent server state", () => {
    expect(
      parseRepostState([{ repost_count: "844", reposted: false }]),
    ).toEqual({ count: 844, reposted: false });
    for (const bad of [
      null,
      [],
      [{}],
      [{ repost_count: -1, reposted: false }],
      [{ repost_count: null, reposted: true }],
      [{ repost_count: 1, reposted: "false" }],
    ])
      expect(() => parseRepostState(bad)).toThrow();
  });
});
