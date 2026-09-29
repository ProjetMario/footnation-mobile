import { supabase } from "./supabase";

/** Both directions match the visibility rules used by the home feed. */
export async function blockedSocialAuthors(uid: string): Promise<string[]> {
  const result = await supabase
    .from("user_blocks")
    .select("blocker_id,blocked_id")
    .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
  if (result.error) throw result.error;
  return [
    ...new Set(
      (result.data || []).map(
        (row: { blocker_id: string; blocked_id: string }) =>
          row.blocker_id === uid ? row.blocked_id : row.blocker_id,
      ),
    ),
  ];
}
