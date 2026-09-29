import React, { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Chip,
  Empty,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { useTheme } from "../theme";
import {
  supportCategories,
  supportDraft,
  supportError,
  supportRpc,
  supportStatuses,
  supportUnavailable,
  type SupportCategory,
  type SupportInbox,
  type SupportStatus,
  type SupportThread,
  type SupportTicket,
} from "../lib/support";

const date = (value: string) =>
  new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
function useSupportFocus() {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}
function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  const s = useUIStyles();
  const { colors } = useTheme();
  return (
    <View style={s.card}>
      <Text
        accessibilityRole="alert"
        style={[s.text, { color: colors.danger }]}
      >
        {supportError(error)}
      </Text>
      {!!retry && <Button secondary title="Réessayer" onPress={retry} />}
      {supportUnavailable(error) && (
        <Button
          title="Ouvrir le formulaire de contact"
          onPress={() => router.push("/contact")}
        />
      )}
    </View>
  );
}
function Status({ value }: { value: SupportStatus }) {
  const s = useUIStyles();
  const ink = {
    in_progress: "#155BC2",
    resolved: "#087654",
    closed: "#596578",
  }[value];
  const bg = { in_progress: "#EAF2FF", resolved: "#E6F6EF", closed: "#F0F3F7" }[
    value
  ];
  return (
    <Text
      style={[
        s.small,
        {
          color: ink,
          backgroundColor: bg,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 20,
          fontWeight: "700",
          alignSelf: "flex-start",
        },
      ]}
    >
      {supportStatuses[value]}
    </Text>
  );
}

