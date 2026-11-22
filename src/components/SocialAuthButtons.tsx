import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useFonts } from "expo-font";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react-native";
import { useTheme } from "../theme";
import { useAuth } from "../lib/auth";
import { socialAuthFlow } from "../lib/socialAuth";
import { getSocialAuthProviders } from "../lib/socialAuthProviders";
import { backendConfigured } from "../lib/supabase";
import { claimAuthNavigation } from "../lib/exchangeAuthCode";
import { requireSocialSession } from "../lib/appleCredentialRegistration";
import {
  enabledSocialProviders,
  socialAuthErrorMessage,
  type SocialProvider,
} from "../lib/socialAuthPolicy";

export function SocialAuthButtons({
  next,
  referral,
  disabled,
  onBusyChange,
  intent = "signin",
  autoStartProvider,
}: {
  next?: string | null;
  referral?: string | null;
  disabled?: boolean;
  intent?: "signin" | "signup";
  onBusyChange?: (busy: boolean) => void;
  autoStartProvider?: SocialProvider;
}) {
  const { colors, mode } = useTheme();
  const [googleFontReady] = useFonts({
    GoogleSansSignin: require("../../assets/auth/GoogleSans-Medium-signin.ttf"),
  });
  const { requestNetworkInvite } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const {
    busy,
    result,
    error: flowError,
  } = useSyncExternalStore(
    socialAuthFlow.subscribe,
    socialAuthFlow.getSnapshot,
    socialAuthFlow.getSnapshot,
  );
  const [completionError, setCompletionError] = useState("");
  const error = flowError || completionError;
  const availability = useQuery({
    queryKey: ["social-auth-providers"],
    queryFn: getSocialAuthProviders,
    enabled: backendConfigured,
    staleTime: 60000,
    retry: false,
  });
  const busyListener = useRef(onBusyChange);
  busyListener.current = onBusyChange;
  useEffect(() => {
    busyListener.current?.(!!busy);
  }, [busy]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (Platform.OS === "ios")
      void AppleAuthentication.isAvailableAsync()
        .then((available) => {
          if (mounted.current) setAppleAvailable(available);
        })
        .catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, []);
  const providers = enabledSocialProviders({
    google:
      process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED !== "false" &&
      availability.data?.google
        ? "true"
        : "false",
    apple:
      process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED !== "false" &&
      availability.data?.apple
        ? "true"
        : "false",
    platform: Platform.OS,
    appleAvailable,
  });
  const locked = !!disabled || !!busy;
  function start(provider: SocialProvider) {
    if (locked || !providers[provider]) return;
    setCompletionError("");
    void socialAuthFlow.start(provider, { next, referral });
  }
  useEffect(() => {
    if (!result) return;
    let active = true;
    void requireSocialSession(result.session.user.id)
      .then((current) => {
        if (!active) return;
        if (
          claimAuthNavigation(
            result.claim,
            result.session.user.id,
            current.user.id,
          )
        ) {
          if (
            result.route !== "/suppression-compte" &&
            !result.route.startsWith("/admin/user/") &&
            !result.route.startsWith("/social-signup") &&
            !result.route.startsWith("/onboarding")
          )
            requestNetworkInvite(result.session);
          router.replace(result.route);
        }
        socialAuthFlow.consume(result);
      })
      .catch((reason) => {
        if (!active) return;
        setCompletionError(socialAuthErrorMessage(reason));
        socialAuthFlow.consume(result);
      });
    return () => {
      active = false;
    };
  }, [result, requestNetworkInvite]);
  useEffect(() => {
    if (
      autoStartProvider &&
      providers[autoStartProvider] &&
      !locked &&
      !result
    ) {
      router.setParams({ retrySocial: undefined });
      start(autoStartProvider);
    }
  }, [autoStartProvider, providers.google, providers.apple]);
  if (availability.isError)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Réessayer de charger Google et Apple"
        onPress={() => void availability.refetch()}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
        }}
      >
        <RefreshCw size={20} color={colors.blue} />
        <Text style={{ color: colors.muted, flex: 1 }}>
          Google et Apple sont momentanément indisponibles. Réessayer
        </Text>
      </Pressable>
    );
  if (!providers.google && !providers.apple) return null;
  const dark = mode === "dark";
  return (
    <View style={{ gap: 12 }}>
      {providers.google && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continuer avec Google"
          accessibilityState={{ disabled: locked, busy: busy === "google" }}
          disabled={locked}
          onPress={() => void start("google")}
          style={({ pressed }) => ({
            minHeight: 50,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: dark ? "#8E918F" : "#747775",
            backgroundColor: dark ? "#131314" : "#FFFFFF",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            paddingHorizontal: 16,
            opacity: locked || pressed ? 0.5 : 1,
          })}
        >
          <Image
            source={require("../../assets/auth/google-g.png")}
            style={{ width: 20, height: 20 }}
            resizeMode="contain"
            accessibilityElementsHidden
          />
          <Text
            style={{
              fontSize: 16,
              fontFamily: googleFontReady ? "GoogleSansSignin" : undefined,
              fontWeight: "500",
              color: dark ? "#E3E3E3" : "#1F1F1F",
            }}
          >
            Continuer avec Google
          </Text>
        </Pressable>
      )}
      {providers.apple &&
        (Platform.OS === "ios" ? (
          <View
            pointerEvents={locked ? "none" : "auto"}
            style={{ opacity: locked ? 0.5 : 1 }}
          >
            <AppleAuthentication.AppleAuthenticationButton
              accessibilityLabel="Continuer avec Apple"
              accessibilityState={{ disabled: locked, busy: busy === "apple" }}
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
              }
              buttonStyle={
                dark
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={8}
              style={{ width: "100%", height: 50 }}
              onPress={() => void start("apple")}
            />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continuer avec Apple"
            accessibilityState={{ disabled: locked, busy: busy === "apple" }}
            disabled={locked}
            onPress={() => void start("apple")}
            style={({ pressed }) => ({
              height: 50,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: dark ? "#FFFFFF" : "#000000",
              opacity: locked || pressed ? 0.5 : 1,
            })}
          >
            <Image
              source={
                dark
                  ? require("../../assets/auth/apple-continue-white.png")
                  : require("../../assets/auth/apple-continue-black.png")
              }
              style={{ width: 280, height: 50, maxWidth: "100%" }}
              resizeMode="contain"
              accessibilityElementsHidden
            />
          </Pressable>
        ))}
      {!!busy && (
        <ActivityIndicator
          accessibilityLabel="Connexion en cours"
          color={colors.blue}
        />
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ color: colors.danger }}
        >
          {error}
        </Text>
      )}
      {intent === "signup" && (
        <Text
          style={{ color: colors.muted, textAlign: "center", fontSize: 13 }}
        >
          Ou avec votre e-mail
        </Text>
      )}
    </View>
  );
}
