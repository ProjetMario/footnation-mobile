import { supabase } from "./supabase";
export const activityKinds = [
  {
    key: "story-views",
    label: "Vues de stories",
    table: "story_views",
    actor: "viewer_id",
    owner: "stories.user_id",
    target: "story_id",
    parent: ",stories:story_id!inner(user_id)",
    action: "a vu votre story",
    route: "stories",
  },
  {
    key: "followers",
    label: "Abonnements",
    table: "profile_followers",
    actor: "follower_id",
    owner: "followed_id",
    target: "follower_id",
    parent: "",
    action: "a commencé à vous suivre",
    route: "profile",
  },
  {
    key: "reactions",
    label: "Réactions",
    table: "post_reactions",
    actor: "user_id",
    owner: "posts.user_id",
    target: "post_id",
    parent: ",posts:post_id!inner(user_id)",
    action: "a réagi à votre publication",
    route: "posts",
  },
  {
    key: "likes",
    label: "J’aime",
    table: "likes",
    actor: "user_id",
    owner: "posts.user_id",
    target: "post_id",
    parent: ",posts:post_id!inner(user_id)",
    action: "a aimé votre publication",
    route: "posts",
  },
  {
    key: "comments",
    label: "Commentaires",
    table: "post_comments",
    actor: "user_id",
    owner: "posts.user_id",
    target: "post_id",
    parent: ",posts:post_id!inner(user_id)",
    action: "a commenté votre publication",
    route: "posts",
  },
  {
    key: "short-likes",
    label: "J’aime sur les shorts",
    table: "short_likes",
    actor: "user_id",
    owner: "shorts.user_id",
    target: "short_id",
    parent: ",shorts:short_id!inner(user_id)",
    action: "a aimé votre short",
    route: "shorts",
  },
  {
    key: "short-comments",
    label: "Commentaires de shorts",
    table: "short_comments",
    actor: "user_id",
    owner: "shorts.user_id",
    target: "short_id",
    parent: ",shorts:short_id!inner(user_id)",
    action: "a commenté votre short",
    route: "shorts",
  },
] as const;
export type ActivityKind = (typeof activityKinds)[number]["key"];
export type AccountActivity = {
  id: string;
  created_at: string;
  name: string;
  avatar: string | null;
  content: string;
  link: string;
};
export async function loadAccountActivity(
  uid: string,
  kind: ActivityKind,
  offset: number,
): Promise<AccountActivity[]> {
  const config = activityKinds.find((item) => item.key === kind)!;
  const fields =
    [...new Set(["id", "created_at", config.actor, config.target])].join(",") +
    config.parent;
  const result = await supabase
    .from(config.table)
    .select(fields)
    .eq(config.owner, uid)
    .neq(config.actor, uid)
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + 29);
  if (result.error) throw result.error;
  const rows = result.data as unknown as Record<string, string>[];
  if (!rows.length) return [];
  const ids = [
    ...new Set(rows.map((row) => row[config.actor]).filter(Boolean)),
  ];
  const profiles = await supabase
    .from("profiles")
    .select("id,full_name,username,avatar_url")
    .in("id", ids);
  if (profiles.error) throw profiles.error;
  const authors = new Map(
    (profiles.data || []).map((profile) => [profile.id, profile]),
  );
  return rows.map((row) => {
    const actor = authors.get(row[config.actor]);
    const name = actor?.full_name || actor?.username || "Un membre";
    return {
      id: `${kind}:${row.id}`,
      created_at: row.created_at,
      name,
      avatar: actor?.avatar_url || null,
      content: `${name} ${config.action}`,
      link: `/${config.route}/${row[config.target]}`,
    };
  });
}
