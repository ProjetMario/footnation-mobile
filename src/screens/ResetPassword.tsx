import { authReturnPath } from "../lib/authReturn";
import { socialAuthAttempts } from "../lib/socialAuthAttempt";
import React, { useState } from "react";
import { Text } from "react-native";
import * as AuthSession from "expo-auth-session";
import { useMutation } from "@tanstack/react-query";
import { supabase, requireBackend } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { accountChangePayload } from "../lib/accountChange";
import {
  Button,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { validEmail, strongPassword } from "../lib/validation";
import { router, useLocalSearchParams } from "expo-router";
export default function ResetPassword() {
  const { recovery, next: destination } = useLocalSearchParams<{
    recovery?: string;
    next?: string;
  }>();
  const next = authReturnPath(destination);
  const { session } = useAuth();
  return (
    <ResetForm
      key={`${session?.user.id || "anonymous"}/${recovery}/${next || ""}`}
      recovery={recovery === "1"}
      next={next}
    />
  );
}
function ResetForm({
  recovery,
  next,
}: {
  recovery: boolean;
  next: string | null;
}) {
  const s = useUIStyles();

  const { session, loading } = useAuth();
  const uid = session?.user.id;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      requireBackend();
      if (recovery) {
        const payload = accountChangePayload("password", "", password, repeat);
        const auth = await supabase.auth.getUser();
        if (auth.error) throw auth.error;
        if (!uid || auth.data.user?.id !== uid)
          throw new Error(
            "Votre session a changé ou a expiré. Ouvrez à nouveau le lien de récupération.",
          );
        const result = await supabase.auth.updateUser(payload);
        if (result.error) throw result.error;
      } else {
        if (!validEmail(email))
          throw new Error("Indiquez une adresse email valide.");
        await socialAuthAttempts.beginEmail();
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: AuthSession.makeRedirectUri({
            scheme: "com.footnation.app",
            path: "auth/callback",
            queryParams: { recovery: "1", ...(next ? { next } : {}) },
          }),
        });
        if (result.error) throw result.error;
      }
    },
    onSuccess: () => {
      setPassword("");
      setRepeat("");
    },
  });
  return (
    <Screen title="Mot de passe">
      {recovery && loading ? (
        <Loading />
      ) : recovery && !uid ? (
        <>
          <Text style={s.text}>
            Ouvrez le lien reçu par email pour choisir un nouveau mot de passe.
          </Text>
          <Button
            title="Demander un nouveau lien"
            onPress={() =>
              router.replace({
                pathname: "/reset-password",
                params: next ? { next } : {},
              })
            }
          />
        </>
      ) : mutation.isSuccess ? (
        <>
          <Text style={s.text}>
            {recovery
              ? "Votre mot de passe a été modifié."
              : "Si un compte correspond à cette adresse, un e-mail de réinitialisation vous a été envoyé."}
          </Text>
          <Button
            title={
              recovery
                ? next
                  ? "Retrouver le profil partagé"
                  : "Continuer vers l’accueil"
                : "Retour à la connexion"
            }
            onPress={() =>
              recovery
                ? router.replace(next || "/")
                : router.replace({
                    pathname: "/login",
                    params: next ? { next } : {},
                  })
            }
          />
          {!recovery && (
            <Button
              secondary
              title="Utiliser une autre adresse"
              onPress={() => {
                mutation.reset();
                setEmail("");
              }}
            />
          )}
        </>
      ) : (
        <>
          {recovery ? (
            <>
              <Text style={s.subtitle}>
                Choisissez au moins 8 caractères avec une majuscule, une
                minuscule et un chiffre.
              </Text>
              <Field
                label="Nouveau mot de passe"
                secureTextEntry
                value={password}
                onChangeText={(value) => {
                  mutation.reset();
                  setPassword(value);
                }}
                editable={!mutation.isPending}
                autoCapitalize="none"
                autoComplete="new-password"
              />
              <Field
                label="Confirmer le mot de passe"
                secureTextEntry
                value={repeat}
                onChangeText={(value) => {
                  mutation.reset();
                  setRepeat(value);
                }}
                editable={!mutation.isPending}
                autoCapitalize="none"
                autoComplete="new-password"
              />
            </>
          ) : (
            <>
              <Text style={s.subtitle}>
                Saisissez votre adresse e-mail pour recevoir un lien de
                réinitialisation.
              </Text>
              <Field
                label="Adresse e-mail"
                value={email}
                onChangeText={(value) => {
                  mutation.reset();
                  setEmail(value);
                }}
                editable={!mutation.isPending}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </>
          )}
          {!!mutation.error && <ErrorState error={mutation.error} />}
          <Button
            title={
              recovery ? "Enregistrer le mot de passe" : "Recevoir le lien"
            }
            onPress={() => mutation.mutate()}
            busy={mutation.isPending}
            disabled={
              recovery
                ? !strongPassword(password) || password !== repeat
                : !validEmail(email)
            }
          />
        </>
      )}
    </Screen>
  );
}
