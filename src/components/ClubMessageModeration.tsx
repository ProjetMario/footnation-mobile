import { useState } from "react";
import { Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, ErrorState, Field, useUIStyles } from "./ui";
import { supabase } from "../lib/supabase";
export function ClubMessageModeration({
  reportId,
  message,
  uid,
  disabled,
  onBusy,
}: {
  reportId: string;
  message: Record<string, any>;
  uid: string;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [confirmation, setConfirmation] = useState<{
    block: boolean;
    version: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const mutation = useMutation({
    onMutate: () => onBusy(true),
    mutationFn: async () => {
      if (!confirmation) throw new Error("Confirmez l’action.");
      const user = await supabase.auth.getUser();
      if (user.error) throw user.error;
      if (user.data.user?.id !== uid) throw new Error("La session a changé.");
      const r = await supabase.rpc("moderate_native_club_report_message", {
        p_report_id: reportId,
        p_block: confirmation.block,
        p_reason: confirmation.block ? reason.trim() : null,
        p_expected_version: confirmation.version,
      });
      if (r.error) {
        if (r.error.code === "40001")
          throw new Error(
            "Le message a changé. Annulez et actualisez avant de confirmer à nouveau.",
          );
        throw r.error;
      }
      return r.data;
    },
    onSuccess: (data) => {
      cache.setQueryData(["club-report-message", uid, reportId], data);
      void cache.invalidateQueries({ queryKey: ["native-club-chat-messages"] });
      setDone(
        confirmation?.block
          ? "Message bloqué dans l’application."
          : "Blocage du message levé.",
      );
      setConfirmation(null);
      setReason("");
    },
    onSettled: () => onBusy(false),
  });
  if (message.is_deleted) return null;
  return (
    <View style={{ gap: 10 }}>
      {!!message.blocked_reason && (
        <Text style={s.small}>Motif du blocage : {message.blocked_reason}</Text>
      )}
      {!!done && <Text style={s.text}>{done}</Text>}
      {confirmation ? (
        <>
          <Text style={s.text}>
            {confirmation.block
              ? "Confirmer le blocage de ce message dans la discussion ?"
              : "Confirmer la remise à disposition de ce message dans la discussion ?"}
          </Text>
          {!!confirmation.block && (
            <Field
              label="Motif du blocage"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={3000}
              editable={!mutation.isPending}
            />
          )}
          {!!mutation.error && <ErrorState error={mutation.error} />}
          <Button
            title={
              confirmation.block
                ? "Confirmer le blocage"
                : "Confirmer le déblocage"
            }
            busy={mutation.isPending}
            disabled={disabled || (confirmation.block && !reason.trim())}
            onPress={() => mutation.mutate()}
          />
          <Button
            title="Annuler l’action"
            secondary
            disabled={mutation.isPending}
            onPress={() => {
              setConfirmation(null);
              mutation.reset();
            }}
          />
        </>
      ) : (
        <Button
          title={
            message.is_blocked ? "Débloquer le message" : "Bloquer le message"
          }
          secondary
          disabled={disabled || !message.version}
          onPress={() => {
            setDone(null);
            mutation.reset();
            setReason("");
            setConfirmation({
              block: !message.is_blocked,
              version: message.version,
            });
          }}
        />
      )}
    </View>
  );
}
