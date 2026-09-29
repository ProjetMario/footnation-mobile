import { supabase } from "./supabase";
export async function supportsClubMatching() {
  const { error } = await supabase
    .from("swipes")
    .select("target_type")
    .limit(0);
  if (!error) return true;
  if (error.code === "42703" || error.code === "PGRST204") return false;
  throw error;
}
