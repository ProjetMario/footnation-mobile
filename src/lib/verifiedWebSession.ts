import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { recoverAuthRead } from "./authServiceRecovery";

/** Stored session data is a candidate, never the authority for a web identity. */
export async function readVerifiedWebSession(
  auth: Pick<SupabaseClient["auth"], "getSession" | "getUser">,
): Promise<Session | null> {
  const stored = await recoverAuthRead(() => auth.getSession());
  if (stored.error) throw stored.error;
  if (!stored.data.session) return null;
  const candidate = stored.data.session;
  const verified = await recoverAuthRead(() => auth.getUser(candidate.access_token));
  if (verified.error || verified.data.user?.id !== candidate.user.id)
    throw new Error(
      "Votre session ne peut pas être vérifiée. Reconnectez-vous.",
    );
  // The validation request may overlap logout/sign-in in another tab. Never
  // restore A after B became current, or adopt the identity from local JSON.
  const latest = await recoverAuthRead(() => auth.getSession());
  if (latest.error) throw latest.error;
  if (!latest.data.session) return null;
  if (
    latest.data.session.access_token !== candidate.access_token ||
    latest.data.session.user.id !== candidate.user.id
  )
    throw new Error("Le compte connecté a changé. Réessayez.");
  return { ...latest.data.session, user: verified.data.user };
}
