import { authReturnPath, authCallbackPath } from "../lib/authReturn";
import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { exchangeAuthCode, claimAuthNavigation } from "../lib/exchangeAuthCode";
import { normalizeReferral } from "../lib/referral";
import { supabase } from "../lib/supabase";
import { Button, ErrorState, Loading, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { finishSocialCallback } from "../lib/socialAuth";
import { requireSocialSession } from "../lib/appleCredentialRegistration";
import { socialAuthAttempts } from "../lib/socialAuthAttempt";
import {
  socialProvider,
  socialCallbackErrorMessage,
  SocialAuthError,
} from "../lib/socialAuthPolicy";
function isTransientAuthCallbackError(error: unknown) {
  const value = error as { status?: unknown; code?: unknown; message?: unknown };
  const text = String(value?.message || error || "").toLowerCase();
  return (
    value?.status === 503 ||
    value?.code === 503 ||
    text.includes("503") ||
    text.includes("service unavailable") ||
    text.includes("network request failed") ||
    text.includes("failed to fetch") ||
    text.includes("load failed")
  );
}

async function waitBeforeRetry(ms: number, active: () => boolean) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  if (!active()) throw new Error("callback_cancelled");
}

async function withAuthCallbackRetry<T>(
  run: () => Promise<T>,
  active: () => boolean,
  onRetry: (attempt: number) => void,
) {
  const delays = [900, 1800, 3200];
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!active() || attempt >= delays.length || !isTransientAuthCallbackError(error))
        throw error;
      onRetry(attempt + 1);
      await waitBeforeRetry(delays[attempt], active);
    }
  }
  throw lastError;
}

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
  const [status, setStatus] = useState("Connexion en cours…");
  useEffect(() => {
    let active = true;
    void withAuthCallbackRetry(
      async () => {
        setError(null);
        let authenticatedUser: string | undefined;
        if (params.error === "access_denied") {
          if (params.attempt) await socialAuthAttempts.clear(params.attempt);
          if (active)
            router.replace({
              pathname: "/login",
              params: {
                ...(authReturnPath(params.next)
                  ? { next: authReturnPath(params.next)! }
                  : {}),
                ...(normalizeReferral(params.ref)
                  ? { ref: normalizeReferral(params.ref)! }
                  : {}),
              },
            });
          return;
        }
        if (params.error || params.error_description)
          throw new SocialAuthError(
            socialCallbackErrorMessage({
              error: params.error,
              errorCode: params.error_code,
              description: params.error_description,
              provider: params.social,
            }),
          );
        const provider = socialProvider(params.social);
        if (params.social && (!provider || params.recovery === "1"))
          throw new SocialAuthError(
            "Ce lien de connexion est incomplet ou expiré.",
          );
        if (provider && params.recovery !== "1") {
          if (!params.code)
            throw new SocialAuthError(
              "Ce lien de connexion est incomplet ou expiré.",
            );
          const result = await finishSocialCallback(
            params.code,
            provider,
            {
              next: authReturnPath(params.next),
              referral: normalizeReferral(params.ref),
            },
            params.attempt,
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
            !result.route.startsWith("/social-signup")
          )
            requestNetworkInvite(result.session);
          router.replace(result.route);
          return;
        }
        if (params.code) {
          authenticatedUser = await exchangeAuthCode(params.code);
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session)
            throw new Error("Ce lien de connexion est incomplet ou expiré.");
        }
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session)
          throw new Error("Votre session a expiré. Reconnectez-vous.");
        if (authenticatedUser && session.user.id !== authenticatedUser)
          throw new Error(
            "Le compte connecté a changé. Ouvrez à nouveau votre invitation avec le bon compte.",
          );
        const referral = normalizeReferral(
          session?.user.user_metadata?.referrer_id,
        );
        if (active) {
          if (
            params.code &&
            !claimAuthNavigation(
              params.code,
              authenticatedUser!,
              session.user.id,
            )
          )
            return;
          if (params.recovery !== "1" && params.next !== "/suppression-compte")
            requestNetworkInvite(session);
          router.replace(
            authCallbackPath(params.recovery === "1", !!referral, params.next),
          );
        }
      },
      () => active,
      (attempt) => {
        if (active) setStatus(`Service indisponible, nouvelle tentative ${attempt}/3…`);
      },
    ).catch((e) => {
      if (active && e instanceof Error && e.message === "callback_cancelled") return;
      if (active) setError(new Error(e instanceof Error ? e.message : "Connexion impossible."));
    });
    return () => {
      active = false;
    };
  }, [
    params.code,
    params.recovery,
    params.error_description,
    params.error_code,
    params.error,
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
          <Button
            title="Réessayer avec Google"
            onPress={() =>
              router.replace({
                pathname: "/login",
                params: {
                  ...(authReturnPath(params.next)
                    ? { next: authReturnPath(params.next)! }
                    : {}),
                  ...(normalizeReferral(params.ref)
                    ? { ref: normalizeReferral(params.ref)! }
                    : {}),
                  ...(params.social === "google"
                    ? { retrySocial: "google" }
                    : {}),
                },
              })
            }
          />
          <Button
            title="Se connecter avec mon e-mail"
            secondary
            onPress={() =>
              router.replace({
                pathname: "/login",
                params: {
                  ...(authReturnPath(params.next)
                    ? { next: authReturnPath(params.next)! }
                    : {}),
                  ...(normalizeReferral(params.ref)
                    ? { ref: normalizeReferral(params.ref)! }
                    : {}),
                },
              })
            }
          />
        </>
      ) : (
        <View style={{ gap: 12, alignItems: "center" }}>
          <Loading />
          <Text style={{ color: "#64748B", textAlign: "center" }}>{status}</Text>
        </View>
      )}
    </Screen>
  );
}
