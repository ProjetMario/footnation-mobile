import { supabase } from "./supabase";
import { registerAppleCredentials } from "./appleCredentialRegistration";
import type { SocialProvider } from "./socialAuthPolicy";
import { socialAuthAttempts } from "./socialAuthAttempt";
import {
  createAuthCodeExchange,
  createAuthNavigationClaims,
} from "./authCodeExchange";
const providers = new Map<
  string,
  { provider: SocialProvider; attemptId?: string }
>();
const exchange = createAuthCodeExchange(async (code) => {
  const social = providers.get(code);
  // Validation belongs inside the shared exchange: the second callback can
  // arrive after the first already adopted the authenticated user's session.
  if (social) await socialAuthAttempts.check(social.attemptId, social.provider);
  else await socialAuthAttempts.checkLegacy();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  if (!data.session)
    throw new Error("Votre session a expiré. Reconnectez-vous.");
  if (social?.provider === "apple") {
    // The SDK persists only the redacted session; consume the response token
    // here before either browser callback can finish authentication.
    await registerAppleCredentials(data.session, {
      providerRefreshToken: data.session.provider_refresh_token || "",
    });
  }
  delete data.session.provider_token;
  delete data.session.provider_refresh_token;
  if (social?.attemptId) await socialAuthAttempts.clear(social.attemptId);
  return data.session.user.id;
});
export const exchangeAuthCode = (
  code: string,
  provider?: SocialProvider | null,
  attemptId?: string,
) => {
  if (provider) providers.set(code, { provider, attemptId });
  return exchange(code).finally(() => providers.delete(code));
};
export const claimAuthNavigation = createAuthNavigationClaims();
