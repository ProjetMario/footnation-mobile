import { MessageText } from "../components/MessageText";
import { type MessageProposal } from "../lib/messageOutbox";
import { messageOutbox } from "../lib/messageOutboxStorage";
import {
  messageSendStep,
  persistMessageBeforeSend,
} from "../lib/messageSubmission";
import { randomUUID } from "expo-crypto";
import { createProContent } from "../lib/proContentSave";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
  type ViewToken,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCalls } from "../components/CallProvider";
import { useAuth } from "../lib/auth";
import { useProfile, useThread } from "../lib/data";
import {
  isActivityOnline,
  useProfileActivity,
} from "../lib/profilePresence";
import { supabase } from "../lib/supabase";
import { displayName, type Message, type Profile } from "../lib/models";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { AuthGate } from "../components/AuthGate";
import { visibleMessageReads } from "../lib/visibleMessageReads";
import { useTheme } from "../theme";
import { MessageMediaComposer } from "../components/MessageMediaComposer";
import { MessageAttachmentView } from "../components/MessageAttachmentView";
import {
  attachmentLabel,
  makeAttachment,
  normalizeAttachment,
  type LocalMessageFile,
} from "../lib/messageAttachment";
import {
  discardMessageFile,
  uploadMessageFile,
} from "../lib/messageAttachmentStorage";

type ConversationSummaryCache = {
  pages?: (Message & { unread_count?: number })[][];
};


function latestIsoDate(values: (string | null | undefined)[]) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
}

