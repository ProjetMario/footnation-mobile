import { authReturnPath } from "../lib/authReturn";
import { socialAuthAttempts } from "../lib/socialAuthAttempt";
import React, { useEffect, useState } from "react";
import { Platform, Text } from "react-native";
import { authRedirectUri } from "../lib/authRedirectUri";
import { useMutation } from "@tanstack/react-query";
import { supabase, requireBackend } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { accountChangePayload } from "../lib/accountChange";
import {
  createLegacyRecoveryRestorer,
  legacyRecoveryTokens,
} from "../lib/legacyWebRecovery";
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
const restoreLegacyRecovery = createLegacyRecoveryRestorer(supabase.auth);
export default function ResetPassword() {
  const { recovery, next: destination } = useLocalSearchParams<{
    recovery?: string;
    next?: string;
  }>();
  const next = authReturnPath(destination);
  const { session } = useAuth();
  const [legacyError, setLegacyError] = useState<Error | null>(null);
  const [legacyLink] = useState(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return null;
    try {
      return { tokens: legacyRecoveryTokens(window.location.hash) };
    } catch (error) {
      return { error: error as Error };
    }
  });
  const restoring =
    !!legacyLink && ("error" in legacyLink || !!legacyLink.tokens);
  useEffect(() => {
    if (!restoring || !legacyLink) return;
    // Consume the existing old email fragment locally. No token is put in a
    // new URL, analytics event, error message or browser storage other than Auth.
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    if ("error" in legacyLink) {
      setLegacyError(
        legacyLink.error || new Error("Ce lien de récupération est incomplet."),
      );
      return;
    }
    void restoreLegacyRecovery(legacyLink.tokens!)
      .then(() => {
        const target = new URL(
          window.location.pathname,
          window.location.origin,
        );
        target.searchParams.set("recovery", "1");
        if (next) target.searchParams.set("next", next);
        window.location.replace(target.toString());
      })
      .catch((error) =>
        setLegacyError(
          error instanceof Error
            ? error
            : new Error("Ce lien de récupération ne peut pas être vérifié."),
        ),
      );
  }, [legacyLink, next, restoring]);
  if (restoring)
    return (
      <Screen title="Mot de passe">
        {legacyError ? <ErrorState error={legacyError} /> : <Loading />}
      </Screen>
    );
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
          redirectTo: authRedirectUri({
            recovery: "1",
            ...(next ? { next } : {}),
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
