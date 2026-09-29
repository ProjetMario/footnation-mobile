import type { SupabaseClient } from "@supabase/supabase-js";
import {
  commentTextRejected,
  COMMENT_MODERATION_MESSAGE,
  isCommentModerationError,
} from "./commentModeration";

export type CommentRecovery = "login" | "profile" | "retry";
export class PostCommentError extends Error {
  constructor(
    message: string,
    public readonly recovery: CommentRecovery = "retry",
  ) {
    super(message);
    this.name = "PostCommentError";
  }
}
const profileRequired = () =>
  new PostCommentError(
    "Enregistrez votre profil pour commenter. Votre texte est conservé.",
    "profile",
  );
const sessionRequired = () =>
  new PostCommentError(
    "Reconnectez-vous pour commenter. Votre texte est conservé.",
    "login",
  );

export async function publishPostComment(
  client: Pick<SupabaseClient, "auth" | "from">,
  input: { postId: string; userId?: string; content: string },
) {
  const content = input.content.trim();
  if (!input.postId || !content || content.length > 3000)
    throw new PostCommentError(
      "Écrivez un commentaire de 1 à 3 000 caractères.",
    );
  if (commentTextRejected(content))
    throw new PostCommentError(COMMENT_MODERATION_MESSAGE);
  const authorization = await verifiedCommentAuthorization(
    client,
    input.userId,
  );
  const profile = await client
    .from("profiles")
    .select("id")
    .eq("id", input.userId)
    .maybeSingle()
    .setHeader("Authorization", authorization);
  if (profile.error)
    throw new PostCommentError(
      "Impossible de vérifier votre profil. Votre texte est conservé, réessayez.",
    );
  if (!profile.data) throw profileRequired();

  const result = await client
    .from("post_comments")
    .insert({ post_id: input.postId, user_id: input.userId, content })
    .setHeader("Authorization", authorization);
  if (!result.error) return;
  const { code, message } = result.error;
  // Handle deletion between the profile check and the insert as well.
  if (code === "23503" && message.includes("post_comments_user_id_fkey"))
    throw profileRequired();
  if (code === "23503" && message.includes("post_comments_post_id_fkey"))
    throw new PostCommentError(
      "Cette publication n’est plus disponible. Votre texte est conservé.",
    );
  if (isCommentModerationError(result.error))
    throw new PostCommentError(COMMENT_MODERATION_MESSAGE);
  if (code === "42501")
    throw new PostCommentError(
      "Votre compte ne peut pas commenter cette publication. Votre texte est conservé.",
    );
  throw new PostCommentError(
    "Le commentaire n’a pas été envoyé. Votre texte est conservé, réessayez.",
  );
}

async function verifiedCommentAuthorization(
  client: Pick<SupabaseClient, "auth">,
  userId?: string,
) {
  const auth = await client.auth.getSession();
  const session = auth.data.session;
  if (auth.error || !userId || session?.user.id !== userId)
    throw sessionRequired();
  // A locally stored session can outlive its deleted/revoked account.
  const verified = await client.auth.getUser(session.access_token);
  if (verified.error) {
    if (
      verified.error.status === 401 ||
      verified.error.status === 403 ||
      verified.error.code === "user_not_found"
    )
      throw sessionRequired();
    throw new PostCommentError(
      "Impossible de vérifier votre connexion. Votre texte est conservé, réessayez.",
    );
  }
  if (verified.data.user?.id !== userId) throw sessionRequired();

  return `Bearer ${session.access_token}`;
}

export async function changeOwnPostComment(
  client: Pick<SupabaseClient, "auth" | "from">,
  input: {
    postId: string;
    userId?: string;
    comment: { id: string; user_id: string; content: string };
    action: { type: "edit"; content: string } | { type: "delete" };
  },
) {
  if (!input.userId || input.comment.user_id !== input.userId)
    throw new PostCommentError(
      "Seul l’auteur peut modifier ou supprimer ce commentaire.",
    );
  const content =
    input.action.type === "edit" ? input.action.content.trim() : "";
  if (input.action.type === "edit") {
    if (!content || content.length > 3000)
      throw new PostCommentError(
        "Écrivez un commentaire de 1 à 3 000 caractères.",
      );
    if (commentTextRejected(content))
      throw new PostCommentError(COMMENT_MODERATION_MESSAGE);
  }
  const authorization = await verifiedCommentAuthorization(
    client,
    input.userId,
  );
  const table = client.from("post_comments");
  const operation =
    input.action.type === "delete" ? table.delete() : table.update({ content });
  const result = await operation
    .eq("id", input.comment.id)
    .eq("post_id", input.postId)
    .eq("user_id", input.userId)
    .eq("content", input.comment.content)
    .select("id")
    .single()
    .setHeader("Authorization", authorization);
  if (isCommentModerationError(result.error))
    throw new PostCommentError(COMMENT_MODERATION_MESSAGE);
  if (result.error || result.data?.id !== input.comment.id)
    throw new PostCommentError(
      "La modification n’a pas pu être confirmée. Le commentaire a peut-être changé ou a été supprimé. Actualisez les commentaires avant de réessayer.",
    );
}
