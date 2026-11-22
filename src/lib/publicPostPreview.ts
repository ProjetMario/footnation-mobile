import type { SupabaseClient } from "@supabase/supabase-js";
import type { Post, Profile } from "./models";

type PublicPost = Omit<Post, "author"> & { profiles: Profile | null };
type PublicPostPage = {
  posts: PublicPost[];
  hasMore: boolean;
  nextCursor: string | null;
};
type PreviewClient = Pick<SupabaseClient, "functions">;

function normalizePost(post: PublicPost): Post {
  return { ...post, author: post.profiles };
}

export async function readPublicPreviewPost(client: PreviewClient, id: string) {
  const params = new URLSearchParams({ id });
  const { data, error } = await client.functions.invoke<{ post: PublicPost }>(
    `public-post-preview?${params}`,
    { method: "GET" },
  );
  if (error) {
    if (error.context?.status === 404) return null;
    throw error;
  }
  return data?.post ? normalizePost(data.post) : null;
}

export async function readPublicPreviewPosts(
  client: PreviewClient,
  options: {
    authorId?: string;
    media?: "all" | "video";
    before?: string;
    limit?: number;
  } = {},
) {
  const params = new URLSearchParams({
    limit: String(Math.min(20, Math.max(1, options.limit ?? 10))),
  });
  if (options.authorId) params.set("authorId", options.authorId);
  if (options.media === "video") params.set("type", "video");
  if (options.before) params.set("before", options.before);
  const { data, error } = await client.functions.invoke<PublicPostPage>(
    `public-post-preview?${params}`,
    { method: "GET" },
  );
  if (error) throw error;
  if (!data || !Array.isArray(data.posts) || (data.hasMore && !data.nextCursor))
    throw new Error("L’aperçu des publications n’est pas disponible.");
  return {
    items: data.posts.map(normalizePost),
    next: data.hasMore ? data.nextCursor! : undefined,
  };
}
