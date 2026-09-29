import type { ImagePickerAsset } from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { supabase } from "./supabase";

// Keep the object path so an unsuccessful database write can remove its upload.
export async function uploadPhoto(
  asset: ImagePickerAsset,
  bucket: string,
  prefix: string,
) {
  if (!asset.base64) throw new Error("Impossible de lire cette photo.");
  const bytes = Uint8Array.from(atob(asset.base64), (c) => c.charCodeAt(0));
  if (bytes.length > 10 * 1024 * 1024)
    throw new Error("Choisissez une photo de moins de 10 Mo.");
  const mime = asset.mimeType || "image/jpeg";
  const extension: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  if (!extension[mime]) throw new Error("Format de photo non pris en charge.");
  const path = `${prefix}/${randomUUID()}.${extension[mime]}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes.buffer, { contentType: mime });
  if (error) throw error;
  return {
    url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
    path,
    bucket,
  };
}