async function readLatestPublicProfileActivity(profileId: string) {
  const latestFrom = async (table: "posts" | "shorts" | "stories" | "opportunities") => {
    const result = await supabase
      .from(table)
      .select("created_at")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) return null;
    return (result.data as { created_at?: string | null } | null)?.created_at || null;
  };
  const rows = await Promise.all([
    latestFrom("posts"),
    latestFrom("shorts"),
    latestFrom("stories"),
    latestFrom("opportunities"),
  ]);
  return latestIsoDate(rows);
}
function compactLastActivity(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return null;
  const diff = Date.now() - time;
  if (diff < 60_000) return "Dernière activité à l’instant";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `Dernière activité il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Dernière activité il y a ${hours} h`;
  if (hours < 48) return "Dernière activité hier";
  return `Dernière activité le ${date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  })}`;
}
export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  return <ConversationContent key={`${session?.user.id}/${id}`} id={id} />;
}
function ConversationContent({ id }: { id: string }) {
  const { colors, mode: themeMode } = useTheme();
  const s = useUIStyles();

  const { session, profile } = useAuth();
  const peer = useProfile(id);
  const cache = useQueryClient();
  const cachedPeer = useMemo(() => {
    const entries = cache.getQueriesData<ConversationSummaryCache>({
      queryKey: ["conversations", session?.user.id],
    });
    for (const [, snapshot] of entries) {
      for (const row of snapshot?.pages?.flat() || []) {
        if (row.sender_id === id) return row.sender as Profile | undefined;
        if (row.receiver_id === id) return row.receiver as Profile | undefined;
      }
    }
    return undefined;
  }, [cache, session?.user.id, id]);
  const peerProfile = peer.data ?? cachedPeer ?? null;
  const peerName =
    peerProfile || !peer.isPending ? displayName(peerProfile) : "Chargement…";
  const relations = useQuery({
    queryKey: ["conversation-permission", session?.user.id, id],
    enabled: !!session && !!id,
    refetchInterval: 30000,
    queryFn: async () => {
      const uid = session!.user.id;
      const { data, error } = await supabase
        .from("connections")
        .select("id")
        .eq("status", "accepted")
        .or(
          `and(user_id.eq.${uid},connected_user_id.eq.${id}),and(user_id.eq.${id},connected_user_id.eq.${uid})`,
        )
        .limit(1);
      if (error) throw error;
      return !!data?.length;
    },
  });
  const query = useThread(id);
  const calls = useCalls();
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<LocalMessageFile | null>(null);
  const [recording, setRecording] = useState(false);
  const attachments = useQuery({
    queryKey: ["message-attachments-capability", session?.user.id],
    enabled: !!session && Platform.OS !== "web",
    retry: false,
    staleTime: 60000,
    queryFn: async () => {
      const result = await supabase.rpc("native_message_attachments_available");
      if (result.error) return false;
      return result.data === 1;
    },
  });
  const [proposal, setProposal] = useState<MessageProposal | null>(null);
  const [proposalPersisted, setProposalPersisted] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [localError, setLocalError] = useState<unknown>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const retainedDraft = useRef({ file, keep: !!proposal });
  retainedDraft.current = { file, keep: !!proposal };
  useEffect(() => {
    const uid = session?.user.id;
    return () => {
      if (uid && !retainedDraft.current.keep)
        discardMessageFile(uid, retainedDraft.current.file?.uri);
    };
  }, [session?.user.id]);
  const sending = useRef(false);
  const [outboxReady, setOutboxReady] = useState(false);
  const [outboxError, setOutboxError] = useState<unknown>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    const uid = session?.user.id;
    if (!uid) return;
    setOutboxReady(false);
    setOutboxError(null);
    void messageOutbox
      .load(uid, id)
      .then((saved) => {
        if (!mounted) return;
        setProposal(saved);
        setProposalPersisted(!!saved);
        if (saved) setDraft(saved.content);
        if (saved?.attachment && saved.localAttachmentUri)
          setFile({ ...saved.attachment, uri: saved.localAttachmentUri });
        setOutboxReady(true);
      })
      .catch((error) => {
        if (mounted) setOutboxError(error);
      });
    return () => {
      mounted = false;
    };
  }, [session?.user.id, id, loadAttempt]);

  const allowed = !!peer.data?.is_admin || relations.data === true;
  const [focused, setFocused] = useState(false);
  const activity = useProfileActivity(id, focused);
  const publicActivity = useQuery({
    queryKey: ["conversation-profile-public-activity", id],
    enabled: !!session && !!id,
    staleTime: 60000,
    queryFn: () => readLatestPublicProfileActivity(id),
  });
  const [active, setActive] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  const context = useRef({
    uid: session?.user.id,
    peer: id,
    active: active && focused,
  });
  context.current = {
    uid: session?.user.id,
    peer: id,
    active: active && focused,
  };
  const isCurrentMessage = (message: MessageProposal) =>
    mounted.current &&
    context.current.uid === message.sender_id &&
    context.current.peer === message.receiver_id;
  const assertCurrentMessage = (message: MessageProposal) => {
    if (!isCurrentMessage(message))
      throw new Error("Votre session a changé. Rouvrez la conversation.");
  };
  const completed = useRef(new Set<string>());
  useEffect(() => {
    completed.current.clear();
  }, [id, session?.user.id]);
  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 60,
    minimumViewTime: 500,
  }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setVisibleIds(
        viewableItems
          .filter((item) => item.isViewable)
          .map((item) => String(item.key)),
      );
    },
  ).current;
  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      const uid = session?.user.id;
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (
        !uid ||
        auth.data.user?.id !== uid ||
        context.current.uid !== uid ||
        context.current.peer !== id ||
        !context.current.active
      )
        return [];
      const result = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("receiver_id", uid)
        .eq("sender_id", id)
        .in("id", ids)
        .is("read_at", null)
        .or("is_blocked.is.null,is_blocked.eq.false")
        .select("id");
      if (result.error) throw result.error;
      return ids;
    },
    onSuccess: (ids) => {
      ids.forEach((messageId) => completed.current.add(messageId));
      if (ids.length) {
        void cache.invalidateQueries({ queryKey: ["conversations"] });
        void cache.invalidateQueries({ queryKey: ["thread"] });
      }
    },
  });
  useEffect(() => {
    if (markRead.isPending || markRead.error) return;
    const ids = visibleMessageReads(
      query.data?.pages.flat() || [],
      visibleIds,
      session?.user.id,
      id,
      active && focused,
      completed.current,
    );
    if (ids.length) markRead.mutate(ids);
  }, [
    query.data,
    visibleIds,
    session?.user.id,
    id,
    active,
    focused,
    markRead.isPending,
    markRead.error,
  ]);
  const threadMessages = query.data?.pages.flat() || [];
  const peerLastMessage = threadMessages.find((message) => message.sender_id === id);
  const peerOnline = isActivityOnline(activity.data, activity.dataUpdatedAt);
  const peerProfileDates = peerProfile as
    | { last_seen_at?: string | null; updated_at?: string | null; created_at?: string | null }
    | null;
  const peerLastActivitySource = latestIsoDate([
    activity.data?.last_seen_at,
    publicActivity.data,
    peerLastMessage?.created_at,
    peerProfileDates?.last_seen_at,
    peerProfileDates?.updated_at,
    peerProfileDates?.created_at,
  ]);
  const peerLastActivity =
    compactLastActivity(peerLastActivitySource) || "Dernière activité inconnue";
  const peerStatus = peerOnline ? "En ligne" : peerLastActivity;
  const quickEmojis = ["⚽", "🔥", "👏", "😂", "❤️", "💪", "🏆", "🙏"];
  const addEmoji = (emoji: string) => {
    setDraft((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}${emoji}`);
  };

  const send = useMutation({
    mutationFn: async (message: MessageProposal) => {
      assertCurrentMessage(message);
      const auth = await messageSendStep(message, assertCurrentMessage, () =>
        supabase.auth.getUser(),
      );
      if (auth.error) throw auth.error;
      if (
        !session ||
        auth.data.user?.id !== message.sender_id ||
        session.user.id !== message.sender_id ||
        message.receiver_id !== id ||
        context.current.uid !== message.sender_id
      )
        throw new Error("Votre session a changé. Rouvrez la conversation.");
      await createProContent(
        {
          read: async (recordId) => {
            const result = await messageSendStep(
              message,
              assertCurrentMessage,
              () =>
                supabase
                  .from("messages")
                  .select(
                    message.attachment
                      ? "id,sender_id,receiver_id,content,attachment"
                      : "id,sender_id,receiver_id,content",
                  )
                  .eq("id", recordId)
                  .eq("sender_id", message.sender_id)
                  .eq("receiver_id", id)
                  .maybeSingle(),
            );
            if (result.error) throw result.error;
            if (!result.data) return null;
            const row = result.data as unknown as Record<string, unknown>;
            return message.attachment
              ? {
                  ...row,
                  attachment: normalizeAttachment(
                    row.attachment,
                    message.sender_id,
                    id,
                    message.id,
                  ),
                }
              : row;
          },
          insert: async () => {
            const [freshRelation, freshPeer] = await messageSendStep(
              message,
              assertCurrentMessage,
              () =>
                Promise.all([
                  supabase
                    .from("connections")
                    .select("id")
                    .eq("status", "accepted")
                    .or(
                      `and(user_id.eq.${message.sender_id},connected_user_id.eq.${id}),and(user_id.eq.${id},connected_user_id.eq.${message.sender_id})`,
                    )
                    .limit(1),
                  supabase
                    .from("profiles")
                    .select("is_admin")
                    .eq("id", id)
                    .maybeSingle(),
                ]),
            );
            if (freshRelation.error || freshPeer.error)
              throw new Error(
                "Impossible de vérifier les droits de cette conversation.",
              );
            if (!freshRelation.data?.length && !freshPeer.data?.is_admin)
              throw new Error("Cette relation n’est plus acceptée.");
            const { data: blocks, error: blockError } = await messageSendStep(
              message,
              assertCurrentMessage,
              () =>
                supabase
                  .from("user_blocks")
                  .select("id")
                  .or(
                    `and(blocker_id.eq.${message.sender_id},blocked_id.eq.${id}),and(blocker_id.eq.${id},blocked_id.eq.${message.sender_id})`,
                  )
                  .limit(1),
            );
            if (blockError) throw blockError;
            if (blocks?.length)
              throw new Error("Cette conversation est bloquée.");
            const { attachment, localAttachmentUri } = message;
            if (attachment && localAttachmentUri)
              await messageSendStep(message, assertCurrentMessage, () =>
                uploadMessageFile(
                  message.sender_id,
                  attachment,
                  localAttachmentUri,
                ),
              );
            const freshAuth = await messageSendStep(
              message,
              assertCurrentMessage,
              () => supabase.auth.getUser(),
            );
            if (
              freshAuth.error ||
              freshAuth.data.user?.id !== message.sender_id ||
              context.current.uid !== message.sender_id
            )
              throw new Error("Votre session a changé.");
            const { localAttachmentUri: _local, ...payload } = message;
            const { error } = await messageSendStep(
              message,
              assertCurrentMessage,
              () => supabase.from("messages").insert(payload),
            );
            if (error?.code === "42501")
              throw new Error(
                "L’envoi n’est plus autorisé. Vérifiez que la relation est acceptée et que la conversation n’est pas bloquée.",
              );
            if (error) throw error;
          },
        },
        {
          id: message.id,
          sender_id: message.sender_id,
          receiver_id: message.receiver_id,
          content: message.content,
          ...(message.attachment ? { attachment: message.attachment } : {}),
        },
      );
      assertCurrentMessage(message);
      await messageOutbox.remove(message);
      discardMessageFile(message.sender_id, message.localAttachmentUri);
    },
    onSuccess: (_result, message) => {
      if (!isCurrentMessage(message)) return;
      setDraft("");
      setProposal(null);
      setProposalPersisted(false);
      setFile(null);
      void cache.invalidateQueries({ queryKey: ["thread"] });
      void cache.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
  // Abandoning a local draft is available offline. It never recalls a received
  // message or removes an uploaded object on the server.
  const abandon = async () => {
    if (sending.current || !proposal) return;
    const message = proposal;
    sending.current = true;
    setAbandoning(true);
    setLocalError(null);
    try {
      assertCurrentMessage(message);
      await messageOutbox.remove(message);
      discardMessageFile(message.sender_id, message.localAttachmentUri);
      if (!isCurrentMessage(message)) return;
      setProposal(null);
      setProposalPersisted(false);
      setFile(null);
      send.reset();
    } catch (error) {
      if (isCurrentMessage(message)) setLocalError(error);
    } finally {
      sending.current = false;
      if (mounted.current) setAbandoning(false);
    }
  };
  const submit = async () => {
    if (
      !outboxReady ||
      abandoning ||
      sending.current ||
      send.isPending ||
      !session ||
      recording
    )
      return;
    let message: MessageProposal;
    try {
      const messageId = proposal?.id || randomUUID();
      message = proposal || {
        id: messageId,
        sender_id: session.user.id,
        receiver_id: id,
        content: draft.trim() || (file ? attachmentLabel(file) : ""),
        ...(file
          ? {
              attachment: makeAttachment(
                file,
                session.user.id,
                id,
                messageId,
                randomUUID(),
              ),
              localAttachmentUri: file.uri,
            }
          : {}),
      };
    } catch (error) {
      setLocalError(error);
      return;
    }
    if (!message.content) return;
    sending.current = true;
    setPreparing(true);
    setLocalError(null);
    retainedDraft.current.keep = true;
    setProposal(message);
    try {
      await persistMessageBeforeSend(message, {
        assertCurrent: assertCurrentMessage,
        save: (snapshot) => messageOutbox.save(snapshot),
        persisted: (snapshot) => {
          if (isCurrentMessage(snapshot)) setProposalPersisted(true);
        },
        send: async (snapshot) => {
          if (mounted.current) setPreparing(false);
          await send.mutateAsync(snapshot);
        },
      });
    } catch (error) {
      if (isCurrentMessage(message)) setLocalError(error);
    } finally {
      sending.current = false;
      if (mounted.current) setPreparing(false);
    }
  };
  return (
    <Screen
      title={peerName}
      titleNode={
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <Text
            accessibilityRole="header"
            style={[s.h2, { flexShrink: 1 }]}
            numberOfLines={1}
          >
            {peerName}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
            }}
          >
            <View
              accessibilityRole="text"
              accessibilityLabel={peerOnline ? "En ligne" : "Hors ligne"}
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: peerOnline ? "#1CC75C" : colors.muted,
              }}
            />
            <Text
              accessibilityLiveRegion="polite"
              style={[s.small, { color: colors.muted }]}
              numberOfLines={1}
            >
              {peerStatus}
            </Text>
          </View>
        </View>
      }
      scroll={false}
    >
      <AuthGate>
        <View
          style={[
            s.row,
            { paddingHorizontal: 12, paddingVertical: 4, flexWrap: "wrap" },
          ]}
        >
          <Button
            title="Voir le profil"
            secondary
            onPress={() => router.push(`/profile/${id}`)}
          />
          <Button
            title="Signaler ou bloquer"
            secondary
            onPress={() => router.push(`/report/${id}`)}
          />
        </View>
        {!!(calls.available && (allowed || profile?.is_admin)) && (
          <View style={[s.row, { padding: 12 }]}>
            <Button
              title="Appel vocal"
              disabled={recording}
              secondary
              onPress={() =>
                void calls.startCall(
                  {
                    id,
                    name: peerName,
                    avatarUrl: peer.data?.avatar_url,
                  },
                  "audio",
                )
              }
            />
            <Button
              title="Appel vidéo"
              disabled={recording}
              secondary
              onPress={() =>
                void calls.startCall(
                  {
                    id,
                    name: peerName,
                    avatarUrl: peer.data?.avatar_url,
                  },
                  "video",
                )
              }
            />
          </View>
        )}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <FlatList
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            inverted
            data={threadMessages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 20, gap: 10 }}
            renderItem={({ item }) => {
              const own = item.sender_id === session?.user.id;
              return (
                <View
                  style={{
                    alignSelf: own ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    padding: 14,
                    borderRadius: 18,
                    backgroundColor: own ? "#0064D8" : colors.surfaceRaised,
                    borderWidth: own ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <MessageText
                    content={item.is_blocked ? "Message masqué" : item.content}
                    color={own ? "white" : colors.ink}
                  />
                  {!!(!item.is_blocked && item.attachment) && (
                    <MessageAttachmentView
                      key={`${session?.user.id}/${item.id}`}
                      message={item}
                      active={
                        active &&
                        focused &&
                        !recording &&
                        visibleIds.includes(item.id)
                      }
                    />
                  )}
                  <Text
                    style={[
                      s.small,
                      {
                        color: own ? "#E2ECFF" : colors.muted,
                        alignSelf: "flex-end",
                        marginTop: 5,
                      },
                    ]}
                  >
                    {new Date(item.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {own
                      ? ` · ${item.is_blocked ? "Masqué" : item.read_at ? "Lu" : "Envoyé"}`
                      : ""}
                  </Text>
                </View>
              );
            }}
            onEndReached={() => {
              if (query.hasNextPage && !query.isFetching && !query.isError)
                void query.fetchNextPage();
            }}
            ListFooterComponent={
              <View style={{ gap: 12 }}>
                {query.error && query.data ? (
                  <ErrorState
                    error={query.error}
                    retry={() => void query.refetch()}
                  />
                ) : null}
                {query.hasNextPage ? (
                  <Button
                    title="Charger les messages précédents"
                    secondary
                    busy={query.isFetchingNextPage}
                    onPress={() => void query.fetchNextPage()}
                  />
                ) : null}
              </View>
            }
            ListEmptyComponent={
              query.isPending ? (
                <Loading />
              ) : query.isError ? (
                <ErrorState
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              ) : (
                <View style={{ transform: [{ scaleY: -1 }] }}>
                  <Empty
                    title="Aucun message pour le moment"
                    description="Votre échange apparaîtra ici."
                  />
                </View>
              )
            }
          />
          {!!markRead.error && (
            <ErrorState error={markRead.error} retry={() => markRead.reset()} />
          )}
          <View
            style={{
              padding: 16,
              borderTopWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              gap: 10,
            }}
          >
            {!!(!allowed && !relations.isPending) && (
              <View style={{ gap: 8 }}>
                <Text style={s.small}>
                  Ajoutez ce membre à votre réseau pour lui écrire.
                </Text>
                <Button
                  title="Voir le profil et l’inviter"
                  secondary
                  onPress={() => router.push(`/profile/${id}`)}
                />
                {!!relations.error && (
                  <ErrorState
                    error={relations.error}
                    retry={() => void relations.refetch()}
                  />
                )}
              </View>
            )}
            {!!outboxError && (
              <ErrorState
                error={outboxError}
                retry={() => setLoadAttempt((n) => n + 1)}
              />
            )}
            {!!localError && <ErrorState error={localError} />}
            {!outboxReady && !outboxError ? (
              <Text style={s.small}>Récupération des envois en attente…</Text>
            ) : null}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {quickEmojis.map((emoji) => (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`Ajouter ${emoji}`}
                  onPress={() => addEmoji(emoji)}
                  disabled={!outboxReady || !allowed || !!proposal || preparing || send.isPending || abandoning}
                  style={({ pressed }) => ({
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed
                      ? colors.surfaceRaised
                      : colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity:
                      !outboxReady || !allowed || !!proposal || preparing || send.isPending || abandoning
                        ? 0.45
                        : 1,
                  })}
                >
                  <Text style={{ fontSize: 20 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              accessibilityLabel="Votre message"
              placeholder="Votre message…"
              placeholderTextColor={colors.muted}
              keyboardAppearance={themeMode}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={10000}
              style={[s.input, { maxHeight: 120 }]}
              editable={
                outboxReady &&
                allowed &&
                !proposal &&
                !preparing &&
                !send.isPending &&
                !abandoning
              }
            />
            <Button
              title={proposal ? "Vérifier et réessayer l’envoi" : "Envoyer"}
              onPress={() => void submit()}
              busy={preparing || send.isPending}
              disabled={
                !outboxReady ||
                abandoning ||
                (!draft.trim() && !file) ||
                recording ||
                (!proposal && !allowed)
              }
            />
            {!!(session && attachments.data) && (
              <MessageMediaComposer
                uid={session.user.id}
                file={file}
                onChange={setFile}
                onRecording={setRecording}
                active={focused && !calls.busy}
                disabled={
                  !outboxReady ||
                  !allowed ||
                  !!proposal ||
                  preparing ||
                  send.isPending ||
                  abandoning
                }
              />
            )}
            {!!(proposal && !preparing && !send.isPending) && (
              <View style={{ gap: 8 }}>
                <Text style={s.small}>
                  {proposalPersisted
                    ? "Cette tentative est conservée sur cet appareil. Réessayez pour vérifier si le message a déjà été reçu, sans le dupliquer."
                    : "Cette tentative n’a pas pu être conservée sur cet appareil et aucun envoi n’a été lancé. Gardez cet écran ouvert pour réessayer, ou abandonnez pour modifier votre brouillon."}
                </Text>
                <Button
                  title="Abandonner cette tentative"
                  secondary
                  busy={abandoning}
                  onPress={() => void abandon()}
                />
                <Text style={s.small}>
                  Abandonner ne retire pas un message déjà reçu par le
                  destinataire.
                </Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </AuthGate>
    </Screen>
  );
}
