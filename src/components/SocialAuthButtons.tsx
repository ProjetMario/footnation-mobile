import React, { useEffect, useRef, useState } from "react";
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
import { useTheme } from "../theme";
import { useAuth } from "../lib/auth";
import { signInSocial } from "../lib/socialAuth";
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
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState("");
  const pending = useRef(false);
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
  const configuredProviders = enabledSocialProviders({
    google: process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED,
    apple: process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED,
    platform: Platform.OS,
    appleAvailable,
  });
  const providers =
    intent === "signup"
      ? {
          google: true,
          apple: Platform.OS === "ios" ? appleAvailable : true,
        }
      : configuredProviders;
  const locked = !!disabled || !!busy;
  async function start(provider: SocialProvider) {
    if (pending.current || locked || !providers[provider]) return;
    pending.current = true;
    setBusy(provider);
    setError("");
    onBusyChange?.(true);
    try {
      const result = await signInSocial(provider, { next, referral });
      if (!result || !mounted.current) return;
      const current = await requireSocialSession(result.session.user.id);
      if (
        !mounted.current ||
        !claimAuthNavigation(
          result.claim,
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
    } catch (reason) {
      if (mounted.current) setError(socialAuthErrorMessage(reason));
    } finally {
      pending.current = false;
      if (mounted.current) {
        setBusy(null);
        onBusyChange?.(false);
      }
    }
  }
  useEffect(() => {
    if (autoStartProvider) void start(autoStartProvider);
  }, [autoStartProvider]);
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
        <Text style={{ color: colors.muted, textAlign: "center", fontSize: 13 }}>
          Ou avec votre e-mail
        </Text>
      )}
    </View>
  );
}
