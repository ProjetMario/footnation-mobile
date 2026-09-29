import React, { useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import { Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { parentalConsentToken } from "../lib/memberAccess";
import { Button, Loading, Screen, useUIStyles } from "../components/ui";

export default function ParentalConsent() {
  const s = useUIStyles();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "error" | "approved" | "refused"
  >("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    let alive = true;
    async function inspect(url: string | null) {
      const current = ++generation.current;
      const value = parentalConsentToken(url);
      setToken(null);
      setState("loading");
      if (!value) {
        if (alive) {
          setState("error");
          setError("Ce lien est incomplet. Ouvre le lien reçu par e-mail.");
        }
        return;
      }
      try {
        const result = await supabase.functions.invoke("age-consent", {
          body: { action: "inspect", token: value },
        });
        if (!alive || current !== generation.current) return;
        if (result.error || result.data?.valid !== true)
          throw new Error(
            "Ce lien n’est plus disponible ou a expiré. Une nouvelle demande peut être envoyée depuis le compte concerné.",
          );
        setToken(value);
        setError("");
        setState("ready");
      } catch (reason) {
        if (alive && current === generation.current) {
          setState("error");
          setError(
            reason instanceof Error
              ? reason.message
              : "Impossible de vérifier le lien.",
          );
        }
      }
    }
    void Linking.getInitialURL()
      .then(inspect)
      .catch(() => {
        if (alive) {
          setState("error");
          setError("Impossible d’ouvrir le lien reçu par e-mail.");
        }
      });
    const subscription = Linking.addEventListener(
      "url",
      (event) => void inspect(event.url),
    );
    return () => {
      alive = false;
      generation.current++;
      subscription.remove();
    };
  }, [attempt]);
  async function respond(decision: "approve" | "refuse") {
    if (!token || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    const current = generation.current;
    try {
      const result = await supabase.functions.invoke("age-consent", {
        body: { action: "respond", token, decision },
      });
      if (current !== generation.current) return;
      const expected = decision === "approve" ? "approved" : "refused";
      if (result.error || result.data?.status !== expected)
        throw new Error(
          "La réponse n’a pas pu être confirmée. Vérifiez votre connexion puis réessayez.",
        );
      setState(expected);
      setToken(null);
    } catch (reason) {
      if (current === generation.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "La réponse n’a pas été confirmée.",
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen title="Autorisation parentale" back={false}>
      {state === "loading" ? (
        <Loading />
      ) : state === "ready" ? (
        <>
          <Text style={s.h2}>Autoriser l’utilisation de FootNation</Text>
          <Text style={s.text}>
            Un jeune de 13 à 15 ans a indiqué votre adresse pour demander
            l’autorisation d’utiliser FootNation, un réseau social consacré au
            football : profils, publications, vidéos et échanges entre membres.
          </Text>
          <Text style={s.text}>
            En autorisant l’accès, vous déclarez exercer l’autorité parentale
            sur ce jeune et acceptez son utilisation de FootNation. Si vous ne
            reconnaissez pas cette demande, refusez-la.
          </Text>
          <Text style={s.small}>
            L’ouverture de ce lien ne donne aucune autorisation. Votre choix est
            enregistré uniquement après un appui sur l’un des boutons.
          </Text>
          <Button
            title="Lire les informations pour les parents"
            secondary
            onPress={() =>
              void Linking.openURL(
                "https://www.foot-nation.com/securite-mineurs",
              )
            }
          />
          <View style={{ gap: 12 }}>
            <Button
              title="J’autorise l’utilisation de FootNation"
              busy={busy}
              onPress={() => void respond("approve")}
            />
            <Button
              title="Je refuse cette demande"
              secondary
              disabled={busy}
              onPress={() => void respond("refuse")}
            />
          </View>
        </>
      ) : state === "approved" ? (
        <Text accessibilityLiveRegion="polite" style={s.text}>
          Votre autorisation a été enregistrée. Le jeune peut revenir dans
          l’application et vérifier son accès.
        </Text>
      ) : state === "refused" ? (
        <Text accessibilityLiveRegion="polite" style={s.text}>
          Votre refus a été enregistré. Le compte reste restreint.
        </Text>
      ) : null}
      {!!error && (
        <Text accessibilityRole="alert" style={s.text}>
          {error}
        </Text>
      )}
      {state === "error" && (
        <Button
          title="Réessayer la vérification du lien"
          secondary
          onPress={() => setAttempt((value) => value + 1)}
        />
      )}
    </Screen>
  );
}
