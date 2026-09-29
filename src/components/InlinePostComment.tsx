import { supabase as supabaseClient } from "../lib/supabase";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Send } from "lucide-react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { usePostCommentDraft } from "../lib/usePostCommentDraft";
import { PostCommentError, publishPostComment } from "../lib/postComments";

/** Shared with the comments sheet; writing here never replaces the playing media. */
export function InlinePostComment({
  postId,
  onNavigate,
}: {
  postId: string;
  onNavigate?: () => void;
}) {
  const { session } = useAuth();
  return (
    <CommentComposer
      key={`${session?.user.id || "guest"}:${postId}`}
      postId={postId}
      userId={session?.user.id}
      onNavigate={onNavigate}
    />
  );
}

function CommentComposer({
  postId,
  userId,
  onNavigate,
}: {
  postId: string;
  userId?: string;
  onNavigate?: () => void;
}) {
  const [draft, setDraft] = usePostCommentDraft(userId, postId);
  const [sent, setSent] = useState(false);
  const submitting = useRef(false);
  const cache = useQueryClient();
  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(false), 2500);
    return () => clearTimeout(timer);
  }, [sent]);
  const send = useMutation({
    mutationFn: (content: string) =>
      publishPostComment(supabaseClient, { postId, userId, content }),
    onSuccess: (_, submitted) => {
      setDraft((current) => (current === submitted ? "" : current));
      setSent(true);
      void cache.invalidateQueries({ queryKey: ["comments", postId] });
      void cache.invalidateQueries({ queryKey: ["posts"] });
      void cache.invalidateQueries({ queryKey: ["post", postId] });
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  const recovery =
    send.error instanceof PostCommentError ? send.error.recovery : null;
  const submit = () => {
    if (submitting.current || !draft.trim()) return;
    submitting.current = true;
    setSent(false);
    send.mutate(draft);
  };
  return (
    <View style={styles.container}>
      {!!send.isError && (
        <View style={styles.feedback}>
          <Text accessibilityRole="alert" style={styles.error}>
            {send.error.message}
          </Text>
          {(recovery === "login" || recovery === "profile") && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onNavigate?.();
                router.push({
                  pathname: recovery === "login" ? "/login" : "/profile-setup",
                  params: { next: `/posts/${postId}` },
                });
              }}
              style={styles.recover}
            >
              <Text style={styles.message}>
                {recovery === "login" ? "Se connecter" : "Compléter mon profil"}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {!!sent && (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.feedback, styles.message]}
        >
          Commentaire publié
        </Text>
      )}
      <View style={styles.pill}>
        <TextInput
          accessibilityLabel="Ajouter un commentaire à cette publication"
          placeholder="Ajouter un commentaire…"
          placeholderTextColor="rgba(255,255,255,0.72)"
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            if (send.isError) send.reset();
          }}
          maxLength={3000}
          multiline
          numberOfLines={1}
          style={styles.input}
        />
        {!!draft.trim() && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Envoyer le commentaire"
            accessibilityState={{
              disabled: send.isPending,
              busy: send.isPending,
            }}
            disabled={send.isPending}
            onPress={submit}
            style={({ pressed }) => [
              styles.send,
              { opacity: pressed || send.isPending ? 0.6 : 1 },
            ]}
          >
            {send.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Send color="#FFFFFF" size={21} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
    paddingLeft: 16,
    paddingRight: 4,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(14,20,26,0.76)",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 90,
    paddingTop: 12,
    paddingBottom: 12,
    paddingRight: 10,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "#FFFFFF",
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#087CFF",
  },
  feedback: {
    alignSelf: "flex-start",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(14,20,26,0.94)",
  },
  error: {
    fontFamily: "Inter-Medium",
    fontSize: 12,
    lineHeight: 17,
    color: "#FFABB4",
  },
  message: {
    color: "#FFFFFF",
    fontFamily: "Inter-Medium",
    fontSize: 12,
    lineHeight: 17,
  },
  recover: { minHeight: 44, justifyContent: "center" },
});
