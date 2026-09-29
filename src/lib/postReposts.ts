import type { SupabaseClient } from "@supabase/supabase-js";

export type RepostState = { count: number; reposted: boolean };
export type RepostFeedEntry = {
  post_id: string;
  reposted_by: string | null;
  reposted_name: string | null;
  reposted_at: string | null;
};

export function repostBackendMissing(error: { code?: string } | null) {
  return !!error && ["PGRST202", "42883"].includes(error.code || "");
}

export function parseRepostState(data: unknown): RepostState {
  const row = Array.isArray(data) ? data[0] : null;
  const count = Number(row?.repost_count);
  if (
    !row ||
    !["number", "string"].includes(typeof row.repost_count) ||
    row.repost_count === "" ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    typeof row.reposted !== "boolean"
  )
    throw new Error("Impossible de vérifier la republication. Réessayez.");
  return { count, reposted: row.reposted };
}

export function repostError(error: { code?: string } | null) {
  if (repostBackendMissing(error))
    return new Error("La republication attend son activation sur FootNation.");
  if (error?.code === "42501")
    return new Error(
      "Cette publication ne peut pas être republiée avec votre compte.",
    );
  return new Error("Impossible d’enregistrer la republication. Réessayez.");
}

export async function setPostRepost(
  client: Pick<SupabaseClient, "auth" | "rpc">,
  userId: string,
  postId: string,
  reposted: boolean,
) {
  return setRepost(client, userId, "post", postId, reposted);
}

export async function setShortRepost(
  client: Pick<SupabaseClient, "auth" | "rpc">,
  userId: string,
  shortId: string,
  reposted: boolean,
) {
  return setRepost(client, userId, "short", shortId, reposted);
}

async function setRepost(
  client: Pick<SupabaseClient, "auth" | "rpc">,
  userId: string,
  kind: "post" | "short",
  contentId: string,
  reposted: boolean,
) {
  const session = await client.auth.getSession();
  if (session.error || session.data.session?.user.id !== userId)
    throw new Error("Reconnectez-vous pour republier.");
  // Bind this intent to the account which clicked, even during an account switch.
  const result = await client
    .rpc(kind === "short" ? "set_short_repost" : "set_post_repost", {
      [kind === "short" ? "p_short_id" : "p_post_id"]: contentId,
      p_reposted: reposted,
    })
    .setHeader("Authorization", `Bearer ${session.data.session.access_token}`);
  if (result.error) throw repostError(result.error);
  return parseRepostState(result.data);
}
