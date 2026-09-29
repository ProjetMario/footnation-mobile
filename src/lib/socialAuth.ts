import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { requireBackend, supabase } from "./supabase";
import { exchangeAuthCode } from "./exchangeAuthCode";
import {
  registerAppleCredentials,
  requireSocialSession,
  saveMissingAppleName,
} from "./appleCredentialRegistration";
import { finishSocialAuth } from "./socialOnboarding";
import { socialAuthAttempts } from "./socialAuthAttempt";
import {
  isSocialAuthCancellation,
  socialCallbackParams,
  SocialAuthError,
  type SocialAuthContext,
  type SocialProvider,
} from "./socialAuthPolicy";

WebBrowser.maybeCompleteAuthSession();

function socialRedirectUri(queryParams: Record<string, string>) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const url = new URL("/auth/callback", window.location.origin);
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }
  return AuthSession.makeRedirectUri({
    scheme: "com.footnation.app",
    path: "auth/callback",
    queryParams,
  });
}

// Shared by both the browser session result and the router callback.
export async function finishSocialCallback(
  code: string,
  provider: SocialProvider,
  context: SocialAuthContext,
  attemptId?: string,
) {
  const userId = await exchangeAuthCode(code, provider, attemptId);
  const session = await requireSocialSession(userId);
  const route = await finishSocialAuth(session, { ...context, provider });
  await requireSocialSession(userId);
  return { session, route, claim: code };
}

async function nativeApple(context: SocialAuthContext) {
  const previous = await supabase.auth.getSession();
  if (previous.error) throw previous.error;
  const nonce = Array.from(await Crypto.getRandomBytesAsync(32), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const state = Crypto.randomUUID();
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      nonce,
    ),
    state,
  });
  if (
    credential.state !== state ||
    !credential.identityToken ||
    !credential.authorizationCode
  )
    throw new SocialAuthError(
      "Le retour Apple est incomplet. Recommencez la connexion.",
    );
  const latest = await supabase.auth.getSession();
  if (
    latest.error ||
    latest.data.session?.user.id !== previous.data.session?.user.id
  )
    throw new SocialAuthError(
      "Le compte connecté a changé. Recommencez la connexion.",
    );
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce,
  });
  if (error) throw error;
  if (!data.session)
    throw new SocialAuthError("Votre session a expiré. Reconnectez-vous.");
  await requireSocialSession(data.session.user.id);
  await registerAppleCredentials(data.session, {
    authorizationCode: credential.authorizationCode,
    nonce,
  });
  const session = await requireSocialSession(data.session.user.id);
  await saveMissingAppleName(session, credential.fullName || undefined);
  const route = await finishSocialAuth(session, {
    ...context,
    provider: "apple",
  });
  await requireSocialSession(data.session.user.id);
  return { session, route, claim: `apple:${state}` };
}

export async function signInSocial(
  provider: SocialProvider,
  context: SocialAuthContext,
) {
  requireBackend();
  try {
    if (provider === "apple" && Platform.OS === "ios")
      return await nativeApple(context);
    const attempt = await socialAuthAttempts.begin(provider);
    const redirectTo = socialRedirectUri({
      ...socialCallbackParams(provider, context),
      attempt: attempt.id,
    });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) {
      await socialAuthAttempts.clear(attempt.id);
      throw error;
    }
    if (!data.url)
      throw new SocialAuthError("Le service de connexion est indisponible.");
    if (Platform.OS === "web") {
      window.location.assign(data.url);
      return null;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") {
      await socialAuthAttempts.clear(attempt.id);
      return null;
    }
    const callback = new URL(result.url);
    const expected = new URL(redirectTo);
    if (
      callback.protocol !== expected.protocol ||
      callback.host !== expected.host ||
      callback.pathname !== expected.pathname
    )
      throw new SocialAuthError(
        "Le retour de connexion est invalide. Recommencez la connexion.",
      );
    if (callback.searchParams.get("error") === "access_denied") {
      await socialAuthAttempts.clear(attempt.id);
      return null;
    }
    if (callback.searchParams.has("error"))
      throw new SocialAuthError(
        "Le service de connexion n’a pas pu vous authentifier. Réessayez.",
      );
    const code = callback.searchParams.get("code");
    if (!code)
      throw new SocialAuthError(
        "Le retour de connexion est incomplet. Réessayez.",
      );
    return await finishSocialCallback(code, provider, context, attempt.id);
  } catch (error) {
    if (isSocialAuthCancellation(error)) return null;
    throw error;
  }
}
