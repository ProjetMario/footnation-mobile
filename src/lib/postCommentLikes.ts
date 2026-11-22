import type { SupabaseClient } from "@supabase/supabase-js";
import { optionalRpc } from "./optionalRpc";

export type PostCommentLike = { count: number; liked: boolean };

// Only comments returned by the server are exposed. A missing row may mean
// that the comment is no longer visible to the current account.
export async function readPostCommentLikes(
  client: Pick<SupabaseClient, "rpc">,
  commentIds: string[],
  accessToken: string,
): Promise<Record<string, PostCommentLike>> {
  const ids = [...new Set(commentIds)];
  const result: Record<string, PostCommentLike> = {};
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const response = await optionalRpc("read_post_comment_likes", async () => {
      const { data, error } = await client
        .rpc("read_post_comment_likes", {
          p_comment_ids: batch,
        })
        .setHeader("Authorization", `Bearer ${accessToken}`);
      if (error) throw error;
      return data as unknown;
    });
    if (!Array.isArray(response)) throw new Error("Invalid comment reactions");
    for (const row of response) {
      const count = Number(row?.likes_count);
      if (
        !row ||
        typeof row.comment_id !== "string" ||
        !batch.includes(row.comment_id) ||
        Object.prototype.hasOwnProperty.call(result, row.comment_id) ||
        (typeof row.likes_count !== "number" &&
          (typeof row.likes_count !== "string" || !row.likes_count.trim())) ||
        !Number.isSafeInteger(count) ||
        count < 0 ||
        typeof row.liked !== "boolean"
      )
        throw new Error("Invalid comment reactions");
      result[row.comment_id] = { count, liked: row.liked };
    }
  }
  return result;
}

export async function setPostCommentLike(
  client: Pick<SupabaseClient, "rpc">,
  commentId: string,
  liked: boolean,
  accessToken: string,
): Promise<void> {
  await optionalRpc("set_post_comment_like", async () => {
    const { data, error } = await client
      .rpc("set_post_comment_like", {
        p_comment_id: commentId,
        p_liked: liked,
      })
      .setHeader("Authorization", `Bearer ${accessToken}`);
    if (error) throw error;
    if (data !== liked) throw new Error("Invalid comment reaction result");
  });
}
