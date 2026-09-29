import React, { useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  needsProVerificationRequest,
  proVerificationLabels,
} from "../lib/proVerification";
import { Button, ErrorState, Field, useUIStyles } from "./ui";
type Page = {
  id: string;
  owner_id: string;
  page_type: string;
  club_id: string | null;
  verification_status: string;
  request_message: string | null;
  verification_notes: string | null;
  verification_requested_at: string | null;
};
export function ProVerification({ page }: { page: Page }) {
  const s = useUIStyles();

  const uid = useAuth().session?.user.id;
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(page.request_message || "");
  const request = useMutation({
    mutationFn: async () => {
      const session = await supabase.auth.getUser();
      if (session.error) throw session.error;
      if (!uid || session.data.user?.id !== uid)
        throw new Error("La session a changé. Rechargez la page.");
      const fresh = await supabase
        .from("pro_pages")
        .select("page_type,club_id,verification_status,updated_at")
        .eq("id", page.id)
        .eq("owner_id", uid)
        .single();
      if (fresh.error) throw fresh.error;
      if (!needsProVerificationRequest(fresh.data)) return;
      const result = await supabase
        .from("pro_pages")
        .update({
          verification_status: "pending_review",
          verification_requested_at: new Date().toISOString(),
          request_message: message.trim(),
        })
        .eq("id", page.id)
        .eq("owner_id", uid)
        .eq("updated_at", fresh.data.updated_at)
        .eq("verification_status", fresh.data.verification_status)
        .select("id")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data)
        throw new Error(
          "La page vient d’être modifiée. Actualisez-la avant de réessayer.",
        );
    },
    onSuccess: () => {
      setOpen(false);
      void cache.invalidateQueries({ queryKey: ["native-pro-page"] });
      void cache.invalidateQueries({ queryKey: ["native-pro-pages"] });
    },
  });
  if (uid !== page.owner_id)
    return page.verification_status === "approved" ? (
      <Text style={s.subtitle}>Page certifiée officielle</Text>
    ) : null;
  return (
    <View style={s.card}>
      <Text style={s.h2}>Validation officielle</Text>
      <Text style={s.text}>
        {proVerificationLabels[page.verification_status] || "Statut inconnu"}
      </Text>
      {!!page.verification_requested_at && (
        <Text style={s.small}>
          Dernière demande :{" "}
          {new Date(page.verification_requested_at).toLocaleDateString("fr-FR")}
        </Text>
      )}
      {!!page.verification_notes && (
        <Text style={s.text}>
          Retour de l’équipe FootNation : {page.verification_notes}
        </Text>
      )}
      {!!(
        page.page_type === "club_officiel" &&
        ["draft", "rejected"].includes(page.verification_status)
      ) && (
        <>
          {!open ? (
            <Button
              title="Demander la validation officielle"
              secondary
              onPress={() => setOpen(true)}
            />
          ) : (
            <>
              <Field
                label="Informations pour l’équipe de validation"
                placeholder="Licence FFF, liens officiels et informations utiles…"
                multiline
                value={message}
                onChangeText={setMessage}
                maxLength={3000}
                editable={!request.isPending}
              />
              <Text style={s.small}>
                Cette demande sera examinée par FootNation avant toute
                certification.
              </Text>
              <Button
                title="Envoyer la demande de validation"
                busy={request.isPending}
                onPress={() => request.mutate()}
              />
              <Button
                title="Annuler"
                secondary
                disabled={request.isPending}
                onPress={() => setOpen(false)}
              />
            </>
          )}
        </>
      )}
      {!!request.error && <ErrorState error={request.error} />}
    </View>
  );
}
