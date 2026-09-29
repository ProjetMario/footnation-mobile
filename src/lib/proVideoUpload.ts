import { createClient } from "@supabase/supabase-js";
import type { ImagePickerAsset } from "expo-image-picker";
import { CryptoDigestAlgorithm, digest, randomUUID } from "expo-crypto";
import { supabase } from "./supabase";
import { readAsset } from "./readAsset";
import { MAX_PRO_VIDEO_BYTES, validateProVideo } from "./proVideo";

export function createProVideoUploader() {
  const attempts = new WeakMap<
    ImagePickerAsset,
    { uid: string; pageId: string; path: string; sha256: string; mime: string }
  >();
  return async (asset: ImagePickerAsset, uid: string, pageId: string) => {
    const { mime, extension } = validateProVideo(asset);
    const snapshot = await supabase.auth.getSession();
    if (snapshot.error || snapshot.data.session?.user.id !== uid)
      throw new Error("La session a changé.");
    const token = snapshot.data.session.access_token;
    const verified = await supabase.auth.getUser(token);
    if (verified.error || verified.data.user?.id !== uid)
      throw new Error("Reconnectez-vous pour envoyer cette vidéo.");
    const client = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { headers: { Authorization: `Bearer ${token}` } },
      },
    );
    const owner = await client
      .from("pro_pages")
      .select("id")
      .eq("id", pageId)
      .eq("owner_id", uid)
      .single();
    if (owner.error) throw new Error("Vous ne gérez plus cette page.");
    let attempt = attempts.get(asset);
    if (attempt && (attempt.uid !== uid || attempt.pageId !== pageId))
      throw new Error("Sélectionnez à nouveau le fichier sur ce compte.");
    const bytes = await readAsset(asset.uri, MAX_PRO_VIDEO_BYTES);
    validateProVideo(asset, bytes.byteLength);
    const sha256 = Array.from(
      new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, bytes)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    if (attempt && (attempt.sha256 !== sha256 || attempt.mime !== mime))
      throw new Error("Le fichier a changé depuis la première tentative.");
    if (!attempt) {
      attempt = {
        uid,
        pageId,
        path: `${uid}/content/${pageId}/${randomUUID()}.${extension}`,
        sha256,
        mime,
      };
      attempts.set(asset, attempt);
    }
    const assertAccount = async () => {
      const current = await supabase.auth.getSession();
      if (current.error || current.data.session?.user.id !== uid)
        throw new Error("La session a changé.");
    };
    const matches = (value: unknown) => {
      if (!value || typeof value !== "object") return false;
      const info = value as Record<string, unknown>;
      const metadata = info.metadata as Record<string, unknown> | undefined;
      return (
        Number(info.size ?? metadata?.size) === bytes.byteLength &&
        (info.contentType ?? info.content_type ?? metadata?.mimetype) ===
          mime &&
        metadata?.sha256 === sha256
      );
    };
    const bucket = client.storage.from("pro-pages");
    await assertAccount();
    const existing = await bucket.info(attempt.path);
    await assertAccount();
    if (!existing.error) {
      if (!matches(existing.data))
        throw new Error(
          "Le fichier distant ne correspond pas à cette tentative.",
        );
    } else {
      const missing = existing.error as {
        status?: number;
        statusCode?: string;
        code?: string;
      };
      if (
        Number(missing.statusCode ?? missing.status) !== 404 &&
        !["NoSuchKey", "not_found", "object_not_found"].includes(
          missing.code ?? "",
        )
      )
        throw new Error(
          "Impossible de vérifier cette vidéo. Réessayez avec une connexion réseau.",
        );
      const upload = await bucket.upload(attempt.path, bytes, {
        contentType: mime,
        upsert: false,
        metadata: { sha256 },
      });
      await assertAccount();
      if (upload.error) {
        const check = await bucket.info(attempt.path);
        await assertAccount();
        if (check.error || !matches(check.data)) throw upload.error;
      }
    }
    return bucket.getPublicUrl(attempt.path).data.publicUrl;
  };
}
