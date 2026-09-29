import { useState } from "react";
import { View, Text } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, ErrorState, Field, useUIStyles } from "./ui";
import { supabase } from "../lib/supabase";
import { clubMessageText } from "../lib/clubMessageText";

type Message = {
  id: string;
  author_id: string;
  content: string;
  media_url: string | null;
  edited_at: string | null;
  is_deleted: boolean | null;
  is_blocked: boolean;
};
export function ClubMessageActions({
  message,
  groupId,
  uid,
}: {
  message: Message;
  groupId: string;
  uid: string;
}) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [baseline, setBaseline] = useState<Message | null>(null);
  const [action, setAction] = useState<"edit" | "remove" | null>(null);
  const [content, setContent] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      if (
        !baseline ||
        !action ||
        baseline.author_id !== uid ||
        baseline.is_deleted ||
        baseline.is_blocked
      )
        throw new Error("Ce message ne peut plus être modifié.");
      const text = action === "remove" ? null : clubMessageText(content);
      const user = await supabase.auth.getUser();
      if (user.error) throw user.error;
      if (user.data.user?.id !== uid)
        throw new Error("La session a changé. Rechargez la discussion.");
      const member = await supabase
        .from("club_chat_group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("profile_id", uid)
        .maybeSingle();
      if (member.error) throw member.error;
      if (!member.data)
        throw new Error("Vous n’êtes plus membre de cette discussion.");
      const result = await supabase.rpc("update_native_club_message_snapshot", {
        p_message_id: baseline.id,
        p_group_id: groupId,
        p_content: text,
        p_delete: action === "remove",
        p_expected: Object.fromEntries(
          (
            [
              "content",
              "media_url",
              "edited_at",
              "is_deleted",
              "is_blocked",
            ] as const
          ).map((key) => [key, baseline[key] ?? null]),
        ),
      });
      if (result.error) {
        if (result.error.code === "40001")
          throw new Error(
            "Le message a changé ou n’est plus accessible. Annulez, puis actualisez la discussion.",
          );
        throw result.error;
      }
    },
    onSuccess: () => {
      setAction(null);
      setBaseline(null);
      void cache.invalidateQueries({
        queryKey: ["native-club-chat-messages", groupId, uid],
      });
    },
  });
  if (message.author_id !== uid || message.is_deleted || message.is_blocked)
    return null;
  const begin = (next: "edit" | "remove") => {
    mutation.reset();
    setBaseline({ ...message });
    setContent(message.content);
    setAction(next);
  };
  return (
    <View style={{ gap: 8 }}>
      {action ? (
        <>
          {action === "edit" ? (
            <Field
              label="Modifier votre message"
              multiline
              maxLength={4000}
              value={content}
              onChangeText={setContent}
              editable={!mutation.isPending}
            />
          ) : (
            <Text style={s.text}>
              Supprimer ce message pour les membres de la discussion ?
            </Text>
          )}
          {!!mutation.error && <ErrorState error={mutation.error} />}
          <Button
            title={
              action === "edit"
                ? "Enregistrer la modification"
                : "Confirmer la suppression"
            }
            busy={mutation.isPending}
            disabled={action === "edit" && !content.trim()}
            onPress={() => mutation.mutate()}
          />
          <Button
            title="Annuler"
            secondary
            disabled={mutation.isPending}
            onPress={() => {
              setAction(null);
              setBaseline(null);
              mutation.reset();
            }}
          />
        </>
      ) : (
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <Button title="Modifier" secondary onPress={() => begin("edit")} />
          <Button title="Supprimer" secondary onPress={() => begin("remove")} />
        </View>
      )}
    </View>
  );
}
