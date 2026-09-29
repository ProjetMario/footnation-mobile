import { useTranslation } from "../lib/i18n";
import React, { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect, usePathname } from "expo-router";
import { Heart, MessageCircle, Send } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  missingCommentProfile,
  newsCommentError,
  publishNewsComment,
  NEWS_COMMENT_LIMIT,
} from "../lib/newsComments";
import type { NewsItem } from "../types/news";
import { Button, Field, useUIStyles } from "./ui";
import { PostShareSheet } from "./PostShareSheet";

export function NewsActions({ item }: { item: NewsItem }) {
  const { session } = useAuth();
  return (
    <AccountNewsActions
      key={`${session?.user.id || "guest"}:${item.id}`}
      item={item}
    />
  );
}
function AccountNewsActions({ item }: { item: NewsItem }) {
  const t = useTranslation();
  const { session, profileStatus } = useAuth();
  const uid = session?.user.id;
  const s = useUIStyles();
  const cache = useQueryClient();
  const pathname = usePathname();
  const draftKey = ["news-comment-draft", uid, item.id];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(
    () => cache.getQueryData<{ content: string }>(draftKey)?.content || "",
  );
  useFocusEffect(
    useCallback(() => {
      const saved = cache.getQueryData<{ content: string; resume: boolean }>([
        "news-comment-draft",
        uid,
        item.id,
      ]);
      if (saved?.resume) {
        setDraft(saved.content);
        setOpen(true);
        cache.setQueryData(["news-comment-draft", uid, item.id], {
          ...saved,
          resume: false,
        });
      }
    }, [cache, uid, item.id]),
  );
  const [limit, setLimit] = useState(30);
  const [shareOpen, setShareOpen] = useState(false);
  const key = ["news-engagement", item.id, uid];
  const stats = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [likes, comments, own] = await Promise.all([
        supabase
          .from("news_reactions")
          .select("id", { count: "exact", head: true })
          .eq("news_id", item.id),
        supabase
          .from("news_comments")
          .select("id", { count: "exact", head: true })
          .eq("news_id", item.id),
        uid
          ? supabase
              .from("news_reactions")
              .select("id,reaction")
              .eq("news_id", item.id)
              .eq("user_id", uid)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      for (const result of [likes, comments, own])
        if (result.error) throw result.error;
      return {
        likes: likes.count || 0,
        comments: comments.count || 0,
        own: own.data,
      };
    },
  });
  const react = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("Connexion requise");
      const { data: own, error: readError } = await supabase
        .from("news_reactions")
        .select("id,reaction")
        .eq("news_id", item.id)
        .eq("user_id", uid)
        .maybeSingle();
      if (readError) throw readError;
      const result = own
        ? own.reaction === "like"
          ? await supabase
              .from("news_reactions")
              .delete()
              .eq("id", own.id)
              .eq("user_id", uid)
          : await supabase
              .from("news_reactions")
              .update({ reaction: "like" })
              .eq("id", own.id)
              .eq("user_id", uid)
        : await supabase
            .from("news_reactions")
            .insert({ news_id: item.id, user_id: uid, reaction: "like" });
      if (result.error) throw result.error;
    },
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["news-engagement", item.id] }),
  });
  const comments = useQuery({
    queryKey: ["news-comments", item.id, limit],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_comments")
        .select("id,content,created_at,profiles:user_id(full_name)")
        .eq("news_id", item.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(0, limit - 1);
      if (error) throw error;
      return data;
    },
  });
  const send = useMutation({
    mutationFn: (content: string) =>
      publishNewsComment(supabase, { newsId: item.id, userId: uid, content }),
    onSuccess: async () => {
      setDraft("");
      cache.removeQueries({ queryKey: draftKey, exact: true });
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["news-comments", item.id] }),
        cache.invalidateQueries({ queryKey: ["news-engagement", item.id] }),
      ]);
    },
  });
  const sendError = send.isError ? newsCommentError(send.error) : null;
  const needsProfile =
    profileStatus === "missing" || sendError?.action === "profile";
  const needsLogin = !uid || sendError?.action === "login";
  function completeAccount() {
    // Cache only in this session, scoped to the account; auth logout clears it.
    cache.setQueryDefaults(["news-comment-draft"], { gcTime: Infinity });
    cache.setQueryData(draftKey, { content: draft, resume: true });
    send.reset();
    setOpen(false);
    router.push({
      pathname: needsLogin ? "/login" : "/profile-setup",
      params: { next: pathname },
    });
  }
  return (
    <View style={{ gap: 6 }}>
      <View style={{ gap: 10, alignItems: "center" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("news.like")}
          accessibilityState={{
            selected: stats.data?.own?.reaction === "like",
          }}
          disabled={!uid || !stats.data || react.isPending}
          onPress={() => react.mutate()}
          style={{
            minHeight: 52,
            minWidth: 52,
            justifyContent: "center",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Heart
            color={stats.data?.own?.reaction === "like" ? "#FF4060" : "white"}
            fill={
              stats.data?.own?.reaction === "like" ? "#FF4060" : "transparent"
            }
            size={34}
          />
          <Text
            style={{
              color: "white",
              fontFamily: "Inter-SemiBold",
              fontSize: 12,
              lineHeight: 16,
            }}
          >
            {stats.data?.likes ?? "—"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("news.comment")}
          onPress={() => setOpen(true)}
          style={{
            minHeight: 52,
            minWidth: 52,
            justifyContent: "center",
            alignItems: "center",
            gap: 4,
          }}
        >
          <MessageCircle color="white" size={34} />
          <Text
            style={{
              color: "white",
              fontFamily: "Inter-SemiBold",
              fontSize: 12,
              lineHeight: 16,
            }}
          >
            {stats.data?.comments ?? "—"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("news.share")}
          onPress={() => setShareOpen(true)}
          style={{
            minHeight: 52,
            minWidth: 52,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Send color="white" size={34} />
        </Pressable>
      </View>
      {(stats.isError || react.isError) && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 60,
            width: 220,
            padding: 12,
            borderRadius: 14,
            backgroundColor: "rgba(0,0,0,0.88)",
            gap: 8,
          }}
        >
          {stats.isError && (
            <Button
              title="Réessayer de charger les réactions"
              onPress={() => void stats.refetch()}
            />
          )}
          {react.isError && (
            <Text accessibilityRole="alert" style={{ color: "white" }}>
              {(react.error as Error & { code?: string }).code === "23503"
                ? "Ton profil n’est pas encore enregistré. Enregistre-le pour aimer et commenter."
                : "Le like n’a pas été enregistré. Réessaie."}
            </Text>
          )}
          {react.isError &&
            (react.error as Error & { code?: string }).code === "23503" && (
              <Button
                title="Enregistrer mon profil"
                onPress={() => router.push("/profile-setup")}
              />
            )}
        </View>
      )}
      {shareOpen && (
        <PostShareSheet
          link={{
            url: /^https?:\/\//i.test(item.url)
              ? item.url
              : "https://www.foot-nation.com/",
            title: item.title,
            description: item.description,
            imageUrl: item.imageUrl,
            kind: item.sourceName,
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 20,
            backgroundColor: "rgba(0,0,0,0.65)",
          }}
        >
          <View style={[s.card, { maxHeight: "90%", gap: 12 }]}>
            <Text style={s.h2}>Commentaires</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {comments.isPending ? (
                <Text style={s.text}>Chargement…</Text>
              ) : comments.isError ? (
                <Button
                  title="Réessayer"
                  onPress={() => void comments.refetch()}
                />
              ) : (
                <>
                  {!comments.data?.length && (
                    <Text style={s.text}>Soyez le premier à commenter.</Text>
                  )}
                  {comments.data?.map((comment) => (
                    <View key={comment.id} style={{ paddingVertical: 12 }}>
                      <Text style={s.small}>
                        {(Array.isArray(comment.profiles)
                          ? comment.profiles[0]
                          : comment.profiles
                        )?.full_name || "Membre FootNation"}
                      </Text>
                      <Text style={s.text}>{comment.content}</Text>
                    </View>
                  ))}
                  {comments.data?.length === limit && (
                    <Button
                      title="Voir plus"
                      onPress={() => setLimit((value) => value + 30)}
                    />
                  )}
                </>
              )}
            </ScrollView>
            <Field
              label="Votre commentaire"
              value={draft}
              onChangeText={(value) => {
                setDraft(value);
                send.reset();
              }}
              maxLength={NEWS_COMMENT_LIMIT}
              multiline
              editable={!!uid && !send.isPending}
            />
            {!!(sendError || needsProfile || needsLogin) && (
              <Text accessibilityRole="alert" style={s.small}>
                {sendError?.message ||
                  (needsLogin
                    ? "Connectez-vous pour publier un commentaire."
                    : missingCommentProfile().message)}
              </Text>
            )}
            <Button
              title={
                needsLogin
                  ? "Se connecter pour commenter"
                  : needsProfile
                    ? "Finaliser mon profil et revenir au commentaire"
                    : send.isPending
                      ? "Envoi…"
                      : "Publier le commentaire"
              }
              disabled={
                send.isPending ||
                (!needsProfile && !needsLogin && !draft.trim())
              }
              onPress={() =>
                needsProfile || needsLogin
                  ? completeAccount()
                  : send.mutate(draft)
              }
            />
            <Button title="Fermer" secondary onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
