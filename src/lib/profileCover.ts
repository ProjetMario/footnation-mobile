import type { ImagePickerAsset } from "expo-image-picker";
import type { Profile } from "./models";
import { uploadPhoto } from "./media";
import { supabase } from "./supabase";

async function requireOwner(id: string) {
  const auth = await supabase.auth.getUser();
  if (auth.error || auth.data.user?.id !== id)
    throw new Error("Votre session a changé. Reconnectez-vous.");
}

export async function uploadProfileCover(
  profile: Profile,
  asset: ImagePickerAsset,
) {
  await requireOwner(profile.id);
  return uploadPhoto(asset, "avatars", profile.id);
}

export async function saveProfileCover(
  profile: Profile,
  url: string,
): Promise<Profile> {
  if (!url.startsWith("https://"))
    throw new Error("Cette photo est indisponible.");
  await requireOwner(profile.id);
  let query = supabase
    .from("profiles")
    .update({ cover_image_url: url })
    .eq("id", profile.id);
  query =
    profile.cover_image_url == null
      ? query.is("cover_image_url", null)
      : query.eq("cover_image_url", profile.cover_image_url);
  const result = await query.select("*").maybeSingle();
  if (result.data && !result.error) return result.data as Profile;
  // A retry can follow a lost response. Recognize our saved URL without overwriting another edit.
  const current = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profile.id)
    .maybeSingle();
  if (!current.error && current.data?.cover_image_url === url)
    return current.data as Profile;
  if (result.error)
    throw new Error(
      "La couverture n’a pas pu être confirmée. Réessayez : votre photo est conservée.",
    );
  throw new Error(
    "Votre couverture a changé entre-temps. Fermez puis rouvrez l’éditeur.",
  );
}
