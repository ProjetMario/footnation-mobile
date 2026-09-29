import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { displayName, type Profile } from "../lib/models";
import { publishShortComment, SHORT_COMMENT_LIMIT } from "../lib/shortComments";
import { Avatar, Button, ErrorState, Field, Loading, useUIStyles } from "./ui";
import { useTheme } from "../theme";

type ShortComment = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: Profile | null;
};
export function ShortComments({
  shortId,
  open,
  onClose,
}: {
  shortId: string;
  open: boolean;
  onClose(): void;
}) {
  const { session } = useAuth();
  return (
    <ShortCommentsContent
      key={`${session?.user.id}:${shortId}`}
      shortId={shortId}
      open={open}
      onClose={onClose}
    />
  );
}
function ShortCommentsContent({
  shortId,
  open,
  onClose,
}: {
  shortId: string;
  open: boolean;
  onClose(): void;
}) {
  const { session, profileStatus } = useAuth();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const s = useUIStyles();
  const cache = useQueryClient();
  const [content, setContent] = useState("");
  const [limit, setLimit] = useState(30);
  const comments = useQuery({
    queryKey: ["short-comments", shortId, session?.user.id, limit],
    enabled: open && !!session,
    queryFn: async () => {
      const result = await supabase
        .from("short_comments")
        .select(
          "id,user_id,content,created_at,author:profiles!short_comments_user_id_fkey(id,full_name,username,avatar_url)",
        )
        .eq("short_id", shortId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(0, limit);
      if (result.error) throw result.error;
      return result.data as unknown as ShortComment[];
    },
  });
  const send = useMutation({
    mutationFn: () =>
      publishShortComment(supabase, {
        shortId,
        userId: session?.user.id,
        content,
      }),
    onSuccess: async () => {
      setContent("");
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["short-comments", shortId] }),
        cache.invalidateQueries({
          queryKey: ["short-comments-count", "short", shortId],
        }),
      ]);
    },
  });
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: width < 600 ? "flex-end" : "center",
          alignItems: "center",
          padding: width < 600 ? 0 : 24,
        }}
      >
        <View
          style={[
            s.card,
            {
              width: "100%",
              maxWidth: 600,
              maxHeight: "90%",
              gap: 16,
              borderRadius: 20,
            },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={s.h2}>Commentaires</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer les commentaires"
              onPress={onClose}
              style={{
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X color={colors.ink} size={24} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16 }}
          >
            {comments.isPending ? (
              <Loading />
            ) : comments.isError ? (
              <ErrorState
                error={new Error("Impossible de charger les commentaires.")}
                retry={() => void comments.refetch()}
              />
            ) : !comments.data?.length ? (
              <Text style={s.small}>Soyez le premier à commenter.</Text>
            ) : (
              comments.data.slice(0, limit).map((comment) => (
                <View key={comment.id} style={{ gap: 8 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Voir le profil de ${displayName(comment.author)}`}
                    onPress={() => {
                      onClose();
                      router.push(`/profile/${comment.user_id}`);
                    }}
                    style={{
                      minHeight: 44,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Avatar
                      uri={comment.author?.avatar_url}
                      name={displayName(comment.author)}
                      size={32}
                    />
                    <Text
                      style={[
                        s.text,
                        { fontFamily: "Inter-SemiBold", flex: 1 },
                      ]}
                    >
                      {displayName(comment.author)}
                    </Text>
                  </Pressable>
                  <Text selectable style={[s.text, { paddingLeft: 42 }]}>
                    {comment.content}
                  </Text>
                </View>
              ))
            )}
            {!!(comments.data && comments.data.length > limit) && (
              <Button
                title="Voir plus de commentaires"
                secondary
                onPress={() => setLimit((value) => value + 30)}
              />
            )}
          </ScrollView>
          <Field
            label="Votre commentaire"
            value={content}
            onChangeText={(value) => {
              setContent(value);
              send.reset();
            }}
            multiline
            maxLength={SHORT_COMMENT_LIMIT}
            editable={!send.isPending}
          />
          {!!send.isError && (
            <Text accessibilityRole="alert" style={s.small}>
              {send.error.message}
            </Text>
          )}
          {profileStatus === "missing" ? (
            <Button
              title="Enregistrer mon profil"
              onPress={() => {
                onClose();
                router.push({
                  pathname: "/profile-setup",
                  params: { next: `/shorts/${shortId}` },
                });
              }}
            />
          ) : (
            <Button
              title="Publier le commentaire"
              busy={send.isPending}
              disabled={!content.trim()}
              onPress={() => send.mutate()}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
