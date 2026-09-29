import { authReturnPath } from "./authReturn";
import { normalizeReferral } from "./referral";

export type SocialProvider = "google" | "apple";
export type SocialAuthContext = {
  next?: string | null;
  referral?: string | null;
};

export function socialProvider(value: unknown): SocialProvider | null {
  return value === "google" || value === "apple" ? value : null;
}

export function enabledSocialProviders(input: {
  google?: string;
  apple?: string;
  platform: string;
  appleAvailable: boolean;
}) {
  const apple =
    input.apple === "true" &&
    (input.platform !== "ios" || input.appleAvailable);
  return {
    apple,
    // On iOS a privacy-preserving equivalent must be usable alongside Google.
    google: input.google === "true" && (input.platform !== "ios" || apple),
  };
}

export function socialCallbackParams(
  provider: SocialProvider,
  context: SocialAuthContext,
) {
  const next = authReturnPath(context.next);
  const referral = normalizeReferral(context.referral);
  return {
    social: provider,
    ...(next ? { next } : {}),
    ...(referral ? { ref: referral } : {}),
  };
}

export function isSocialAuthCancellation(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "ERR_REQUEST_CANCELED" || error.code === "access_denied")
  );
}

export class SocialAuthError extends Error {}
export function socialAuthErrorMessage(error: unknown) {
  return error instanceof SocialAuthError
    ? error.message
    : "Connexion impossible pour le moment. Réessayez ou utilisez votre adresse e-mail.";
}

/** Converts OAuth callback query errors into a useful, safe user-facing hint. */
export function socialCallbackErrorMessage(input: {
  error?: unknown;
  errorCode?: unknown;
  description?: unknown;
  provider?: unknown;
}) {
  const code = String(input.errorCode || "").toLowerCase();
  const error = String(input.error || "").toLowerCase();
  const description = String(input.description || "").toLowerCase();
  const provider = socialProvider(input.provider);

  if (error === "access_denied" || code === "access_denied")
    return "Connexion annulée. Vous pouvez réessayer ou utiliser votre adresse e-mail.";
  if (
    provider === "google" &&
    (code === "unexpected_failure" ||
      description.includes("unable to exchange external code"))
  )
    return "Google a autorisé la connexion, mais FootNation n’a pas pu valider le retour. Réessayez dans quelques instants ou connectez-vous avec votre adresse e-mail et votre mot de passe.";
  if (code === "redirect_uri_mismatch" || description.includes("redirect_uri_mismatch"))
    return "L’adresse de retour Google n’est pas autorisée. Vérifiez les URL de redirection OAuth dans Google et Supabase.";
  if (error === "server_error" || code === "server_error")
    return "Le service de connexion Google est temporairement indisponible. Réessayez ou utilisez votre adresse e-mail.";
  return "Le service de connexion n’a pas pu vous authentifier. Réessayez ou utilisez votre adresse e-mail.";
}

/** Provider credentials are exchanged with our server only, never persisted. */
export function stripProviderCredentials(value: string) {
  const session = JSON.parse(value);
  if (!session || typeof session !== "object") return value;
  if (!("provider_token" in session) && !("provider_refresh_token" in session))
    return value;
  delete session.provider_token;
  delete session.provider_refresh_token;
  return JSON.stringify(session);
}

export function missingAppleNameMetadata(
  current: Record<string, unknown>,
  name?: { givenName?: string | null; familyName?: string | null },
) {
  const given = name?.givenName?.trim().slice(0, 100);
  const family = name?.familyName?.trim().slice(0, 100);
  const fields: Record<string, string> = {};
  if (given && !current.first_name && !current.given_name)
    fields.first_name = given;
  if (family && !current.last_name && !current.family_name)
    fields.last_name = family;
  if ((given || family) && !current.full_name && !current.name)
    fields.full_name = [given, family].filter(Boolean).join(" ");
  return fields;
}
