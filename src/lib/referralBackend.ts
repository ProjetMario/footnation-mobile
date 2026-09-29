import { supabase } from "./supabase";
import { applyReferral, normalizeReferral } from "./referral";
export async function applySignupReferral(
  raw: unknown,
  expectedUserId: string,
) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session)
    throw new Error("Connectez-vous pour valider votre invitation.");
  if (session.user.id !== expectedUserId)
    throw new Error(
      "Le compte connecté a changé. Ouvrez à nouveau votre invitation.",
    );
  let reference = normalizeReferral(raw);
  if (!reference) {
    // Social completion writes the referral atomically on the server. The
    // session's cached user metadata can still predate that RPC.
    const current = await supabase.auth.getUser(session.access_token);
    if (current.error || current.data.user?.id !== expectedUserId)
      throw new Error("Votre invitation n’a pas pu être vérifiée. Réessayez.");
    reference = normalizeReferral(current.data.user.user_metadata?.referrer_id);
  }
  const authorization = `Bearer ${session.access_token}`;
  return applyReferral(
    {
      current: async (id) => {
        const { data, error } = await supabase
          .from("profiles")
          .select("referred_by")
          .eq("id", id)
          .single()
          .setHeader("Authorization", authorization);
        if (error) throw error;
        return data.referred_by;
      },
      resolve: async (reference) => {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq(reference.length === 36 ? "id" : "referral_code", reference)
          .maybeSingle()
          .setHeader("Authorization", authorization);
        if (error) throw error;
        return data?.id ?? null;
      },
      assignIfEmpty: async (id, referrerId) => {
        const { data, error } = await supabase
          .from("profiles")
          .update({ referred_by: referrerId })
          .eq("id", id)
          .is("referred_by", null)
          .select("id")
          .setHeader("Authorization", authorization);
        if (error) throw error;
        return !!data?.length;
      },
    },
    expectedUserId,
    reference,
  );
}
