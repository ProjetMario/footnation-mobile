import { supabase } from "./supabase";
import { isSuspended } from "./validation";
import { displayName, type Profile } from "./models";
export const publicTalentFields =
  "id,slug,is_published,is_verified,linked_club_id,full_name,username,avatar_url,cover_image_url,bio,city,department,club,primary_role,position,highest_level,skills,experience_history,achievements,certifications,technical_skills,characteristics,is_suspended,suspended_until,height,weight,nationality,strong_foot,account_type,club_official_name,club_year_founded,club_colors,club_address,club_phone,club_website,business_name,business_description,business_sector,business_address,business_email,business_phone,business_website,institution_name,institution_description,institution_type,institution_level,institution_address,institution_email,institution_phone";
export type PublicTalent = Profile & {
  slug: string | null;
  height: number | null;
  weight: number | null;
  nationality: string | null;
  strong_foot: string | null;
};
export async function loadPublicTalent(
  slug: string,
): Promise<PublicTalent | null> {
  if (!slug) return null;
  const read = (column: string) =>
    supabase
      .from("profiles")
      .select(publicTalentFields)
      .eq(column, slug)
      .eq("is_published", true)
      .maybeSingle();
  let result = await read("slug");
  if (result.error) throw result.error;
  if (
    !result.data &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
  ) {
    result = await read("id");
    if (result.error) throw result.error;
  }
  if (!result.data || isSuspended(result.data)) return null;
  return result.data as unknown as PublicTalent;
}

export function publicProfileName(profile: Profile): string {
  const name =
    profile.account_type === "club"
      ? profile.club_official_name
      : profile.account_type === "business"
        ? profile.business_name
        : profile.account_type === "institution"
          ? profile.institution_name
          : null;
  return name?.trim() || displayName(profile);
}
