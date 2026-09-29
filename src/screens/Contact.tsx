import React, { useState } from "react";
import { Text } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { supabase, requireBackend } from "../lib/supabase";
import { Button, Field, Screen, useUIStyles } from "../components/ui";
import { validEmail } from "../lib/validation";
import { contactFormPayload } from "../lib/contactForm";
import { useTheme } from "../theme";
import { SupportEntry } from "../components/SupportEntry";
export default function Contact({ deletion = false }: { deletion?: boolean }) {
  const { colors } = useTheme();
  const s = useUIStyles();

  const [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [firstName, setFirstName] = useState(""),
    [message, setMessage] = useState("");
  const send = useMutation({
    mutationFn: async () => {
      requireBackend();
      const { error } = await supabase.functions.invoke("contact-form", {
        body: deletion
          ? {
              firstName: "Demande",
              lastName: "Suppression",
              email,
              profileType: "suppression_compte",
              message: `Demande de suppression de compte FootNation.\nNom d'utilisateur : ${name}\nEmail associé : ${email}\nMotif : ${message || "Non précisé"}`,
            }
          : contactFormPayload({ firstName, lastName: name, email, message }),
      });
      if (error) throw error;
    },
  });
  return (
    <Screen title={deletion ? "Suppression de compte" : "Contact"}>
      <Text style={s.title}>
        {deletion
          ? "Suppression de compte et des données"
          : "Contactez FootNation"}
      </Text>
      {!deletion && (
        <>
          <SupportEntry />
          <Text style={s.h2}>Ou envoyez-nous un formulaire</Text>
        </>
      )}
      {!!deletion && (
        <Text style={s.subtitle}>
          La suppression de votre compte et de vos données est définitive. Ce
          formulaire transmet votre demande à l’équipe FootNation.
        </Text>
      )}
      {!deletion && (
        <Field
          label="Prénom"
          value={firstName}
          onChangeText={setFirstName}
          autoComplete="given-name"
          editable={!send.isPending}
        />
      )}
      <Field
        label={deletion ? "Nom d’utilisateur" : "Nom"}
        value={name}
        onChangeText={setName}
        editable={!send.isPending}
      />
      <Field
        label="Adresse e-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!send.isPending}
      />
      <Field
        label={deletion ? "Motif (facultatif)" : "Votre message"}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={5000}
        editable={!send.isPending}
      />
      {!!send.isError && (
        <Text style={{ color: colors.danger }}>{send.error.message}</Text>
      )}
      {send.isSuccess ? (
        <Text style={s.text}>Votre demande a été envoyée.</Text>
      ) : (
        <Button
          title={
            deletion
              ? "Demander la suppression de mon compte"
              : "Envoyer le message"
          }
          onPress={() => send.mutate()}
          busy={send.isPending}
          disabled={
            !name.trim() ||
            !validEmail(email) ||
            (!deletion && (!firstName.trim() || !message.trim()))
          }
        />
      )}
    </Screen>
  );
}
export function AccountDeletion() {
  return <Contact deletion />;
}
