import React, { useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import Constants from "expo-constants";
import { randomUUID } from "expo-crypto";
import { useMutation } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Chip,
  ErrorState,
  Field,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  feedbackAreas,
  feedbackCategories,
  normalizeFeedback,
  type FeedbackArea,
  type FeedbackCategory,
  type FeedbackInput,
} from "../lib/betaFeedback";

export default function BetaFeedbackScreen() {
  const uid = useAuth().session?.user.id;
  return (
    <Screen title="Améliorer FootNation" back>
      <AuthGate>{!!uid && <FeedbackForm key={uid} uid={uid} />}</AuthGate>
    </Screen>
  );
}

function FeedbackForm({ uid }: { uid: string }) {
  const s = useUIStyles();
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [area, setArea] = useState<FeedbackArea>("team");
  const [message, setMessage] = useState("");
  const operation = useRef<{ id: string; fingerprint: string } | null>(null);
  const sending = useRef(false);
  const submit = useMutation({
    mutationFn: async (input: FeedbackInput) => {
      const normalized = normalizeFeedback(input);
      const fingerprint = JSON.stringify(normalized);
      if (operation.current?.fingerprint !== fingerprint)
        operation.current = { id: randomUUID(), fingerprint };
      const id = operation.current.id;
      const { data, error } = await supabase.rpc(
        "submit_native_beta_feedback",
        {
          p_id: id,
          p_actor_id: uid,
          p_category: normalized.category,
          p_area: normalized.area,
          p_message: normalized.message,
          p_platform: normalized.platform,
          p_app_version: normalized.appVersion,
        },
      );
      if (error) {
        if (error.code === "P0001")
          throw new Error(
            "Vous avez déjà envoyé plusieurs retours. Réessayez dans une heure.",
          );
        throw new Error(
          "Votre retour n’a pas pu être confirmé. Réessayez depuis cet écran pour confirmer le même envoi.",
        );
      }
      if (data !== id)
        throw new Error("La réception reste à confirmer. Réessayez.");
    },
  });
  async function send() {
    if (sending.current || submit.isSuccess) return;
    sending.current = true;
    try {
      await submit.mutateAsync({
        category,
        area,
        message,
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version || "1.0.0",
      });
    } catch {
      /* The mutation renders a safe retry message. */
    } finally {
      sending.current = false;
    }
  }
  if (submit.isSuccess)
    return (
      <View style={s.card}>
        <Text style={s.h2}>Merci pour votre retour</Text>
        <Text style={s.text}>
          Il a été enregistré dans l’espace de suivi de l’équipe FootNation.
        </Text>
        <Button
          secondary
          title="Faire un autre retour"
          onPress={() => {
            operation.current = null;
            setMessage("");
            submit.reset();
          }}
        />
      </View>
    );
  return (
    <>
      <Text style={s.h2}>Construisons une meilleure expérience</Text>
      <Text style={s.text}>
        Expliquez ce qui vous a aidé, bloqué ou ce que vous aimeriez améliorer.
        Votre retour est privé et accessible à l’équipe FootNation.
      </Text>
      <Text style={s.h2}>Votre retour concerne…</Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(feedbackCategories).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={category === key}
            onPress={() => {
              if (!submit.isPending) setCategory(key as FeedbackCategory);
            }}
          />
        ))}
      </View>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(feedbackAreas).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={area === key}
            onPress={() => {
              if (!submit.isPending) setArea(key as FeedbackArea);
            }}
          />
        ))}
      </View>
      <Field
        label="Que s’est-il passé ? Que souhaitiez-vous faire ?"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={2000}
        editable={!submit.isPending}
      />
      <Text style={s.small}>
        {Array.from(message.trim()).length}/2 000 caractères · N’ajoutez pas de
        mot de passe ni d’informations privées sur un autre membre. Seuls ce
        texte, la rubrique, la plateforme et la version sont transmis avec votre
        compte.
      </Text>
      {!!submit.error && <ErrorState error={submit.error} />}
      <Button
        title={submit.error ? "Réessayer l’envoi" : "Envoyer mon retour"}
        busy={submit.isPending}
        disabled={Array.from(message.trim()).length < 10}
        onPress={() => void send()}
      />
    </>
  );
}
