import { createClient } from "@supabase/supabase-js";
import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { supabase, requireBackend } from "./supabase";
import { storyMedia, type StoryPublicationServices } from "./storyPublication";

export async function storyPublicationServices(
  userId: string,
  assertCurrentAccount: () => void,
): Promise<StoryPublicationServices> {
  requireBackend();
  assertCurrentAccount();
  const current = await supabase.auth.getSession();
  if (current.error || current.data.session?.user.id !== userId)
    throw new Error(
      "Votre session a changé. Revenez au compte de cette story.",
    );
  const token = current.data.session.access_token;
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
  const bucket = client.storage.from("avatars");
  return {
    assertCurrentAccount,
    now: Date.now,
    find: async (id) => {
      // Do not filter expired rows: they still reconcile a completed attempt.
      const result = await client
        .from("stories")
        .select(
          "id,user_id,media_url,caption,location,hashtags,filters,expires_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
    upload: async (draft) => {
      assertCurrentAccount();
      storyMedia(draft.base64, draft.mime);
      if (
        draft.record.user_id !== userId ||
        bucket.getPublicUrl(draft.path).data.publicUrl !==
          draft.record.media_url
      )
        throw new Error(
          "Cette tentative ne correspond pas à ce compte FootNation.",
        );
      const bytes = Uint8Array.from(atob(draft.base64), (character) =>
        character.charCodeAt(0),
      );
      const checksum = await digest(CryptoDigestAlgorithm.SHA256, bytes);
      const sha256 = Array.from(new Uint8Array(checksum), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      assertCurrentAccount();
      const result = await bucket.upload(draft.path, bytes.buffer, {
        contentType: draft.mime,
        upsert: false,
        metadata: { storyId: draft.record.id, sha256 },
      });
      if (!result.error) return;
      const existing = await bucket.info(draft.path);
      if (
        existing.error ||
        existing.data.size !== bytes.byteLength ||
        existing.data.metadata?.storyId !== draft.record.id ||
        existing.data.metadata?.sha256 !== sha256
      )
        throw new Error(
          "L’envoi du média n’a pas pu être confirmé. Réessayez pour vérifier cette même tentative.",
        );
    },
    insert: async (record) => {
      assertCurrentAccount();
      if (record.user_id !== userId) throw new Error("Votre session a changé.");
      const result = await client.from("stories").insert(record);
      if (result.error) throw result.error;
    },
  };
}
