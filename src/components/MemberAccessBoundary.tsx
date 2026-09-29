import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { declaredAge, memberAccessPublicPath } from "../lib/memberAccess";
import { BirthdateField } from "./BirthdateField";
import { Button, Field, Loading, Screen, useUIStyles } from "./ui";
import { authGateReturnPath } from "../lib/authReturn";
import { socialSignupPath } from "../lib/socialOnboarding";

export function MemberAccessBoundary({
  children,
  path,
}: {
  children: React.ReactNode;
  path: string;
}) {
  const { session, loading, memberAccess } = useAuth();
  const params = useLocalSearchParams();
  if (!session || memberAccess?.allowed || memberAccessPublicPath(path))
    return <>{children}</>;
  if (
    !loading &&
    memberAccess?.onboarding_required &&
    memberAccess.state !== "underage"
  )
    return (
      <Redirect href={socialSignupPath(authGateReturnPath(path, params))} />
    );
  return loading ? (
    <Screen title="Vérification du compte" back={false}>
      <Loading />
    </Screen>
  ) : (
    <AccessForm key={session.user.id} />
  );
}
function AccessForm() {
  const s = useUIStyles();
  const { session, memberAccess, reload } = useAuth();
  const uid = session!.user.id;
  const [birthdate, setBirthdate] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const state = memberAccess?.state;
  const waiting = state === "parent_required" || state === "parent_pending";
  const canResend =
    !memberAccess?.resend_available_at ||
    Date.parse(memberAccess.resend_available_at) <= Date.now();
  async function action(fn: (accessToken: string) => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const current = await supabase.auth.getSession();
      if (current.error || current.data.session?.user.id !== uid)
        throw new Error("La session a changé. Reconnecte-toi.");
      await fn(current.data.session.access_token);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Cette action n’a pas abouti. Réessaie.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen title="Ton compte FootNation" back={false}>
      {!memberAccess ? (
        <>
          <Text style={s.h2}>Vérification indisponible</Text>
          <Text style={s.text}>
            Nous devons vérifier l’accès à ton compte avant de continuer.
            Réessaie dans un instant.
          </Text>
        </>
      ) : state === "birthdate_required" ? (
        <>
          <Text style={s.h2}>Quelle est ta date de naissance ?</Text>
          <Text style={s.text}>
            FootNation est accessible dès 13 ans. De 13 à 15 ans, une
            autorisation parentale est nécessaire. Cette date sert à vérifier
            l’accès à ton compte.
          </Text>
          <BirthdateField
            minAge={0}
            value={birthdate}
            onChange={setBirthdate}
            disabled={busy}
          />
          <Text style={s.small}>
            Vérifie la date avant de confirmer. Une correction nécessitera
            l’aide de l’équipe FootNation.
          </Text>
          <Button
            title="Confirmer ma date de naissance"
            busy={busy}
            disabled={declaredAge(birthdate) === null}
            onPress={() =>
              void action(async (accessToken) => {
                const result = await supabase
                  .rpc("declare_member_birthdate", { p_birthdate: birthdate })
                  .setHeader("Authorization", "Bearer " + accessToken);
                if (result.error)
                  throw new Error(
                    "La date n’a pas pu être confirmée. Vérifie ta connexion puis réessaie.",
                  );
                await reload();
              })
            }
          />
        </>
      ) : state === "underage" ? (
        <>
          <Text style={s.h2}>FootNation est accessible dès 13 ans</Text>
          <Text style={s.text}>
            Ton compte est restreint. Tes données n’ont pas été supprimées. Si
            ta date de naissance est incorrecte, contacte l’aide.
          </Text>
        </>
      ) : state === "parent_refused" ? (
        <>
          <Text style={s.h2}>Autorisation refusée</Text>
          <Text style={s.text}>
            Ton parent a refusé cette demande. Le compte reste restreint.
            Contacte l’aide avec ton parent si vous souhaitez revoir cette
            décision.
          </Text>
        </>
      ) : waiting ? (
        <>
          <Text style={s.h2}>
            {state === "parent_pending" || sent
              ? "En attente de ton parent"
              : "L’accord de ton parent est nécessaire"}
          </Text>
          <Text style={s.text}>
            Entre 13 et 15 ans, ton parent doit autoriser l’utilisation de
            FootNation. Le lien lui permet de lire la demande, puis de
            l’accepter ou de la refuser. Il est valable 48 heures.
          </Text>
          <Field
            label="Adresse e-mail de ton parent"
            value={parentEmail}
            onChangeText={setParentEmail}
            editable={!busy}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
          <Button
            title={
              state === "parent_pending"
                ? "Renvoyer la demande"
                : "Demander l’autorisation"
            }
            busy={busy}
            disabled={
              !canResend ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim()) ||
              parentEmail.trim().toLowerCase() ===
                session?.user.email?.toLowerCase()
            }
            onPress={() =>
              void action(async (accessToken) => {
                const result = await supabase.functions.invoke("age-consent", {
                  headers: { Authorization: "Bearer " + accessToken },
                  body: { action: "request", parentEmail: parentEmail.trim() },
                });
                if (result.error || result.data?.status !== "sent")
                  throw new Error(
                    "La demande n’a pas pu être envoyée. Vérifie l’adresse et réessaie plus tard.",
                  );
                setSent(true);
                setParentEmail("");
                await reload();
              })
            }
          />
          {!canResend && (
            <Text style={s.small}>
              Une demande vient d’être envoyée. Tu pourras la renvoyer après{" "}
              {new Date(memberAccess!.resend_available_at!).toLocaleTimeString(
                "fr-FR",
                { hour: "2-digit", minute: "2-digit" },
              )}
              .
            </Text>
          )}
          {!!sent && (
            <Text accessibilityLiveRegion="polite" style={s.text}>
              La demande a été envoyée. Pense à vérifier les courriers
              indésirables avec ton parent.
            </Text>
          )}
        </>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={s.text}>
          {error}
        </Text>
      ) : null}
      <Button
        title={
          waiting
            ? "Mon parent a répondu : vérifier"
            : "Réessayer la vérification"
        }
        secondary
        busy={busy}
        onPress={() => void action(reload)}
      />
      <View style={{ gap: 12 }}>
        <Button
          title="Obtenir de l’aide"
          secondary
          onPress={() => router.push("/help")}
        />
        <Button
          title="Demander la suppression de mon compte"
          secondary
          onPress={() => router.push("/suppression-compte")}
        />
        <Button
          title="Se déconnecter"
          secondary
          busy={busy}
          onPress={() =>
            void action(async () => {
              const result = await supabase.auth.signOut({ scope: "local" });
              if (result.error)
                throw new Error("La déconnexion a échoué. Réessaie.");
            })
          }
        />
      </View>
    </Screen>
  );
}
