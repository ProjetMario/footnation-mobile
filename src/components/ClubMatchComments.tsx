import {
  commentTextRejected,
  COMMENT_MODERATION_MESSAGE,
  isCommentModerationError,
} from "../lib/commentModeration";
import {
  ClubButton as Button,
  useClubUIStyles as useUIStyles,
} from "./ClubDesign";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { authReturnPath } from "../lib/authReturn";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { Avatar, Field, Loading, ErrorState } from "./ui";

export function ClubMatchComments({ matchId }: { matchId: string }) {
  const { session } = useAuth();
  const next = authReturnPath(usePathname());
  const styles = useUIStyles();
  const cache = useQueryClient();
  const [content, setContent] = useState("");
  const queryKey = ["club-match-comments", matchId];
  const comments = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_comments")
        .select("id,user_id,content,created_at")
        .eq("external_match_id", matchId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const ids = [...new Set((data || []).map((row) => row.user_id))];
      const profiles = ids.length
        ? await supabase
            .from("profiles")
            .select("id,full_name,first_name,last_name,username,avatar_url")
            .in("id", ids)
        : { data: [] };
      return (data || []).map((row) => ({
        ...row,
        profile: profiles.data?.find((profile) => profile.id === row.user_id),
      }));
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      if (!session || !content.trim())
        throw new Error("Connectez-vous pour commenter.");
      if (commentTextRejected(content))
        throw new Error(COMMENT_MODERATION_MESSAGE);
      const { error } = await supabase.from("match_comments").insert({
        external_match_id: matchId,
        user_id: session.user.id,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      void cache.invalidateQueries({ queryKey });
    },
  });
  return (
    <View style={{ paddingTop: 12, gap: 16 }}>
      <Text style={styles.h2}>Commentaires du match</Text>
      {comments.isPending ? (
        <Loading />
      ) : comments.error ? (
        <ErrorState
          error={comments.error}
          retry={() => void comments.refetch()}
        />
      ) : comments.data?.length ? (
        comments.data.map((row) => {
          const name =
            row.profile?.full_name ||
            [row.profile?.first_name, row.profile?.last_name]
              .filter(Boolean)
              .join(" ") ||
            row.profile?.username ||
            "Profil indisponible";
          return (
            <View key={row.id} style={{ gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Voir le profil de ${name}`}
                onPress={() => router.push(`/profile/${row.user_id}`)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 44,
                }}
              >
                <Avatar uri={row.profile?.avatar_url} name={name} size={32} />
                <Text style={[styles.text, { flex: 1, minWidth: 0 }]}>
                  {name}
                </Text>
              </Pressable>
              <Text style={styles.text}>{row.content}</Text>
            </View>
          );
        })
      ) : (
        <Text style={styles.small}>Soyez le premier à commenter ce match.</Text>
      )}
      {session ? (
        <>
          <Field
            label="Votre commentaire"
            placeholder="Ajouter un commentaire…"
            value={content}
            onChangeText={setContent}
            maxLength={2000}
            multiline
          />
          {send.isError && (
            <Text accessibilityRole="alert" style={styles.small}>
              {isCommentModerationError(send.error)
                ? COMMENT_MODERATION_MESSAGE
                : "Impossible d’envoyer le commentaire. Votre texte est conservé, réessayez."}
            </Text>
          )}
          <Button
            title={send.isPending ? "Envoi…" : "Publier le commentaire"}
            disabled={send.isPending || !content.trim()}
            onPress={() => send.mutate()}
          />
        </>
      ) : (
        <Button
          title="Se connecter pour commenter"
          onPress={() =>
            router.push({ pathname: "/login", params: next ? { next } : {} })
          }
        />
      )}
    </View>
  );
}
