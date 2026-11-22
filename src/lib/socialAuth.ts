import { Platform } from "react-native";
import { authRedirectUri } from "./authRedirectUri";
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
import { createAuthCodeExchange } from "./authCodeExchange";
import { createSocialAuthFlow } from "./socialAuthFlow";
import {
  isSocialAuthCancellation,
  socialCallbackErrorMessage,
  socialCallbackUrlParams,
  SocialAuthError,
  type SocialAuthContext,
  type SocialProvider,
} from "./socialAuthPolicy";

WebBrowser.maybeCompleteAuthSession();

function socialRedirectUri() {
  const url = authRedirectUri();
  if (url.startsWith("exp:") || url.startsWith("exps:"))
    throw new SocialAuthError(
      "Ouvrez FootNation dans son application ou son build de développement pour utiliser Google ou Apple.",
    );
  return url;
}

type CallbackInput = Parameters<typeof socialAuthAttempts.resolve>[0] & {
  code?: string;
};
const callbackInputs = new Map<string, CallbackInput>();
const resolveCallback = createAuthCodeExchange(async (code) =>
  socialAuthAttempts.resolve(callbackInputs.get(code) || {}),
);
export function resolveSocialCallback(input: CallbackInput) {
  if (!input.code) return socialAuthAttempts.resolve(input);
  callbackInputs.set(input.code, input);
  return resolveCallback(input.code).finally(() =>
    callbackInputs.delete(input.code!),
  );
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
  let attemptId: string | undefined;
  try {
    if (provider === "apple" && Platform.OS === "ios")
      return await nativeApple(context);
    const redirectTo = socialRedirectUri();
    const attempt = await socialAuthAttempts.begin(provider, context);
    attemptId = attempt.id;
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
    const params = socialCallbackUrlParams(result.url);
    const expected = new URL(redirectTo);
    if (
      callback.protocol !== expected.protocol ||
      callback.host !== expected.host ||
      callback.pathname !== expected.pathname
    )
      throw new SocialAuthError(
        "Le retour de connexion est invalide. Recommencez la connexion.",
      );
    if (params.get("error") === "access_denied") {
      await socialAuthAttempts.clear(attempt.id);
      return null;
    }
    if (params.has("error") || params.has("error_description"))
      throw new SocialAuthError(
        socialCallbackErrorMessage({
          error: params.get("error"),
          errorCode: params.get("error_code"),
          description: params.get("error_description"),
          provider,
        }),
      );
    const code = params.get("code");
    if (!code)
      throw new SocialAuthError(
        "Le retour de connexion est incomplet. Réessayez.",
      );
    await resolveSocialCallback({
      code,
      social: provider,
      attempt: attempt.id,
    });
    return await finishSocialCallback(code, provider, context, attempt.id);
  } catch (error) {
    if (attemptId) await socialAuthAttempts.clear(attemptId);
    if (isSocialAuthCancellation(error)) return null;
    throw error;
  }
}

export const socialAuthFlow = createSocialAuthFlow(signInSocial);
