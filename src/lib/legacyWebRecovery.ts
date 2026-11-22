import type { SupabaseClient } from "@supabase/supabase-js";
import { readVerifiedWebSession } from "./verifiedWebSession";

export function legacyRecoveryTokens(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (!params.has("access_token") && !params.has("refresh_token")) return null;
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token || params.get("type") !== "recovery")
    throw new Error(
      "Ce lien de récupération est incomplet. Demandez un nouveau lien.",
    );
  return { access_token, refresh_token };
}

/** Compatibility for recovery emails sent before the website moved to Expo. */
export function createLegacyRecoveryRestorer(
  auth: Pick<SupabaseClient["auth"], "getSession" | "getUser" | "setSession">,
) {
  let pending: Promise<void> | null = null;
  return (tokens: { access_token: string; refresh_token: string }) => {
    if (pending) return pending;
    pending = (async () => {
      const verified = await auth.getUser(tokens.access_token);
      if (verified.error || !verified.data.user)
        throw new Error(
          "Ce lien de récupération a expiré. Demandez un nouveau lien.",
        );
      const current = await auth.getSession();
      if (current.error) throw current.error;
      if (
        current.data.session &&
        current.data.session.user.id !== verified.data.user.id
      )
        throw new Error(
          "Un autre compte est connecté. Déconnectez-le avant d’ouvrir ce lien.",
        );
      const restored = await auth.setSession(tokens);
      if (restored.error)
        throw new Error("Ce lien de récupération ne peut pas être vérifié.");
      const session = await readVerifiedWebSession(auth);
      if (session?.user.id !== verified.data.user.id)
        throw new Error(
          "Le compte connecté a changé. Ouvrez à nouveau le lien de récupération.",
        );
    })();
    return pending;
  };
}
