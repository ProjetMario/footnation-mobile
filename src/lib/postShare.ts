import type { SupabaseClient } from "@supabase/supabase-js";
import { createProContent } from "./proContentSave";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function postShareUrl(postId: string) {
  if (!uuid.test(postId)) throw new Error("Publication invalide.");
  return `https://www.foot-nation.com/posts/${postId}`;
}
export type PostShareMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
};

export function profileShareUrl(profileId: string) {
  if (!uuid.test(profileId)) throw new Error("Profil invalide.");
  return `https://www.foot-nation.com/qr/${profileId}`;
}
export async function sendPostShare(
  client: Pick<SupabaseClient, "auth" | "from">,
  postId: string,
  message: PostShareMessage,
  assertCurrentAccount: () => void,
) {
  return sendContentShare(
    client,
    { kind: "post", id: postId },
    message,
    assertCurrentAccount,
  );
}
export async function sendProfileShare(
  client: Pick<SupabaseClient, "auth" | "from">,
  profileId: string,
  message: PostShareMessage,
  assertCurrentAccount: () => void,
) {
  return sendContentShare(
    client,
    { kind: "profile", id: profileId },
    message,
    assertCurrentAccount,
  );
}
/** A stable message ID lets a retry reconcile an uncertain send, without duplicates. */
async function sendContentShare(
  client: Pick<SupabaseClient, "auth" | "from">,
  target: { kind: "post" | "profile"; id: string },
  message: PostShareMessage,
  assertCurrentAccount: () => void,
) {
  const url =
    target.kind === "post"
      ? postShareUrl(target.id)
      : profileShareUrl(target.id);
  if (
    ![message.id, message.sender_id, message.receiver_id].every((id) =>
      uuid.test(id),
    ) ||
    message.sender_id === message.receiver_id ||
    message.content !== url
  )
    throw new Error("Destinataire invalide.");
  assertCurrentAccount();
  const auth = await client.auth.getSession();
  const session = auth.data.session;
  if (auth.error || session?.user.id !== message.sender_id)
    throw new Error("Reconnectez-vous pour partager ce contenu.");
  const verified = await client.auth.getUser(session.access_token);
  assertCurrentAccount();
  if (verified.error || verified.data.user?.id !== message.sender_id)
    throw new Error("Votre session n’est plus valide. Reconnectez-vous.");
  const authorize = <T extends { setHeader(name: string, value: string): T }>(
    query: T,
  ) => query.setHeader("Authorization", `Bearer ${session.access_token}`);
  await createProContent(
    {
      read: async (id) => {
        const result = await authorize(
          client
            .from("messages")
            .select("id,sender_id,receiver_id,content")
            .eq("id", id)
            .eq("sender_id", message.sender_id)
            .eq("receiver_id", message.receiver_id)
            .maybeSingle(),
        );
        assertCurrentAccount();
        if (result.error)
          throw new Error("Impossible de vérifier l’envoi. Réessayez.");
        return result.data;
      },
      insert: async () => {
        const sender = message.sender_id,
          receiver = message.receiver_id;
        const [relation, peer, blocks, post] = await Promise.all([
          authorize(
            client
              .from("connections")
              .select("id")
              .eq("status", "accepted")
              .or(
                `and(user_id.eq.${sender},connected_user_id.eq.${receiver}),and(user_id.eq.${receiver},connected_user_id.eq.${sender})`,
              )
              .limit(1),
          ),
          authorize(
            client
              .from("profiles")
              .select("id,is_admin,is_suspended,suspended_until")
              .eq("id", receiver)
              .maybeSingle(),
          ),
          authorize(
            client
              .from("user_blocks")
              .select("id")
              .or(
                `and(blocker_id.eq.${sender},blocked_id.eq.${receiver}),and(blocker_id.eq.${receiver},blocked_id.eq.${sender})`,
              )
              .limit(1),
          ),
          authorize(
            client
              .from(target.kind === "post" ? "posts" : "profiles")
              .select(
                target.kind === "post"
                  ? "id"
                  : "id,is_suspended,suspended_until",
              )
              .eq("id", target.id)
              .maybeSingle(),
          ),
        ]);
        assertCurrentAccount();
        if ([relation, peer, blocks, post].some((result) => result.error))
          throw new Error(
            "Impossible de vérifier les droits de partage. Réessayez.",
          );
        if (!post.data) throw new Error("Ce contenu n’est plus disponible.");
        const sharedProfile = post.data as unknown as {
          is_suspended?: boolean;
          suspended_until?: string | null;
        };
        if (
          target.kind === "profile" &&
          sharedProfile.is_suspended &&
          (!sharedProfile.suspended_until ||
            Date.parse(sharedProfile.suspended_until) > Date.now())
        )
          throw new Error("Ce profil n’est plus disponible.");
        if (blocks.data?.length)
          throw new Error("Le partage avec ce contact est bloqué.");
        if (!peer.data || (!relation.data?.length && !peer.data.is_admin))
          throw new Error(
            "Vous devez être en relation avec ce contact pour lui écrire.",
          );
        if (
          peer.data.is_suspended &&
          (!peer.data.suspended_until ||
            Date.parse(peer.data.suspended_until) > Date.now())
        )
          throw new Error("Ce contact n’est pas disponible.");
        const result = await authorize(client.from("messages").insert(message));
        assertCurrentAccount();
        if (result.error)
          throw new Error(
            result.error.code === "42501"
              ? "L’envoi à ce contact n’est plus autorisé."
              : "L’envoi n’a pas pu être confirmé. Réessayez.",
          );
      },
    },
    message,
  );
}
