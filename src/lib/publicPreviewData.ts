import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "./models";
import { isSuspended } from "./validation";

// The anonymous preview only asks for public presentation fields. Row access is
// still decided by the existing Supabase RLS policies, with no privileged RPC.
export const publicPreviewProfileFields =
  "id,full_name,username,avatar_url,cover_image_url,bio,city,department,club,primary_role,secondary_roles,position,jersey_number,account_type,linked_club_id,is_verified,is_private,is_suspended,suspended_until";
export async function readPublicPreviewProfile(
  client: Pick<SupabaseClient, "from">,
  id: string,
) {
  const result = await client
    .from("profiles")
    .select(publicPreviewProfileFields)
    .eq("id", id)
    .or("is_private.is.null,is_private.eq.false")
    .or(
      `is_suspended.is.null,is_suspended.eq.false,suspended_until.lte.${new Date().toISOString()}`,
    )
    .maybeSingle();
  if (result.error) throw result.error;
  const profile = result.data as unknown as Profile | null;
  return profile && !profile.is_private && !isSuspended(profile)
    ? profile
    : null;
}
