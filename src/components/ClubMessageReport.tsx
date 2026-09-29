import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Chip, ErrorState, Field, useUIStyles } from "./ui";
import { supabase } from "../lib/supabase";
import { createProContent } from "../lib/proContentSave";
import { clubReportPayload, clubReportReasons } from "../lib/clubReport";
export function ClubMessageReport({
  messageId,
  groupId,
  uid,
}: {
  messageId: string;
  groupId: string;
  uid: string;
}) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reportId] = useState(randomUUID);
  const [reason, setReason] = useState("inappropriate");
  const [details, setDetails] = useState("");
  const report = useMutation({
    mutationFn: async () => {
      const row = {
        id: reportId,
        message_id: messageId,
        reporter_id: uid,
        ...clubReportPayload(reason, details),
      };
      const user = await supabase.auth.getUser();
      if (user.error) throw user.error;
      if (user.data.user?.id !== uid)
        throw new Error("La session a changé. Rechargez la discussion.");
      await createProContent(
        {
          read: async (id) => {
            const r = await supabase
              .from("club_chat_message_reports")
              .select("id,message_id,reporter_id,reason,details")
              .eq("id", id)
              .eq("reporter_id", uid)
              .maybeSingle();
            if (r.error) throw r.error;
            return r.data;
          },
          insert: async (payload) => {
            const message = await supabase
              .from("club_chat_messages")
              .select("id,is_deleted,is_blocked,author_id")
              .eq("id", messageId)
              .eq("group_id", groupId)
              .maybeSingle();
            if (message.error) throw message.error;
            if (
              !message.data ||
              message.data.is_deleted ||
              message.data.is_blocked ||
              message.data.author_id === uid
            )
              throw new Error(
                "Ce message ne peut plus être signalé depuis cette discussion.",
              );
            const r = await supabase
              .from("club_chat_message_reports")
              .insert(payload);
            if (r.error) throw r.error;
          },
        },
        row,
      );
    },
    onSuccess: () => {
      setOpen(false);
      void cache.invalidateQueries({
        queryKey: ["my-club-message-reports", uid],
      });
    },
  });
  if (report.isSuccess)
    return (
      <View style={{ gap: 8 }}>
        <Text style={s.small}>Votre signalement a été enregistré.</Text>
        <Button
          title="Suivre mes signalements"
          secondary
          onPress={() => router.push("/my-club-reports")}
        />
      </View>
    );
  if (!open)
    return <Button title="Signaler" secondary onPress={() => setOpen(true)} />;
  return (
    <View style={{ gap: 10 }}>
      <Text style={s.h2}>Signaler ce message</Text>
      <Text style={s.subtitle}>
        Choisissez le motif. Le signalement ne bloque pas automatiquement le
        message.
      </Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(clubReportReasons).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={reason === key}
            disabled={report.isPending}
            onPress={() => setReason(key)}
          />
        ))}
      </View>
      <Field
        label="Précisions (facultatif)"
        multiline
        maxLength={3000}
        value={details}
        onChangeText={setDetails}
        editable={!report.isPending}
      />
      {!!report.error && <ErrorState error={report.error} />}
      <Button
        title="Envoyer le signalement"
        busy={report.isPending}
        onPress={() => report.mutate()}
      />
      <Button
        title="Annuler"
        secondary
        disabled={report.isPending}
        onPress={() => setOpen(false)}
      />
    </View>
  );
}
