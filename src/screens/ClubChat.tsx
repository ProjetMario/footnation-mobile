import { loadClubChatGroups } from "../lib/clubChatGroups";
import { ClubMessageReport } from "../components/ClubMessageReport";
import { clubReplyPreview, loadClubReplies } from "../lib/clubReply";
import { ClubMessageActions } from "../components/ClubMessageActions";
import { clubMessageText } from "../lib/clubMessageText";
import React, { useCallback, useState } from "react";
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { createProContent } from "../lib/proContentSave";

export default function ClubChats() {
  const uid = useAuth().session?.user.id;
  return (
    <Screen title="Discussions de mes clubs">
      <AuthGate>{!!uid && <ClubGroupList key={uid} uid={uid} />}</AuthGate>
    </Screen>
  );
}
export function ClubGroupList({
  uid,
  clubId,
}: {
  uid: string;
  clubId?: string;
}) {
  const s = useUIStyles();

  const groups = useInfiniteQuery({
    queryKey: ["native-club-chats", uid, clubId || null],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => loadClubChatGroups(uid, pageParam, clubId),
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  useFocusEffect(
    useCallback(() => {
      void groups.refetch();
    }, [groups.refetch]),
  );
  return (
    <>
      <Button
        title="Mes signalements de club"
        secondary
        onPress={() => router.push("/my-club-reports")}
      />
      <Button
        secondary
        title="Actualiser"
        busy={groups.isFetching}
        onPress={() => void groups.refetch()}
      />
      {!!groups.isPending && <Loading />}
      {!!groups.error && (
        <ErrorState error={groups.error} retry={() => void groups.refetch()} />
      )}
      {!groups.error &&
        groups.data?.pages.flat().map((row) =>
          row.group ? (
            <View key={row.id} style={s.card}>
              <Text style={s.h2}>{row.group.name}</Text>
              <Text style={s.subtitle}>
                {[row.group.club?.name, row.group.team_category]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Button
                title="Ouvrir la discussion"
                onPress={() => router.push(`/club-chat/${row.group.id}`)}
              />
            </View>
          ) : null,
        )}
      {!!(!groups.error && groups.data && !groups.data.pages.flat().length) && (
        <Empty
          title="Aucune discussion de club"
          description="Seuls les groupes auxquels vous êtes ajouté apparaissent ici."
        />
      )}
      {!!(!groups.error && groups.hasNextPage) && (
        <Button
          title="Charger la suite"
          busy={groups.isFetchingNextPage}
          onPress={() => void groups.fetchNextPage()}
        />
      )}
    </>
  );
}
export function ClubConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen title="Discussion du club" scroll={false}>
      <AuthGate>
        <Conversation key={id} id={id} />
      </AuthGate>
    </Screen>
  );
}
function Conversation({ id }: { id: string }) {
  const s = useUIStyles();

  const { session } = useAuth();
  const uid = session!.user.id;
  const cache = useQueryClient();
  const [content, setContent] = useState("");
  const [messageId, setMessageId] = useState(randomUUID);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const access = useQuery({
    queryKey: ["native-club-chat-access", id, uid],
    queryFn: async () => {
      const r = await supabase
        .from("club_chat_group_members")
        .select("id,group:club_chat_groups!group_id(name)")
        .eq("group_id", id)
        .eq("profile_id", uid)
        .maybeSingle();
      if (r.error) throw r.error;
      if (!r.data)
        throw new Error("Vous n’êtes pas membre de cette discussion.");
      return r.data as any;
    },
  });
  const messages = useInfiniteQuery({
    queryKey: ["native-club-chat-messages", id, uid],
    enabled: !!access.data && !access.error,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const r = await supabase
        .from("club_chat_messages")
        .select(
          "id,author_id,content,media_url,is_deleted,is_blocked,created_at,edited_at,reply_to_id,author:profiles!author_id(full_name,avatar_url)",
        )
        .eq("group_id", id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam, pageParam + 29);
      if (r.error) throw r.error;
      return r.data as any[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const rows = [
    ...new Map(
      (messages.data?.pages.flat() || []).map((row) => [row.id, row]),
    ).values(),
  ];
  const referenceIds = [
    ...new Set<string>([
      ...rows
        .filter((row) => !row.is_deleted && !row.is_blocked)
        .map((row) => row.reply_to_id)
        .filter(Boolean),
      ...(replyTo ? [replyTo] : []),
    ]),
  ].sort();
  const references = useQuery({
    queryKey: [
      "native-club-chat-messages",
      id,
      uid,
      "references",
      referenceIds,
    ],
    enabled: !!access.data && !access.error && referenceIds.length > 0,
    queryFn: () =>
      loadClubReplies(referenceIds, async (ids) => {
        const r = await supabase
          .from("club_chat_messages")
          .select("id,content,media_url,is_deleted,is_blocked")
          .eq("group_id", id)
          .in("id", ids);
        if (r.error) throw r.error;
        return r.data;
      }),
  });
  const referenceMap = new Map(
    (references.data || []).map((row) => [row.id, row]),
  );
  const replyLabel = (key: string) => {
    const loaded = rows.find((row) => row.id === key);
    if (loaded?.is_deleted || loaded?.is_blocked) return "Message indisponible";
    return references.error
      ? "Aperçu indisponible — actualisez la discussion"
      : references.isPending
        ? "Chargement du message…"
        : clubReplyPreview(referenceMap.get(key));
  };
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        if (AppState.currentState === "active") {
          void cache.invalidateQueries({
            queryKey: ["native-club-chat-access", id, uid],
          });
          void cache.invalidateQueries({
            queryKey: ["native-club-chat-messages", id, uid],
          });
        }
      }, 15000);
      return () => clearInterval(timer);
    }, [cache, id, uid]),
  );
  const send = useMutation({
    mutationFn: async () => {
      const text = clubMessageText(content);
      const user = await supabase.auth.getUser();
      if (user.error) throw user.error;
      if (user.data.user?.id !== uid)
        throw new Error("La session a changé. Rechargez cet écran.");
      const member = await supabase
        .from("club_chat_group_members")
        .select("id")
        .eq("group_id", id)
        .eq("profile_id", uid)
        .single();
      if (member.error) throw member.error;
      await createProContent(
        {
          read: async (key) => {
            const r = await supabase
              .from("club_chat_messages")
              .select("id,group_id,author_id,content,reply_to_id")
              .eq("id", key)
              .eq("group_id", id)
              .maybeSingle();
            if (r.error) throw r.error;
            return r.data;
          },
          insert: async (row) => {
            if (replyTo) {
              const parent = await supabase
                .from("club_chat_messages")
                .select("id,is_deleted,is_blocked")
                .eq("id", replyTo)
                .eq("group_id", id)
                .maybeSingle();
              if (parent.error) throw parent.error;
              if (
                !parent.data ||
                parent.data.is_deleted ||
                parent.data.is_blocked
              )
                throw new Error(
                  "Le message auquel vous répondez n’est plus disponible. Annulez la réponse pour envoyer un message indépendant.",
                );
            }
            const r = await supabase.from("club_chat_messages").insert(row);
            if (r.error) throw r.error;
          },
        },
        {
          id: messageId,
          group_id: id,
          author_id: uid,
          content: text,
          reply_to_id: replyTo,
        },
      );
    },
    onSuccess: () => {
      setContent("");
      setReplyTo(null);
      setMessageId(randomUUID());
      void messages.refetch();
    },
  });
  if (access.isPending) return <Loading />;
  if (access.error)
    return (
      <ErrorState error={access.error} retry={() => void access.refetch()} />
    );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text style={s.h2}>{access.data?.group?.name}</Text>
        <Button
          secondary
          title="Actualiser"
          busy={messages.isFetching}
          onPress={() => {
            void access.refetch();
            void messages.refetch();
            if (referenceIds.length) void references.refetch();
          }}
        />
      </View>
      {!!messages.error && <ErrorState error={messages.error} />}
      <FlatList
        inverted
        data={messages.error ? [] : rows}
        keyExtractor={(row) => row.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
        onEndReached={() => {
          if (messages.hasNextPage && !messages.isFetchingNextPage)
            void messages.fetchNextPage();
        }}
        ListFooterComponent={messages.isFetchingNextPage ? <Loading /> : null}
        ListEmptyComponent={
          messages.error ? null : messages.isPending ? (
            <Loading />
          ) : (
            <Empty title="Aucun message" />
          )
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Avatar
                uri={item.author?.avatar_url}
                name={item.author?.full_name}
                size={32}
              />
              <Text style={s.text}>
                {item.author_id === uid
                  ? "Vous"
                  : item.author?.full_name || "Membre"}
              </Text>
            </View>
            {item.is_deleted || item.is_blocked ? (
              <Text style={s.subtitle}>Message indisponible.</Text>
            ) : (
              <>
                {!!item.reply_to_id && (
                  <View
                    style={{
                      borderLeftWidth: 2,
                      borderLeftColor: "#64748b",
                      paddingLeft: 10,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={s.small}>En réponse à</Text>
                    <Text numberOfLines={2} style={s.subtitle}>
                      {replyLabel(item.reply_to_id)}
                    </Text>
                  </View>
                )}
                <Text selectable style={s.text}>
                  {item.content}
                </Text>
                {!!item.media_url && (
                  <ExternalLinkButton
                    title="Ouvrir la pièce jointe"
                    url={item.media_url}
                  />
                )}
              </>
            )}
            {!!(item.edited_at && !item.is_deleted && !item.is_blocked) && (
              <Text style={s.small}>Modifié</Text>
            )}
            {!!(!item.is_deleted && !item.is_blocked) && (
              <Button
                title="Répondre"
                secondary
                disabled={send.isPending}
                onPress={() => {
                  setReplyTo(item.id);
                  send.reset();
                }}
              />
            )}
            {!!(
              item.author_id !== uid &&
              !item.is_deleted &&
              !item.is_blocked
            ) && (
              <ClubMessageReport messageId={item.id} groupId={id} uid={uid} />
            )}
            <ClubMessageActions message={item} groupId={id} uid={uid} />
            {!!item.created_at && (
              <Text style={s.small}>
                {new Date(item.created_at).toLocaleString("fr-FR")}
              </Text>
            )}
          </View>
        )}
      />
      <View style={{ padding: 16, gap: 8 }}>
        {!!replyTo && (
          <View style={{ gap: 6 }}>
            <Text style={s.small}>Votre réponse à ce message</Text>
            <Text style={s.subtitle} numberOfLines={2}>
              {replyLabel(replyTo)}
            </Text>
            <Button
              title="Annuler la réponse"
              secondary
              disabled={send.isPending}
              onPress={() => {
                setReplyTo(null);
                send.reset();
              }}
            />
          </View>
        )}
        <Field
          label="Votre message"
          multiline
          maxLength={4000}
          value={content}
          onChangeText={setContent}
          editable={!send.isPending}
        />
        {!!send.error && <ErrorState error={send.error} />}
        <Button
          title="Envoyer"
          busy={send.isPending}
          disabled={!content.trim()}
          onPress={() => send.mutate()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
