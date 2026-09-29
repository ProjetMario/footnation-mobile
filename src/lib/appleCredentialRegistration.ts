import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { missingAppleNameMetadata, SocialAuthError } from "./socialAuthPolicy";

export type AppleCredentialBody =
  | { authorizationCode: string; nonce: string }
  | { providerRefreshToken: string };

export async function requireSocialSession(userId: string): Promise<Session> {
  const current = await supabase.auth.getSession();
  if (current.error || current.data.session?.user.id !== userId)
    throw new SocialAuthError(
      "Le compte connecté a changé. Recommencez la connexion.",
    );
  return current.data.session;
}

export async function registerAppleCredentials(
  session: Session,
  body: AppleCredentialBody,
) {
  try {
    await requireSocialSession(session.user.id);
    const { data, error } = await supabase.functions.invoke(
      "apple-auth-credentials",
      {
        body,
        headers: { Authorization: `Bearer ${session.access_token}` },
      },
    );
    await requireSocialSession(session.user.id);
    if (error || data?.stored !== true)
      throw new Error("credential_registration_failed");
  } catch {
    // Never sign out an account that replaced this in-flight authentication.
    const current = await supabase.auth.getSession();
    if (!current.error && current.data.session?.user.id === session.user.id)
      await supabase.auth.signOut({ scope: "local" });
    throw new SocialAuthError(
      "La connexion Apple n’a pas pu être finalisée. Recommencez avec Apple ou utilisez votre adresse e-mail.",
    );
  }
}

export async function saveMissingAppleName(
  session: Session,
  name?: { givenName?: string | null; familyName?: string | null },
) {
  if (!name?.givenName && !name?.familyName) return;
  await requireSocialSession(session.user.id);
  // Auth metadata can have changed in another tab. Fetch it with the captured
  // JWT, then use that same JWT for the update instead of the SDK's mutable session.
  const fresh = await supabase.auth.getUser(session.access_token);
  if (fresh.error || fresh.data.user?.id !== session.user.id)
    throw new SocialAuthError(
      "Le compte connecté a changé. Recommencez la connexion.",
    );
  const fields = missingAppleNameMetadata(fresh.data.user.user_metadata, name);
  if (!Object.keys(fields).length) return;
  await requireSocialSession(session.user.id);
  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/user`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ data: fields }),
    },
  );
  if (!response.ok)
    throw new SocialAuthError(
      "Votre nom n’a pas pu être enregistré. Réessayez la connexion.",
    );
  const updated = await response.json();
  if (updated?.id !== session.user.id)
    throw new SocialAuthError(
      "Votre nom n’a pas pu être enregistré. Réessayez la connexion.",
    );
  await requireSocialSession(session.user.id);
}
