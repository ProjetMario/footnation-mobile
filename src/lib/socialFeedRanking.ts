import type { Post, Profile } from "./models";
export const SOCIAL_FEED_POLICY = "balanced-v1";
export type FeedContext = {
  viewer: Pick<
    Profile,
    | "id"
    | "club"
    | "department"
    | "position"
    | "favorite_pro_club"
    | "favorite_amateur_club"
  >;
  following: readonly string[];
  connections: readonly string[];
  blocked: readonly string[];
  hidden: readonly string[];
  now: number;
};
const normalize = (v: string | null | undefined) =>
  (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const equal = (a: string | null | undefined, b: string | null | undefined) =>
  !!normalize(a) && normalize(a) === normalize(b);
const department = (v: string | null | undefined) =>
  normalize(v).match(/^(\d{2,3}|2a|2b)(?: |$)/)?.[1] || normalize(v);
const topicMention = (text: string, topic: string | null | undefined) =>
  !!topic &&
  normalize(topic).length >= 3 &&
  ` ${normalize(text)} `.includes(` ${normalize(topic)} `);
export function scoreSocialPost(post: Post, context: FeedContext) {
  const time = Date.parse(post.created_at);
  const age = Number.isFinite(time)
    ? Math.max(0, context.now - time) / 3600000
    : 87600;
  const me = context.viewer;
  const network =
    context.connections.includes(post.user_id) ||
    context.following.includes(post.user_id);
  const own = post.user_id === me.id;
  const fresh = 35 * Math.exp(-age / 48);
  const relationship =
    (network ? 28 : own ? 30 * Math.exp(-age / 6) : 0) * Math.exp(-age / 168);
  const text = `${post.content || ""} ${(post.hashtags || []).join(" ")}`;
  const sameClub = equal(me.club, post.author?.club);
  const favorite = [me.favorite_pro_club, me.favorite_amateur_club].some(
    (club) =>
      !!club &&
      (topicMention(text, club) ||
        equal(post.author?.club, club) ||
        equal(post.author?.favorite_pro_club, club) ||
        equal(post.author?.favorite_amateur_club, club)),
  );
  const samePosition = equal(me.position, post.author?.position);
  const interest = Math.min(
    20,
    (sameClub ? 12 : 0) + (favorite ? 12 : 0) + (samePosition ? 5 : 0),
  );
  const nearby =
    !!department(me.department) &&
    department(me.department) === department(post.author?.department);
  // Bounded engagement avoids allowing a popular account or comment spam to
  // outweigh freshness and relevance. Media type and text length earn no bonus.
  const reactions = new Set(
    (post.post_reactions || [])
      .filter((r) => r.user_id !== post.user_id)
      .map((r) => r.user_id),
  ).size;
  const comments = Math.max(
    0,
    Math.min(10, Number(post.post_comments?.[0]?.count) || 0),
  );
  const engagement =
    Math.min(7, Math.log1p(reactions + comments) * 2) * Math.exp(-age / 72);
  const score = fresh + relationship + interest + (nearby ? 8 : 0) + engagement;
  const reason = own
    ? "Votre publication"
    : network
      ? "Dans votre réseau"
      : sameClub
        ? "Votre club"
        : favorite
          ? "Vos intérêts football"
          : nearby
            ? "Près de chez vous"
            : samePosition
              ? "Un poste en commun"
              : "À découvrir";
  return { score, reason, discovery: !network && !own && age <= 168, age };
}
export function rankSocialPosts(
  posts: readonly Post[],
  context: FeedContext,
  previousAuthors: readonly string[] = [],
  startIndex = 0,
): Post[] {
  const seen = new Set<string>();
  const remaining = posts
    .filter((post) => {
      if (
        seen.has(post.id) ||
        context.hidden.includes(post.id) ||
        context.blocked.includes(post.user_id) ||
        !post.author
      )
        return false;
      seen.add(post.id);
      return true;
    })
    .map((post) => ({ post, ...scoreSocialPost(post, context) }));
  const result: Post[] = [];
  const authors = [...previousAuthors.slice(-9)];
  while (remaining.length) {
    // Try one discovery at positions 3, 8, 13… when a recent candidate exists.
    // Never duplicate or drop posts to force a quota on a sparse feed.
    const discover = (startIndex + result.length) % 5 === 2;
    let pool = remaining;
    const diverse = pool.filter(
      (row) =>
        authors.slice(-2).every((author) => author !== row.post.user_id) &&
        authors.slice(-9).filter((author) => author === row.post.user_id)
          .length < 2,
    );
    if (diverse.length) pool = diverse;
    if (discover && pool.some((row) => row.discovery))
      pool = pool.filter((row) => row.discovery);
    pool.sort(
      (a, b) =>
        b.score - a.score ||
        (Date.parse(b.post.created_at) || 0) -
          (Date.parse(a.post.created_at) || 0) ||
        a.post.id.localeCompare(b.post.id),
    );
    const chosen = pool[0];
    result.push({ ...chosen.post, feedRecommendation: chosen.reason });
    authors.push(chosen.post.user_id);
    remaining.splice(remaining.indexOf(chosen), 1);
  }
  return result;
}
