import { createClient } from "@supabase/supabase-js";
import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { supabase, requireBackend } from "./supabase";
import { readAsset } from "./readAsset";
import { postMediaPreview } from "./postDraftStorage";
import {
  POST_PHOTO_LIMIT,
  POST_VIDEO_LIMIT,
  type PostPublicationServices,
} from "./postPublication";

export async function postPublicationServices(
  userId: string,
  assertCurrentAccount: () => void,
): Promise<PostPublicationServices> {
  requireBackend();
  assertCurrentAccount();
  const current = await supabase.auth.getSession();
  if (current.error || current.data.session?.user.id !== userId)
    throw new Error(
      "Votre session a changé. Revenez au compte de ce brouillon.",
    );
  const token = current.data.session.access_token;
  // A later account switch cannot change the identity of an in-flight request.
  const client = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: async () => token,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const bucket = client.storage.from("post-media");
  return {
    assertCurrentAccount,
    find: async (id) => {
      assertCurrentAccount();
      const result = await client
        .from("posts")
        .select("id,user_id,content,location,hashtags,image_url,video_url")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
    upload: async (draft) => {
      assertCurrentAccount();
      if (
        !draft.media ||
        !draft.attempt?.path ||
        draft.userId !== userId ||
        bucket.getPublicUrl(draft.attempt.path).data.publicUrl !==
          (draft.media.type === "video"
            ? draft.attempt.record.video_url
            : draft.attempt.record.image_url)
      )
        throw new Error(
          "La pièce jointe ne correspond pas à cette publication.",
        );
      const preview = await postMediaPreview(userId, draft.media);
      let bytes: ArrayBuffer;
      try {
        bytes = await readAsset(
          preview.uri,
          draft.media.type === "video" ? POST_VIDEO_LIMIT : POST_PHOTO_LIMIT,
        );
      } finally {
        preview.release();
      }
      if (!bytes.byteLength)
        throw new Error("Cette pièce jointe est vide ou indisponible.");
      const checksum = await digest(CryptoDigestAlgorithm.SHA256, bytes);
      const sha256 = Array.from(new Uint8Array(checksum), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      assertCurrentAccount();
      const result = await bucket.upload(draft.attempt.path, bytes, {
        contentType: draft.media.mime,
        upsert: false,
        metadata: { postId: draft.id, sha256 },
      });
      if (!result.error) return;
      assertCurrentAccount();
      const existing = await bucket.info(draft.attempt.path);
      if (
        existing.error ||
        existing.data.size !== bytes.byteLength ||
        existing.data.metadata?.postId !== draft.id ||
        existing.data.metadata?.sha256 !== sha256
      )
        throw new Error(
          "L’envoi de la pièce jointe n’a pas pu être confirmé. Réessayez cette même publication.",
        );
    },
    insert: async (record) => {
      assertCurrentAccount();
      if (record.user_id !== userId) throw new Error("Votre session a changé.");
      const result = await client.from("posts").insert(record);
      if (result.error) throw result.error;
    },
  };
}
