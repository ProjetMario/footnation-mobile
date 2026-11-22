import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "./models";
import type { VideoFeedCursor } from "./videoFeed";
import { readPublicPreviewPosts } from "./publicPostPreview";
import { isSuspended } from "./validation";
import { getMusicForPublication } from "../data/shortMusicLibrary";
import type { OptimizedVideoFields } from "./videoSource";

export type PublicPreviewVideo = OptimizedVideoFields & {
  id: string;
  user_id: string;
  created_at: string;
  video_url: string;
  thumbnail_url: string | null;
  description: string | null;
  user: Profile | null;
  origin?: "post" | "short";
  music_url?: string | null;
};
export type PublicVideoCursor = VideoFeedCursor & {
  preview?: {
    posts: PublicPreviewVideo[];
    shorts: PublicPreviewVideo[];
    before?: string;
    postsDone: boolean;
    shortsOffset: number;
    shortsDone: boolean;
  };
};
export const publicShortSelection =
  "id,user_id,created_at,video_url,optimized_video_url,optimized_video_source_url,optimized_thumbnail_url,thumbnail_url,description,music,artist,music_url,start_time,duration,goal_timestamps,user:profiles!shorts_user_id_fkey!inner(id,full_name,username,avatar_url,is_private,is_suspended,suspended_until)";

type PreviewClient = Pick<SupabaseClient, "from" | "functions">;
function publicShortRequest(client: Pick<SupabaseClient, "from">) {
  // The inner relation enforces anonymous profile RLS as well as explicit
  // privacy/suspension rules before the database paginates the result.
  return client
    .from("shorts")
    .select(publicShortSelection)
    .or("moderation_hidden.is.null,moderation_hidden.eq.false")
    .not("user.is_private", "is", true)
    .or(
      `is_suspended.is.null,is_suspended.eq.false,suspended_until.lte.${new Date().toISOString()}`,
      { referencedTable: "user" },
    );
}
function visibleShort(row: PublicPreviewVideo) {
  return !!row.user && !row.user.is_private && !isSuspended(row.user);
}
export async function readPublicPreviewShort(
  client: Pick<SupabaseClient, "from">,
  id: string,
) {
  const result = await publicShortRequest(client).eq("id", id).maybeSingle();
  if (result.error) throw result.error;
  const short = result.data as unknown as PublicPreviewVideo | null;
  return short && visibleShort(short) ? short : null;
}

export async function readPublicPreviewVideos(
  client: PreviewClient,
  cursor: PublicVideoCursor,
  authorId?: string,
  limit = 12,
) {
  const state = {
    posts: [] as PublicPreviewVideo[],
    shorts: [] as PublicPreviewVideo[],
    postsDone: false,
    shortsDone: false,
    shortsOffset: 0,
    before: undefined as string | undefined,
    ...cursor.preview,
  };
  // Unconsumed rows stay in the cursor: a source's server cursor is advanced
  // only after fetching its complete page, never reconstructed from timestamps.
  const [posts, shorts] = await Promise.all([
    !state.posts.length && !state.postsDone
      ? readPublicPreviewPosts(client, {
          authorId,
          media: "video",
          before: state.before,
          limit,
        })
      : null,
    !state.shorts.length && !state.shortsDone
      ? (async () => {
          let query = publicShortRequest(client)
            .not("video_url", "is", null)
            .neq("video_url", "")
            .order("created_at", { ascending: false })
            .order("id")
            .range(state.shortsOffset, state.shortsOffset + limit - 1);
          if (authorId) query = query.eq("user_id", authorId);
          const result = await query;
          if (result.error) throw result.error;
          return result.data as unknown as PublicPreviewVideo[];
        })()
      : null,
  ]);
  if (posts) {
    state.posts = posts.items
      .filter((post) => !!post.video_url)
      .map((post) => ({
        id: post.id,
        user_id: post.user_id,
        created_at: post.created_at,
        video_url: post.video_url!,
        optimized_video_url: post.optimized_video_url,
        optimized_video_source_url: post.optimized_video_source_url,
        optimized_thumbnail_url: post.optimized_thumbnail_url,
        thumbnail_url: post.image_url,
        description: post.content,
        user: post.author,
        origin: "post",
        music_url: getMusicForPublication(`post:${post.id}`).audioUrl,
      }));
    state.before = posts.next;
    state.postsDone = !posts.next;
  }
  if (shorts) {
    state.shorts = shorts
      .filter(visibleShort)
      .map((short) => ({ ...short, origin: "short" }));
    state.shortsOffset += shorts.length;
    state.shortsDone = shorts.length < limit;
  }
  const items: PublicPreviewVideo[] = [];
  // Do not drain a source past an unknown next page; refill on the next request
  // to keep the global chronology and every opaque post cursor intact.
  while (items.length < limit && (state.posts.length || state.shorts.length)) {
    if (
      (!state.posts.length && !state.postsDone) ||
      (!state.shorts.length && !state.shortsDone)
    )
      break;
    const post = state.posts[0],
      short = state.shorts[0];
    const takePost =
      post &&
      (!short || Date.parse(post.created_at) >= Date.parse(short.created_at));
    const source = takePost ? state.posts : state.shorts;
    items.push(source[0]);
    if (takePost) state.posts = state.posts.slice(1);
    else state.shorts = state.shorts.slice(1);
  }
  return {
    items,
    next:
      state.posts.length ||
      state.shorts.length ||
      !state.postsDone ||
      !state.shortsDone
        ? { ...cursor, preview: state }
        : undefined,
  };
}