export default function Support() {
  const { session } = useAuth();
  return (
    <Screen title="Demandes d’aide">
      <AuthGate>
        {!!session && <Inbox key={session.user.id} uid={session.user.id} />}
      </AuthGate>
    </Screen>
  );
}
function Inbox({ uid }: { uid: string }) {
  const s = useUIStyles();
  const focused = useSupportFocus();
  const [filter, setFilter] = useState<SupportStatus | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["support", uid, "inbox", filter],
    initialPageParam: null as { time: string; id: string } | null,
    queryFn: ({ pageParam }) =>
      supportRpc<SupportInbox>(uid, "list_support_requests", {
        p_status: filter,
        p_before_time: pageParam?.time ?? null,
        p_before_id: pageParam?.id ?? null,
      }),
    getNextPageParam: (page) => {
      const last = page.tickets.at(-1);
      return page.tickets.length === 30 && last
        ? { time: last.updated_at, id: last.id }
        : undefined;
    },
    enabled: focused,
    refetchInterval: focused ? 10000 : false,
    retry: false,
  });
  const first = query.data?.pages[0];
  const tickets = [
    ...new Map(
      query.data?.pages.flatMap((p) => p.tickets).map((t) => [t.id, t]) || [],
    ).values(),
  ];
  return (
    <>
      <Text style={s.title}>
        {first?.staff ? "Les demandes des membres" : "À votre écoute"}
      </Text>
      <Text style={s.subtitle}>
        {first?.staff
          ? "Messagerie du superadmin · Centre d’aide FootNation"
          : "Échangez avec le centre d’aide FootNation et retrouvez ici toutes les réponses de l’équipe."}
      </Text>
      <Button
        title="Créer une demande"
        onPress={() => router.push("/support/new")}
      />
      <View style={[s.row, { flexWrap: "wrap", gap: 8 }]}>
        <Chip
          label="Toutes"
          selected={filter === null}
          onPress={() => setFilter(null)}
        />
        {(Object.keys(supportStatuses) as SupportStatus[]).map((status) => (
          <Chip
            key={status}
            label={`${supportStatuses[status]}${first ? ` · ${first.counts[status]}` : ""}`}
            selected={filter === status}
            onPress={() => setFilter(status)}
          />
        ))}
      </View>
      {query.isPending && <Loading />}
      {!!query.error && (
        <Failure error={query.error} retry={() => void query.refetch()} />
      )}
      {first && !tickets.length && (
        <Empty
          title="Aucune demande"
          description={
            filter
              ? "Aucun ticket avec ce statut."
              : "Créez une demande pour commencer une conversation avec notre équipe."
          }
        />
      )}
      {tickets.map((ticket) => (
        <Pressable
          key={ticket.id}
          accessibilityRole="button"
          accessibilityLabel={`${ticket.subject}, ${supportStatuses[ticket.status]}`}
          onPress={() => router.push(`/support/${ticket.id}`)}
          style={s.card}
        >
          <View style={s.between}>
            <Status value={ticket.status} />
            <Text style={s.small}>{date(ticket.updated_at)}</Text>
          </View>
          <Text style={s.h2}>{ticket.subject}</Text>
          <Text style={s.small}>
            {supportCategories[ticket.category]} ·{" "}
            {ticket.ticket_number.slice(0, 11)}
          </Text>
          <Text style={s.text}>Ouvrir la conversation →</Text>
        </Pressable>
      ))}
      {query.hasNextPage && (
        <Button
          secondary
          title="Afficher les demandes précédentes"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
      <Button
        secondary
        title="Actualiser les demandes"
        busy={query.isRefetching}
        onPress={() => void query.refetch()}
      />
    </>
  );
}

export function SupportCreate() {
  const { session } = useAuth();
  return (
    <Screen title="Nouvelle demande">
      <AuthGate>
        {!!session && <Create key={session.user.id} uid={session.user.id} />}
      </AuthGate>
    </Screen>
  );
}
function Create({ uid }: { uid: string }) {
  const s = useUIStyles();
  const cache = useQueryClient();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<SupportCategory>("account");
  const snapshot = useRef<{
    id: string;
    subject: string;
    message: string;
    category: SupportCategory;
  } | null>(null);
  const send = useMutation({
    mutationFn: async () => {
      if (!snapshot.current)
        snapshot.current = {
          id: randomUUID(),
          ...supportDraft(subject, category, message),
        };
      const draft = snapshot.current;
      return supportRpc<string>(uid, "create_support_request", {
        p_id: draft.id,
        p_subject: draft.subject,
        p_category: draft.category,
        p_message: draft.message,
      });
    },
    onSuccess: (id) => {
      void cache.invalidateQueries({ queryKey: ["support", uid] });
      router.replace(`/support/${id}`);
    },
  });
  const locked = send.isPending || !!snapshot.current;
  return (
    <>
      <Text style={s.title}>Discuter avec FootNation</Text>
      <Text style={s.subtitle}>
        Décrivez votre besoin. Votre demande et les réponses de l’équipe
        resteront dans cette conversation privée.
      </Text>
      <Field
        label="Sujet"
        value={subject}
        onChangeText={setSubject}
        maxLength={160}
        editable={!locked}
        placeholder="Comment pouvons-nous vous aider ?"
      />
      <Text style={s.label}>Catégorie</Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {(Object.keys(supportCategories) as SupportCategory[]).map((c) => (
          <Chip
            key={c}
            label={supportCategories[c]}
            selected={c === category}
            onPress={() => {
              if (!locked) setCategory(c);
            }}
          />
        ))}
      </View>
      <Field
        label="Votre message"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={5000}
        editable={!locked}
        placeholder="Expliquez votre demande…"
      />
      <Text style={s.small}>
        {message.length}/5 000 · Ne communiquez jamais votre mot de passe.
      </Text>
      {send.isError && (
        <>
          <Failure error={send.error} />
          <Text style={s.small}>
            Réessayez avec le même contenu pour éviter de créer deux demandes.
          </Text>
        </>
      )}
      <Button
        title={send.isError ? "Réessayer la création" : "Créer ma demande"}
        busy={send.isPending}
        disabled={subject.trim().length < 3 || !message.trim()}
        onPress={() => send.mutate()}
      />
      <Button
        title="Retrouver mes demandes"
        secondary
        onPress={() => router.replace("/support")}
      />
    </>
  );
}

export function SupportConversation() {
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen title="Conversation d’aide">
      <AuthGate>
        {!!session && (
          <Conversation
            key={`${session.user.id}:${id}`}
            uid={session.user.id}
            id={id}
          />
        )}
      </AuthGate>
    </Screen>
  );
}
function Conversation({ uid, id }: { uid: string; id: string }) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const cache = useQueryClient();
  const focused = useSupportFocus();
  const [message, setMessage] = useState("");
  const snapshot = useRef<{ id: string; message: string } | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["support", uid, "thread", id],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) =>
      supportRpc<SupportThread>(uid, "read_support_request", {
        p_id: id,
        p_before: pageParam,
      }),
    getNextPageParam: (page) =>
      page.messages.length === 50 ? page.messages.at(-1)?.sequence : undefined,
    enabled: focused,
    refetchInterval: focused ? 5000 : false,
    retry: false,
  });
  const refresh = () => cache.invalidateQueries({ queryKey: ["support", uid] });
  const send = useMutation({
    mutationFn: () => {
      if (!snapshot.current)
        snapshot.current = { id: randomUUID(), message: message.trim() };
      return supportRpc<string>(uid, "reply_support_request", {
        p_request_id: id,
        p_id: snapshot.current.id,
        p_message: snapshot.current.message,
      });
    },
    onSuccess: () => {
      snapshot.current = null;
      setMessage("");
      void refresh();
    },
    onError: () => {
      void refresh();
    },
  });
  const status = useMutation({
    mutationFn: ({
      ticket,
      next,
    }: {
      ticket: SupportTicket;
      next: SupportStatus;
    }) =>
      supportRpc(uid, "set_support_request_status", {
        p_id: id,
        p_status: next,
        p_revision: ticket.revision,
      }),
    onSettled: () => {
      void refresh();
    },
  });
  const data = query.data?.pages[0];
  if (!data)
    return query.error ? (
      <Failure error={query.error} retry={() => void query.refetch()} />
    ) : (
      <Loading />
    );
  const ticket = data.ticket;
  const messages = [
    ...new Map(
      query.data!.pages.flatMap((p) => p.messages).map((m) => [m.id, m]),
    ).values(),
  ].sort((a, b) => a.sequence - b.sequence);
  return (
    <>
      <View style={s.card}>
        <View style={s.between}>
          <Text style={s.small}>CENTRE D’AIDE FOOTNATION</Text>
          <Status value={ticket.status} />
        </View>
        <Text style={s.title}>{ticket.subject}</Text>
        <Text style={s.small}>
          {supportCategories[ticket.category]} · Créé le{" "}
          {date(ticket.created_at)}
        </Text>
        <Text selectable style={s.small}>
          {ticket.ticket_number}
        </Text>
        {data.staff && ticket.user_id !== uid && (
          <Button
            secondary
            title="Voir le profil du demandeur"
            onPress={() => router.push(`/profile/${ticket.user_id}`)}
          />
        )}
        <Text style={s.small}>
          {ticket.status === "in_progress"
            ? "En cours : la demande peut recevoir des réponses."
            : ticket.status === "resolved"
              ? "Résolu : une réponse a été apportée. Un nouveau message remettra la demande en cours."
              : "Terminé : la conversation est clôturée. Vous pouvez la rouvrir si besoin."}
        </Text>
        <View style={{ gap: 8 }}>
          {ticket.status !== "in_progress" && (
            <Button
              secondary
              title="Rouvrir la demande"
              busy={status.isPending}
              disabled={send.isPending}
              onPress={() => status.mutate({ ticket, next: "in_progress" })}
            />
          )}
          {ticket.status === "in_progress" && (
            <Button
              secondary
              title="Marquer comme résolu"
              busy={status.isPending}
              disabled={send.isPending}
              onPress={() => status.mutate({ ticket, next: "resolved" })}
            />
          )}
          {ticket.status !== "closed" && (
            <Button
              secondary
              title="Terminer le ticket"
              busy={status.isPending}
              disabled={send.isPending}
              onPress={() => status.mutate({ ticket, next: "closed" })}
            />
          )}
        </View>
      </View>
      {status.isError && <Failure error={status.error} />}
      {!!query.error && (
        <Failure error={query.error} retry={() => void query.refetch()} />
      )}
      {query.hasNextPage && (
        <Button
          secondary
          title="Afficher les messages précédents"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
      {messages.map((item) =>
        item.kind === "status" ? (
          <Text
            key={item.id}
            style={[s.small, { textAlign: "center", paddingVertical: 6 }]}
          >
            {item.author_kind === "support" ? "Centre d’aide" : "Demandeur"} ·{" "}
            {supportStatuses[item.body as SupportStatus] || item.body} ·{" "}
            {date(item.created_at)}
          </Text>
        ) : (
          <View
            key={item.id}
            style={[
              s.card,
              {
                alignSelf: item.author_id === uid ? "flex-end" : "flex-start",
                width: "92%",
                backgroundColor:
                  item.author_kind === "support"
                    ? colors.accentSoft
                    : colors.surface,
              },
            ]}
          >
            <View style={[s.between, { flexWrap: "wrap" }]}>
              <Text style={[s.small, { fontWeight: "700" }]}>
                {item.author_kind === "support"
                  ? "Centre d’aide FootNation"
                  : item.author_id === uid
                    ? "Vous"
                    : "Demandeur"}
              </Text>
              <Text style={s.small}>{date(item.created_at)}</Text>
            </View>
            <Text selectable style={s.text}>
              {item.body}
            </Text>
          </View>
        ),
      )}
      {ticket.status !== "closed" && (
        <View style={s.card}>
          <Field
            label="Votre réponse"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={5000}
            editable={!send.isPending && !snapshot.current}
            placeholder="Écrivez votre message…"
          />
          {send.isError && <Failure error={send.error} />}
          <Button
            title={send.isError ? "Réessayer l’envoi" : "Envoyer la réponse"}
            busy={send.isPending}
            disabled={!message.trim() || status.isPending}
            onPress={() => send.mutate()}
          />
        </View>
      )}
      <Button
        secondary
        title="Actualiser la conversation"
        busy={query.isRefetching}
        onPress={() => void query.refetch()}
      />
      <Button
        secondary
        title="Toutes les demandes"
        onPress={() => router.replace("/support")}
      />
    </>
  );
}
