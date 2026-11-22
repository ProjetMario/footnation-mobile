import { authReturnPath, authCallbackPath } from "../lib/authReturn";
import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { exchangeAuthCode, claimAuthNavigation } from "../lib/exchangeAuthCode";
import { normalizeReferral } from "../lib/referral";
import { supabase } from "../lib/supabase";
import { Button, ErrorState, Loading, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { finishSocialCallback, resolveSocialCallback } from "../lib/socialAuth";
import { requireSocialSession } from "../lib/appleCredentialRegistration";
import { socialAuthAttempts } from "../lib/socialAuthAttempt";
import { postSocialCallbackRoute } from "../lib/socialOnboarding";
import { SocialAuthButtons } from "../components/SocialAuthButtons";
import {
  socialProvider,
  socialCallbackErrorMessage,
  socialCallbackUrlParams,
  socialAuthErrorMessage,
  SocialAuthError,
  type SocialAuthContext,
} from "../lib/socialAuthPolicy";

export default function AuthCallback() {
  const { requestNetworkInvite } = useAuth();
  const params = useLocalSearchParams<{
    code?: string;
    next?: string;
    recovery?: string;
    invite?: string;
    social?: string;
    attempt?: string;
    ref?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  }>();
  const [error, setError] = useState<Error | null>(null);
  const [context, setContext] = useState<SocialAuthContext>({
    next: authReturnPath(params.next),
    referral: normalizeReferral(params.ref),
  });
  const hashErrors =
    Platform.OS === "web" && typeof window !== "undefined"
      ? socialCallbackUrlParams(window.location.href)
      : new URLSearchParams();
  const callbackError = params.error || hashErrors.get("error") || undefined;
  const errorCode =
    params.error_code || hashErrors.get("error_code") || undefined;
  const description =
    params.error_description ||
    hashErrors.get("error_description") ||
    undefined;

  useEffect(() => {
    let active = true;
    setError(null);
    void (async () => {
      if (
        params.social &&
        (!socialProvider(params.social) || params.recovery === "1")
      )
        throw new SocialAuthError(
          "Ce lien de connexion est incomplet ou expiré.",
        );
      const social =
        params.recovery === "1" ? null : await resolveSocialCallback(params);
      const destination = social?.context || {
        next: authReturnPath(params.next),
        referral: normalizeReferral(params.ref),
      };
      if (active) setContext(destination);
      if (callbackError === "access_denied" || errorCode === "access_denied") {
        if (social) await socialAuthAttempts.clear(social.id);
        if (active)
          router.replace({
            pathname: "/login",
            params: {
              ...(destination.next ? { next: destination.next } : {}),
              ...(destination.referral ? { ref: destination.referral } : {}),
            },
          });
        return;
      }
      if (callbackError || description || errorCode)
        throw new SocialAuthError(
          socialCallbackErrorMessage({
            error: callbackError,
            errorCode,
            description,
            provider: social?.provider || params.social,
          }),
        );
      if (social) {
        if (!params.code)
          throw new SocialAuthError(
            "Ce lien de connexion est incomplet ou expiré.",
          );
        const result = await finishSocialCallback(
          params.code,
          social.provider,
          social.context,
          social.id,
        );
        if (!active) return;
        const current = await requireSocialSession(result.session.user.id);
        if (
          !active ||
          !claimAuthNavigation(
            params.code,
            result.session.user.id,
            current.user.id,
          )
        )
          return;
        if (
          result.route !== "/suppression-compte" &&
          !result.route.startsWith("/admin/user/") &&
          !result.route.startsWith("/social-signup") &&
          !result.route.startsWith("/onboarding")
        )
          requestNetworkInvite(result.session);
        router.replace(result.route);
        return;
      }
      const authenticatedUser = params.code
        ? await exchangeAuthCode(params.code)
        : undefined;
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session)
        throw new SocialAuthError(
          "Ce lien de connexion est incomplet ou expiré.",
        );
      if (authenticatedUser && session.user.id !== authenticatedUser)
        throw new SocialAuthError(
          "Le compte connecté a changé. Reconnectez-vous.",
        );
      if (!active) return;
      if (
        params.code &&
        !claimAuthNavigation(params.code, authenticatedUser!, session.user.id)
      )
        return;
      const referral = normalizeReferral(
        session.user.user_metadata?.referrer_id,
      );
      const completion = await postSocialCallbackRoute(session, {
        next: params.next,
        referral,
        recovery: params.recovery === "1",
      });
      if (completion.inviteNetwork) requestNetworkInvite(session);
      router.replace(completion.route);
    })().catch((reason) => {
      // PKCE codes are single-use and the SDK removes the verifier even on
      // failure. A retry must start a new authorization, not replay this code.
      if (active) setError(new Error(socialAuthErrorMessage(reason)));
    });
    return () => {
      active = false;
    };
  }, [
    params.code,
    params.recovery,
    callbackError,
    errorCode,
    description,
    params.social,
    params.attempt,
    params.ref,
    params.next,
    params.invite,
    requestNetworkInvite,
  ]);

  return (
    <Screen title="Connexion">
      {error ? (
        <>
          <ErrorState error={error} />
          <SocialAuthButtons next={context.next} referral={context.referral} />
          <Button
            title="Se connecter avec mon e-mail"
            secondary
            onPress={() =>
              router.replace({
                pathname: "/login",
                params: {
                  ...(context.next ? { next: context.next } : {}),
                  ...(context.referral ? { ref: context.referral } : {}),
                },
              })
            }
          />
        </>
      ) : (
        <Loading />
      )}
    </Screen>
  );
}
