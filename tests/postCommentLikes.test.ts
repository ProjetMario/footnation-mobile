import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  readPostCommentLikes,
  setPostCommentLike,
} from "../src/lib/postCommentLikes";

function clientWith(
  handler: (name: string, params: Record<string, unknown>) => unknown,
) {
  const headers: [string, string][] = [];
  const rpc = vi.fn((name: string, params: Record<string, unknown>) => ({
    setHeader: (name: string, value: string) => {
      headers.push([name, value]);
      return Promise.resolve(handler(name, params));
    },
  }));
  return {
    client: { rpc } as unknown as Pick<SupabaseClient, "rpc">,
    rpc,
    headers,
  };
}

describe("post comment reactions", () => {
  it("batches unique comments, validates counts and binds requests to the session", async () => {
    const fixture = clientWith((_name, params) => ({
      data: (params.p_comment_ids as string[]).map((id, index) => ({
        comment_id: id,
        likes_count: String(index),
        liked: index === 0,
      })),
      error: null,
    }));
    const ids = Array.from({ length: 103 }, (_, index) => `comment-${index}`);
    const result = await readPostCommentLikes(
      fixture.client,
      [...ids, ids[0]],
      "session-token",
    );
    expect(fixture.rpc).toHaveBeenCalledTimes(2);
    expect(fixture.rpc.mock.calls[0][1].p_comment_ids).toHaveLength(100);
    expect(fixture.rpc.mock.calls[1][1].p_comment_ids).toHaveLength(3);
    expect(result[ids[0]]).toEqual({ count: 0, liked: true });
    expect(result[ids[102]]).toEqual({ count: 2, liked: false });
    expect(fixture.headers).toEqual([
      ["Authorization", "Bearer session-token"],
      ["Authorization", "Bearer session-token"],
    ]);
  });

  it("does not invent a count for a comment the server omitted", async () => {
    const fixture = clientWith(() => ({ data: [], error: null }));
    expect(
      await readPostCommentLikes(fixture.client, ["hidden"], "token"),
    ).toEqual({});
    expect(await readPostCommentLikes(fixture.client, [], "token")).toEqual({});
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    [{ comment_id: "unrequested", likes_count: 0, liked: false }],
    [{ comment_id: "comment", likes_count: null, liked: false }],
    [{ comment_id: "comment", likes_count: -1, liked: false }],
    [{ comment_id: "comment", likes_count: 0, liked: "false" }],
    [
      { comment_id: "comment", likes_count: 0, liked: false },
      { comment_id: "comment", likes_count: 0, liked: false },
    ],
  ])("rejects an invalid server response", async (data) => {
    const fixture = clientWith(() => ({ data, error: null }));
    await expect(
      readPostCommentLikes(fixture.client, ["comment"], "token"),
    ).rejects.toThrow("Invalid comment reactions");
  });

  it("writes the desired state without pretending an error or mismatched response succeeded", async () => {
    const fixture = clientWith((_name, params) => ({
      data: params.p_liked,
      error: null,
    }));
    await setPostCommentLike(fixture.client, "comment", true, "token");
    await setPostCommentLike(fixture.client, "comment", false, "token");
    expect(fixture.rpc).toHaveBeenNthCalledWith(1, "set_post_comment_like", {
      p_comment_id: "comment",
      p_liked: true,
    });
    const failure = clientWith(() => ({
      data: null,
      error: { code: "42501", message: "denied" },
    }));
    await expect(
      setPostCommentLike(failure.client, "comment", true, "token"),
    ).rejects.toMatchObject({ code: "42501" });
    const invalid = clientWith(() => ({ data: false, error: null }));
    await expect(
      setPostCommentLike(invalid.client, "comment", true, "token"),
    ).rejects.toThrow("Invalid comment reaction result");
  });
});
