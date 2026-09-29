import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { authCallbackPath, authReturnPath } from "../lib/authReturn";
import { normalizeReferral } from "../lib/referral";
import {
  completeSocialSignup,
  getSocialSignupStatus,
  socialSignupError,
  type SocialSignupValues,
} from "../lib/socialOnboarding";
import { roleOptions } from "../lib/networkOptions";
import { BirthdateField } from "../components/BirthdateField";
import { ChoiceField } from "../components/ChoiceField";
import { Button, Field, Loading, Screen, useUIStyles } from "../components/ui";

const accountOptions = [
  { value: "personal", label: "Pour moi" },
  { value: "club", label: "Club de football" },
  { value: "business", label: "Entreprise / Marque" },
  { value: "institution", label: "Institution" },
];

export default function SocialSignup() {
  const { session, loading, memberAccess } = useAuth();
  const params = useLocalSearchParams<{ next?: string; ref?: string }>();
  const s = useUIStyles();
  if (loading)
    return (
      <Screen title="Votre profil">
        <Loading />
      </Screen>
    );
  if (!session)
    return (
      <Screen title="Votre profil">
        <Text style={s.text}>
          Reconnectez-vous pour terminer votre inscription.
        </Text>
        <Button
          title="Se connecter"
          onPress={() =>
            router.replace({
              pathname: "/login",
              params: {
                next: authReturnPath(params.next) || "/",
                ref: normalizeReferral(params.ref) || "",
              },
            })
          }
        />
      </Screen>
    );
  if (memberAccess?.state === "underage") return <Redirect href="/" />;
  return <CompletionForm key={session.user.id} userId={session.user.id} />;
}

function CompletionForm({ userId }: { userId: string }) {
  const s = useUIStyles();
  const { reload } = useAuth();
  const params = useLocalSearchParams<{ next?: string; ref?: string }>();
  const next = authReturnPath(params.next);
  const referral = normalizeReferral(params.ref);
  const [values, setValues] = useState<SocialSignupValues>({
    fullName: "",
    username: "",
    birthdate: "",
    accountType: "personal",
    role: "",
    acceptedTerms: false,
  });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [birthdateDeclared, setBirthdateDeclared] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    let valid = true;
    setLoading(true);
    setError("");
    void getSocialSignupStatus(userId)
      .then((status) => {
        if (!valid) return;
        if (!status.required) {
          router.replace(authCallbackPath(false, !!referral, next));
          return;
        }
        setValues((previous) => ({
          ...previous,
          fullName: previous.fullName || status.fullName,
          username: previous.username || status.username,
          birthdate: status.birthdate || previous.birthdate,
          accountType: ready ? previous.accountType : status.accountType,
          role: previous.role || status.role,
        }));
        setBirthdateDeclared(!!status.birthdate);
        setReady(true);
      })
      .catch((reason) => {
        if (valid) setError(reason.message);
      })
      .finally(() => {
        if (valid) setLoading(false);
      });
    return () => {
      valid = false;
    };
  }, [userId, retry, next, referral]);
  const change = <K extends keyof SocialSignupValues>(
    key: K,
    value: SocialSignupValues[K],
  ) => setValues((previous) => ({ ...previous, [key]: value }));
  async function complete() {
    if (pending.current) return;
    const invalid = socialSignupError(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await completeSocialSignup(userId, values, referral);
      await reload();
      const current = await supabase.auth.getSession();
      if (
        !current.error &&
        current.data.session?.user.id === userId &&
        active.current
      )
        router.replace(authCallbackPath(false, !!referral, next));
    } catch (reason) {
      if (active.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Réessayez dans un instant.",
        );
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <Screen title="Bienvenue sur FootNation" back={false}>
      <Text style={s.h2}>Complétez votre profil</Text>
      <Text style={s.text}>
        Votre connexion est sécurisée. Quelques informations restent nécessaires
        avant de rejoindre la communauté.
      </Text>
      {loading ? (
        <Loading />
      ) : ready ? (
        <>
          <ChoiceField
            label="Ce profil représente"
            value={values.accountType}
            options={accountOptions}
            optional={false}
            disabled={busy}
            onChange={(value) =>
              change("accountType", value as SocialSignupValues["accountType"])
            }
          />
          <Field
            label={
              values.accountType === "personal"
                ? "Prénom et nom"
                : "Nom du club ou de l’organisation"
            }
            value={values.fullName}
            onChangeText={(value) => change("fullName", value)}
            editable={!busy}
            maxLength={120}
            autoComplete="name"
          />
          <Field
            label="Pseudo"
            value={values.username}
            onChangeText={(value) =>
              change("username", value.toLowerCase().replace(/^@+/, ""))
            }
            editable={!busy}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
          />
          {values.accountType === "personal" && (
            <ChoiceField
              label="Votre rôle dans le football"
              value={values.role}
              options={roleOptions}
              optional={false}
              disabled={busy}
              onChange={(value) => change("role", value)}
            />
          )}
          <BirthdateField
            label={
              values.accountType === "personal"
                ? "Votre date de naissance"
                : "Votre date de naissance (responsable du compte)"
            }
            value={values.birthdate}
            onChange={(value) => change("birthdate", value)}
            disabled={busy || birthdateDeclared}
            minAge={0}
          />
          <Text style={s.small}>
            FootNation est accessible dès 13 ans. De 13 à 15 ans, l’accord d’un
            parent est nécessaire. Vérifiez votre date : elle ne pourra pas être
            modifiée ici.
          </Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: values.acceptedTerms,
              disabled: busy,
            }}
            disabled={busy}
            onPress={() => change("acceptedTerms", !values.acceptedTerms)}
            style={{ minHeight: 48, paddingVertical: 12 }}
          >
            <Text style={s.text}>
              {values.acceptedTerms ? "☑" : "☐"} J’accepte les conditions
              d’utilisation et j’ai pris connaissance de la politique de
              confidentialité.
            </Text>
          </Pressable>
          <View style={{ gap: 8 }}>
            <Button
              title="Conditions d’utilisation"
              secondary
              disabled={busy}
              onPress={() => router.push("/cgu")}
            />
            <Button
              title="Politique de confidentialité"
              secondary
              disabled={busy}
              onPress={() => router.push("/politique-confidentialite")}
            />
          </View>
        </>
      ) : null}
      {!!error && (
        <Text accessibilityRole="alert" style={s.text}>
          {error}
        </Text>
      )}
      {ready ? (
        <Button
          title="Terminer mon inscription"
          busy={busy}
          disabled={loading}
          onPress={() => void complete()}
        />
      ) : (
        !loading && (
          <Button
            title="Réessayer"
            onPress={() => setRetry((value) => value + 1)}
          />
        )
      )}
      <Button
        title="Obtenir de l’aide"
        secondary
        disabled={busy}
        onPress={() => router.push("/help")}
      />
      <Button
        title="Supprimer mon compte"
        secondary
        disabled={busy}
        onPress={() => router.push("/suppression-compte")}
      />
      <Button
        title="Se déconnecter"
        secondary
        disabled={busy}
        onPress={() => {
          void supabase.auth.signOut({ scope: "local" }).then((result) => {
            if (result.error) setError("La déconnexion a échoué. Réessayez.");
            else router.replace("/login");
          });
        }}
      />
    </Screen>
  );
}
