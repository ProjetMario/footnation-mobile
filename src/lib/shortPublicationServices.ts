import { createClient } from "@supabase/supabase-js";
import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { supabase, requireBackend } from "./supabase";
import { storyPhoto } from "./storyPublication";
import { readAsset } from "./readAsset";
import {
  MAX_SHORT_BYTES,
  type ShortPublicationServices,
} from "./shortPublication";

export async function shortPublicationServices(
  userId: string,
  assertCurrentAccount: () => void,
): Promise<ShortPublicationServices> {
  requireBackend();
  assertCurrentAccount();
  const current = await supabase.auth.getSession();
  if (current.error || current.data.session?.user.id !== userId)
    throw new Error(
      "Votre session a changé. Revenez au compte de cette publication.",
    );
  const token = current.data.session.access_token;
  // A later account switch cannot replace the token on an in-flight write.
  // This client neither stores nor refreshes a session.
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
  const bucket = client.storage.from("shorts");
  return {
    assertCurrentAccount,
    find: async (id) => {
      const result = await client
        .from("shorts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
    read: async (uri) => {
      const bytes = await readAsset(uri, MAX_SHORT_BYTES);
      if (!bytes.byteLength)
        throw new Error("Cette vidéo est vide ou indisponible.");
      const checksum = await digest(CryptoDigestAlgorithm.SHA256, bytes);
      return {
        bytes,
        sha256: Array.from(new Uint8Array(checksum), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join(""),
      };
    },
    upload: async (draft, content) => {
      assertCurrentAccount();
      const result = await bucket.upload(draft.path, content.bytes, {
        contentType: draft.mime,
        upsert: false,
        metadata: { shortId: draft.record.id, sha256: content.sha256 },
      });
      if (!result.error) return;
      // A lost upload response or 409 is reusable only after verifying the
      // exact object from this attempt. No overwrite and no blind 409 success.
      const existing = await bucket.info(draft.path);
      if (
        existing.error ||
        existing.data.size !== content.bytes.byteLength ||
        existing.data.metadata?.shortId !== draft.record.id ||
        existing.data.metadata?.sha256 !== content.sha256
      )
        throw result.error;
    },
    uploadThumbnail: async (draft) => {
      assertCurrentAccount();
      if (!draft.thumbnail) return;
      const photo = storyPhoto(draft.thumbnail.base64);
      if (
        photo.mime !== draft.thumbnail.mime ||
        draft.record.user_id !== userId ||
        bucket.getPublicUrl(draft.thumbnail.path).data.publicUrl !==
          draft.record.thumbnail_url
      )
        throw new Error(
          "Cette miniature ne correspond pas à cette publication.",
        );
      const bytes = Uint8Array.from(atob(draft.thumbnail.base64), (c) =>
        c.charCodeAt(0),
      ).buffer;
      const checksum = await digest(CryptoDigestAlgorithm.SHA256, bytes);
      const sha256 = Array.from(new Uint8Array(checksum), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      assertCurrentAccount();
      const result = await bucket.upload(draft.thumbnail.path, bytes, {
        contentType: photo.mime,
        upsert: false,
        metadata: { shortId: draft.record.id, sha256, kind: "thumbnail" },
      });
      if (!result.error) return;
      const existing = await bucket.info(draft.thumbnail.path);
      if (
        existing.error ||
        existing.data.size !== bytes.byteLength ||
        existing.data.metadata?.shortId !== draft.record.id ||
        existing.data.metadata?.sha256 !== sha256 ||
        existing.data.metadata?.kind !== "thumbnail"
      )
        throw new Error(
          "L’envoi de la miniature n’a pas pu être confirmé. Réessayez cette même tentative.",
        );
    },
    insert: async (record) => {
      assertCurrentAccount();
      const result = await client.from("shorts").insert(record);
      if (result.error) throw result.error;
    },
  };
}
