import { authEntryPath } from "../lib/authReturn";
import React, { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router, Redirect, useLocalSearchParams } from "expo-router";
import { supabase, requireBackend } from "../lib/supabase";
import { Screen, Brand, Field, Button, useUIStyles } from "../components/ui";
import { normalizeReferral } from "../lib/referral";
import { useTheme } from "../theme";
import { useAuth } from "../lib/auth";

import { SocialAuthButtons } from "../components/SocialAuthButtons";
import { socialAuthAttempts } from "../lib/socialAuthAttempt";
export default function Login() {
  const { colors } = useTheme();
  const s = useUIStyles();

  const { requestNetworkInvite, session } = useAuth();
  const params = useLocalSearchParams<{
    mode?: string;
    ref?: string;
    next?: string;
    teamInvite?: string;
    retrySocial?: string;
  }>();
  const next = authEntryPath(params);
  const referral = normalizeReferral(params.ref);
  const pending = useRef(false);
  const passwordRef = useRef<TextInput>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState<"password" | "social" | null>(null),
    [error, setError] = useState("");
  async function login() {
    if (pending.current || !email.trim() || !password) return;
    pending.current = true;
    setBusy("password");
    setError("");
    try {
      requireBackend();
      await socialAuthAttempts.beginEmail();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      const current = await supabase.auth.getSession();
      if (current.error) throw current.error;
      if (
        !data.session ||
        current.data.session?.user.id !== data.session.user.id
      )
        return;
      if (data.session && next !== "/suppression-compte")
        requestNetworkInvite(data.session);
      router.replace(next || "/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }
  if (session && next?.startsWith("/member/invitations"))
    return (
      <Screen title="Invitation d’équipe">
        <Text style={s.subtitle}>
          Votre compte est connecté. Retrouvez l’invitation de votre coach pour
          rejoindre son équipe.
        </Text>
        <Button
          title="Ouvrir mon invitation d’équipe"
          onPress={() => router.replace(next)}
        />
      </Screen>
    );
  if (params.mode === "signup")
    return (
      <Redirect
        href={{
          pathname: "/signup",
          params: {
            ...(referral ? { ref: referral } : {}),
            ...(next ? { next } : {}),
          },
        }}
      />
    );
  return (
    <Screen title="Connexion">
      <View style={{ gap: 24 }}>
        <View style={{ paddingVertical: 24, gap: 20 }}>
          <Brand />
          <Text accessibilityRole="header" style={s.title}>
            {"Votre réseau.\nVotre passion.\nVotre football."}
          </Text>
          <Text style={s.subtitle}>
            Retrouvez toute la communauté FootNation.
          </Text>
        </View>
        <Field
          label="Adresse e-mail"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          autoCorrect={false}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <Field
          label="Mot de passe"
          inputRef={passwordRef}
          value={password}
          onChangeText={setPassword}
          editable={!busy}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => void login()}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showPassword
              ? "Masquer le mot de passe"
              : "Afficher le mot de passe"
          }
          accessibilityState={{ disabled: !!busy }}
          disabled={!!busy}
          onPress={() => setShowPassword((visible) => !visible)}
          style={({ pressed }) => ({
            alignSelf: "flex-end",
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 12,
            opacity: busy || pressed ? 0.5 : 1,
          })}
        >
          <Text style={{ color: colors.blue, fontWeight: "700" }}>
            {showPassword ? "Masquer" : "Voir"}
          </Text>
        </Pressable>
        {!!error && (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{ color: colors.danger }}
          >
            {error}
          </Text>
        )}
        <Button
          title="Se connecter"
          onPress={() => void login()}
          busy={busy === "password"}
          disabled={!!busy || !email.trim() || !password}
        />
        <SocialAuthButtons
          next={next}
          referral={referral}
          autoStartProvider={params.retrySocial === "google" ? "google" : undefined}
          disabled={busy === "password"}
          onBusyChange={(value) => {
            pending.current = value;
            setBusy(value ? "social" : null);
          }}
        />
        <Button
          title="Créer mon profil gratuitement"
          disabled={!!busy}
          secondary
          onPress={() =>
            router.push({
              pathname: "/signup",
              params: {
                ...(next ? { next } : {}),
                ...(referral ? { ref: referral } : {}),
              },
            })
          }
        />
        <Button
          title="Mot de passe oublié"
          disabled={!!busy}
          secondary
          onPress={() =>
            router.push({
              pathname: "/reset-password",
              params: next ? { next } : {},
            })
          }
        />
      </View>
    </Screen>
  );
}
