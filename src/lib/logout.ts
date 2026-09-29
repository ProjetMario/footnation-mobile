import { unregisterPushDevice } from "./pushDevice";
import { supabase } from "./supabase";

export async function signOutCurrentDevice(userId: string): Promise<void> {
  const before = await supabase.auth.getUser();
  if (before.error) throw before.error;
  if (before.data.user?.id !== userId)
    throw new Error("La session a changé. Rechargez cet écran.");
  await unregisterPushDevice(userId);
  const after = await supabase.auth.getUser();
  if (after.error) throw after.error;
  if (after.data.user?.id !== userId)
    throw new Error("La session a changé. Rechargez cet écran.");
  const result = await supabase.auth.signOut();
  if (result.error) throw result.error;
}
