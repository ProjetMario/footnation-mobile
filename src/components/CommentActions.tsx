import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { changeOwnPostComment } from "../lib/postComments";
import { useTheme } from "../theme";

export function CommentActions({
  comment,
  postId,
  dark = false,
}: {
  comment: { id: string; user_id: string; content: string };
  postId: string;
  dark?: boolean;
}) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const cache = useQueryClient();
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  const [content, setContent] = useState(comment.content);
  const [originalContent, setOriginalContent] = useState(comment.content);
  const foreground = dark ? "#FFFFFF" : colors.ink;
  const muted = dark ? "#AEB6C2" : colors.muted;
  const danger = dark ? "#FF7D89" : colors.danger;
  const mutation = useMutation({
    mutationFn: (
      action: { type: "edit"; content: string } | { type: "delete" },
    ) =>
      changeOwnPostComment(supabase, {
        comment: { ...comment, content: originalContent },
        postId,
        userId: session?.user.id,
        action,
      }),
    onSuccess: () => {
      setMode(null);
      for (const key of [
        ["comments", postId],
        ["post", postId],
        ["posts"],
        ["short-comments-count", "post", postId],
      ])
        void cache.invalidateQueries({ queryKey: key });
    },
  });
  if (!session || session.user.id !== comment.user_id) return null;
  const start = (next: "edit" | "delete") => {
    setContent(comment.content);
    setOriginalContent(comment.content);
    mutation.reset();
    setMode(next);
  };
  return (
    <View style={styles.container}>
      {mode === "edit" && (
        <TextInput
          accessibilityLabel="Modifier votre commentaire"
          autoFocus
          multiline
          value={content}
          onChangeText={setContent}
          editable={!mutation.isPending}
          maxLength={3000}
          style={[styles.input, { color: foreground, borderColor: muted }]}
        />
      )}
      {mode === "delete" && (
        <Text style={[styles.message, { color: foreground }]}>
          Supprimer votre commentaire ? Cette action est définitive.
        </Text>
      )}
      <View style={styles.actions}>
        {mode ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={
                mutation.isPending || (mode === "edit" && !content.trim())
              }
              onPress={() =>
                mutation.mutate(
                  mode === "edit"
                    ? { type: "edit", content }
                    : { type: "delete" },
                )
              }
              style={({ pressed }) => [
                styles.action,
                { opacity: pressed || mutation.isPending ? 0.5 : 1 },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  { color: mode === "delete" ? danger : foreground },
                ]}
              >
                {mutation.isPending
                  ? "En cours…"
                  : mode === "edit"
                    ? "Enregistrer"
                    : "Confirmer la suppression"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={mutation.isPending}
              onPress={() => {
                setMode(null);
                mutation.reset();
              }}
              style={styles.action}
            >
              <Text style={[styles.label, { color: muted }]}>Annuler</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => start("edit")}
              style={styles.action}
            >
              <Text style={[styles.label, { color: muted }]}>Modifier</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => start("delete")}
              style={styles.action}
            >
              <Text style={[styles.label, { color: danger }]}>Supprimer</Text>
            </Pressable>
          </>
        )}
      </View>
      {!!mutation.error && (
        <Text
          accessibilityRole="alert"
          style={[styles.message, { color: danger }]}
        >
          {mutation.error.message}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 4, marginTop: 4 },
  actions: { flexDirection: "row", flexWrap: "wrap", columnGap: 18 },
  action: { minHeight: 44, justifyContent: "center" },
  label: { fontFamily: "Inter-SemiBold", fontSize: 13, lineHeight: 18 },
  message: { fontFamily: "Inter-Regular", fontSize: 14, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 70,
    padding: 12,
    fontFamily: "Inter-Regular",
    fontSize: 16,
    textAlignVertical: "top",
  },
});
