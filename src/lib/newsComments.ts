import type { SupabaseClient } from "@supabase/supabase-js";
import {
  commentTextRejected,
  COMMENT_MODERATION_MESSAGE,
  isCommentModerationError,
} from "./commentModeration";

export const NEWS_COMMENT_LIMIT = 1000;
export class NewsCommentError extends Error {
  constructor(
    message: string,
    public action: "profile" | "login" | null = null,
  ) {
    super(message);
  }
}
export const missingCommentProfile = () =>
  new NewsCommentError(
    "Votre compte est connecté, mais votre profil doit être enregistré pour publier un commentaire. Votre texte est conservé.",
    "profile",
  );

export function newsCommentError(error: unknown): NewsCommentError {
  if (error instanceof NewsCommentError) return error;
  if (isCommentModerationError(error))
    return new NewsCommentError(COMMENT_MODERATION_MESSAGE);
  const failure = error as { code?: string; message?: string } | null;
  if (
    failure?.code === "23503" &&
    failure.message?.includes("news_comments_user_id_fkey")
  )
    return missingCommentProfile();
  if (["PGRST301", "PGRST302", "PGRST303"].includes(failure?.code || ""))
    return new NewsCommentError(
      "Votre session a expiré. Reconnectez-vous pour publier votre commentaire.",
      "login",
    );
  if (failure?.code === "42501")
    return new NewsCommentError(
      "Votre compte n’est pas autorisé à publier ce commentaire. Votre texte est conservé.",
    );
  return new NewsCommentError(
    "Impossible d’envoyer le commentaire. Votre texte est conservé, réessayez.",
  );
}

export async function publishNewsComment(
  client: Pick<SupabaseClient, "auth" | "from">,
  input: {
    newsId: string;
    userId: string | undefined;
    content: string;
    parentId?: string | null;
  },
) {
  const content = input.content.trim();
  if (!input.newsId || !content || content.length > NEWS_COMMENT_LIMIT)
    throw new NewsCommentError(
      "Saisissez un commentaire de 1 à 1 000 caractères.",
    );
  if (commentTextRejected(content))
    throw new NewsCommentError(COMMENT_MODERATION_MESSAGE);
  const { data, error } = await client.auth.getSession();
  if (error) throw newsCommentError(error);
  if (!data.session || data.session.user.id !== input.userId)
    throw new NewsCommentError(
      "Reconnectez-vous pour publier votre commentaire avec votre compte.",
      "login",
    );
  // A session can exist without a profiles row; the comment's FK requires it.
  const profile = await client
    .from("profiles")
    .select("id")
    .eq("id", data.session.user.id)
    .maybeSingle();
  if (profile.error) throw newsCommentError(profile.error);
  if (!profile.data) throw missingCommentProfile();
  const result = await client.from("news_comments").insert({
    news_id: input.newsId,
    user_id: data.session.user.id,
    content,
    parent_id: input.parentId ?? null,
  });
  if (result.error) throw newsCommentError(result.error);
}
