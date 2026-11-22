import type { Post, Profile } from "./models";
import { rankSocialPosts } from "./socialFeedRanking";
export type SocialCursor = {
  snapshot: string;
  before: string;
  beforeId: string;
  previousAuthors: string[];
  displayed: number;
};
type Candidate = { post_id: string; created_at: string };
export function socialFeedMigrationMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return (
    !!e &&
    ["PGRST202", "42883"].includes(e.code || "") &&
    typeof e.message === "string" &&
    /function\s+(?:public\.)?get_social_feed_candidates\b/i.test(e.message)
  );
}
export async function readPersonalizedPosts(options: {
  client: any;
  uid: string;
  profile: Profile | null;
  cursor?: SocialCursor;
  blocked: string[];
  hidden: string[];
  signal: AbortSignal;
}) {
  const { client, uid, profile, cursor, blocked, hidden, signal } = options;
  const session = await client.auth.getSession();
  if (session.error || session.data.session?.user.id !== uid)
    throw new Error("La session a changé. Actualisez le fil.");
  const snapshot = cursor?.snapshot || new Date().toISOString();
  const candidates = await client
    .rpc("get_social_feed_candidates", {
      p_snapshot: snapshot,
      p_before: cursor?.before || null,
      p_before_id: cursor?.beforeId || null,
    })
    .setHeader("Authorization", `Bearer ${session.data.session.access_token}`)
    .abortSignal(signal);
  if (candidates.error) throw candidates.error;
  if (!Array.isArray(candidates.data))
    throw new Error("Le fil est indisponible.");
  const entries = candidates.data as Candidate[];
  if (!entries.length) return { items: [] as Post[], next: undefined };
  const posts = await client
    .from("posts")
    .select(
      "*,author:profiles!posts_user_id_fkey(id,full_name,username,avatar_url,position,club,department,favorite_pro_club,favorite_amateur_club),post_comments(count),post_reactions(id,user_id,reaction_type)",
    )
    .in(
      "id",
      entries.map((row) => row.post_id),
    )
    .abortSignal(signal);
  if (posts.error) throw posts.error;
  const ids = [...new Set((posts.data as Post[]).map((post) => post.user_id))];
  // Only fetch relationships to the current 40 candidates, never the complete
  // graph. No ranking data or profile is sent to OpenAI on a feed request.
  const [follows, connections] = ids.length
    ? await Promise.all([
        client
          .from("profile_followers")
          .select("followed_id")
          .eq("follower_id", uid)
          .in("followed_id", ids)
          .abortSignal(signal),
        client
          .from("connections")
          .select("user_id,connected_user_id")
          .eq("status", "accepted")
          .or(
            `and(user_id.eq.${uid},connected_user_id.in.(${ids.join(",")})),and(connected_user_id.eq.${uid},user_id.in.(${ids.join(",")}))`,
          )
          .abortSignal(signal),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (follows.error || connections.error)
    throw follows.error || connections.error;
  const current = await client.auth.getSession();
  if (current.error || current.data.session?.user.id !== uid)
    throw new Error("La session a changé. Actualisez le fil.");
  const items = rankSocialPosts(
    posts.data,
    {
      viewer: profile?.id === uid ? profile : { id: uid },
      following: follows.data.map(
        (f: { followed_id: string }) => f.followed_id,
      ),
      connections: connections.data.map(
        (c: { user_id: string; connected_user_id: string }) =>
          c.user_id === uid ? c.connected_user_id : c.user_id,
      ),
      blocked,
      hidden,
      now: Date.parse(snapshot),
    },
    cursor?.previousAuthors,
    cursor?.displayed,
  );
  const last = entries.at(-1)!;
  // Progress uses raw candidates, even when every fetched post is now hidden or
  // deleted. Appending another window never reorders already displayed posts.
  const next: SocialCursor | undefined =
    entries.length === 40
      ? {
          snapshot,
          before: last.created_at,
          beforeId: last.post_id,
          previousAuthors: [
            ...(cursor?.previousAuthors || []),
            ...items.map((p) => p.user_id),
          ].slice(-9),
          displayed: (cursor?.displayed || 0) + items.length,
        }
      : undefined;
  return { items, next };
}
