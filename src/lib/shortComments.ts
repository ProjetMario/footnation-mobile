import type { SupabaseClient } from "@supabase/supabase-js";
import {
  commentTextRejected,
  COMMENT_MODERATION_MESSAGE,
  isCommentModerationError,
} from "./commentModeration";

export const SHORT_COMMENT_LIMIT = 3000;
export async function publishShortComment(
  client: Pick<SupabaseClient, "auth" | "from">,
  input: { shortId: string; userId?: string; content: string },
) {
  const content = input.content.trim();
  if (!input.shortId || !content || content.length > SHORT_COMMENT_LIMIT)
    throw new Error("Écrivez un commentaire de 1 à 3 000 caractères.");
  if (commentTextRejected(content)) throw new Error(COMMENT_MODERATION_MESSAGE);
  const auth = await client.auth.getSession();
  if (
    auth.error ||
    !input.userId ||
    auth.data.session?.user.id !== input.userId
  )
    throw new Error("Votre session a changé. Reconnectez-vous pour commenter.");
  const profile = await client
    .from("profiles")
    .select("id")
    .eq("id", input.userId)
    .maybeSingle();
  if (profile.error)
    throw new Error("Impossible de vérifier votre profil. Réessayez.");
  if (!profile.data)
    throw new Error(
      "Enregistrez votre profil avant de commenter. Votre texte est conservé.",
    );
  const result = await client
    .from("short_comments")
    .insert({ short_id: input.shortId, user_id: input.userId, content });
  if (isCommentModerationError(result.error))
    throw new Error(COMMENT_MODERATION_MESSAGE);
  if (result.error)
    throw new Error(
      "Le commentaire n’a pas été envoyé. Votre texte est conservé, réessayez.",
    );
}
