import React, { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { displayName } from "../lib/models";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
const statuses = {
  draft: "Brouillon",
  published: "Publié",
  cancelled: "Annulé",
  completed: "Terminé",
};
export default function EventDashboard() {
  return (
    <Screen title="Mes événements">
      <AuthGate>
        <Dashboard />
      </AuthGate>
    </Screen>
  );
}
function Dashboard() {
  const s = useUIStyles();

  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["my-events", session!.user.id, search, status],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("events")
        .select(
          "id,title,status,start_date,current_participants,max_participants",
        )
        .eq("organizer_id", session!.user.id)
        .order("start_date", { ascending: false })
        .order("id");
      if (status) q = q.eq("status", status);
      if (search.trim())
        q = q.ilike("title", `%${search.trim().replace(/[%_]/g, "")}%`);
      const { data, error } = await q.range(pageParam, pageParam + 29);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  return (
    <>
      <Button
        title="Créer un événement"
        onPress={() => router.push("/events/new")}
      />
      <Field
        label="Rechercher mes événements"
        value={search}
        onChangeText={setSearch}
      />
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Chip label="Tous" selected={!status} onPress={() => setStatus("")} />
        {Object.entries(statuses).map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={status === value}
            onPress={() => setStatus(value)}
          />
        ))}
      </View>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : !query.data.pages.flat().length ? (
        <Empty title="Aucun événement" />
      ) : (
        query.data.pages.flat().map((event) => (
          <View key={event.id} style={s.card}>
            <Text style={s.h2}>{event.title}</Text>
            <Text style={s.small}>
              {statuses[event.status as keyof typeof statuses] || event.status}{" "}
              · {new Date(event.start_date).toLocaleString("fr-FR")}
            </Text>
            <Text style={s.text}>
              {event.current_participants || 0}
              {event.max_participants
                ? ` / ${event.max_participants}`
                : ""}{" "}
              participants
            </Text>
            <Button
              title="Gérer l’événement"
              onPress={() => router.push(`/events/${event.id}/manage`)}
            />
          </View>
        ))
      )}
      {!!query.hasNextPage && (
        <Button
          title="Voir plus"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
export function EventManagement() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen title="Gérer l’événement">
      <AuthGate>
        <Manage id={id} />
      </AuthGate>
    </Screen>
  );
}
async function ownedEvent(id: string, uid: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("organizer_id", uid)
    .single();
  if (error)
    throw new Error(
      "Cet événement est introuvable ou vous n’en êtes pas l’organisateur.",
    );
  return data;
}
function Manage({ id }: { id: string }) {
  const s = useUIStyles();

  const { session } = useAuth();
  const uid = session!.user.id;
  const cache = useQueryClient();
  const [action, setAction] = useState<string | null>(null);
  const event = useQuery({
    queryKey: ["event-management", id, uid],
    queryFn: () => ownedEvent(id, uid),
  });
  const participants = useInfiniteQuery({
    queryKey: ["event-participants", id, uid],
    enabled: !!event.data,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("event_participants")
        .select(
          "id,status,registered_at,notes,payment_status,participant:profiles!event_participants_participant_id_fkey(id,full_name,username,avatar_url)",
        )
        .eq("event_id", id)
        .order("registered_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (error) throw error;
      return data as any[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const mutation = useMutation({
    mutationFn: async (next: string) => {
      if (next !== "delete" && !Object.hasOwn(statuses, next))
        throw new Error("Statut invalide.");
      await ownedEvent(id, uid);
      const { data, error } = await supabase.functions.invoke(
        `events/${id}${next === "delete" ? "" : "/status"}`,
        {
          method: next === "delete" ? "DELETE" : "PUT",
          ...(next === "delete" ? {} : { body: { status: next } }),
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: (_, next) => {
      setAction(null);
      for (const key of [
        ["event-management", id],
        ["my-events"],
        ["collection", "events"],
      ])
        void cache.invalidateQueries({ queryKey: key });
      if (next === "delete") router.replace("/events-dashboard");
    },
  });
  if (event.isPending) return <Loading />;
  if (event.error) return <ErrorState error={event.error} />;
  return (
    <>
      <Text style={s.title}>{event.data.title}</Text>
      <Text style={s.small}>
        {statuses[event.data.status as keyof typeof statuses] ||
          event.data.status}
      </Text>
      <Button
        title="Voir l’événement"
        secondary
        onPress={() => router.push(`/events/${id}`)}
      />
      <Button
        title="Modifier les informations"
        onPress={() => router.push(`/events/${id}/edit`)}
      />
      <Text style={s.h2}>Statut de l’événement</Text>
      {Object.entries(statuses)
        .filter(([key]) => key !== event.data.status)
        .map(([key, label]) => (
          <Button
            key={key}
            title={`Passer à « ${label} »`}
            secondary
            disabled={mutation.isPending}
            onPress={() => {
              mutation.reset();
              setAction(key);
            }}
          />
        ))}
      <Button
        title="Supprimer l’événement"
        secondary
        disabled={mutation.isPending}
        onPress={() => {
          mutation.reset();
          setAction("delete");
        }}
      />
      {!!action && (
        <View style={s.card}>
          <Text style={s.text}>
            {action === "delete"
              ? "Supprimer définitivement cet événement et ses inscriptions ?"
              : `Confirmer le passage à « ${statuses[action as keyof typeof statuses]} » ?`}
          </Text>
          <Button
            title="Confirmer"
            busy={mutation.isPending}
            onPress={() => mutation.mutate(action)}
          />
          <Button
            title="Annuler"
            secondary
            disabled={mutation.isPending}
            onPress={() => setAction(null)}
          />
        </View>
      )}
      {!!mutation.error && <ErrorState error={mutation.error} />}
      <Text style={s.h2}>Participants</Text>
      {participants.isPending ? (
        <Loading />
      ) : participants.error ? (
        <ErrorState error={participants.error} />
      ) : !participants.data.pages.flat().length ? (
        <Empty title="Aucune inscription" />
      ) : (
        participants.data.pages.flat().map((p) => (
          <View style={s.card} key={p.id}>
            <View style={s.row}>
              <Avatar
                uri={p.participant?.avatar_url}
                name={displayName(p.participant)}
              />
              <Text style={s.text}>{displayName(p.participant)}</Text>
            </View>
            <Text style={s.small}>
              {p.status} · Paiement : {p.payment_status || "non renseigné"}
            </Text>
            {!!p.notes && <Text style={s.text}>{p.notes}</Text>}
            {!!p.participant?.id && (
              <Button
                title="Voir le profil"
                secondary
                onPress={() => router.push(`/profile/${p.participant.id}`)}
              />
            )}
          </View>
        ))
      )}
      {!!participants.hasNextPage && (
        <Button
          title="Voir plus de participants"
          busy={participants.isFetchingNextPage}
          onPress={() => void participants.fetchNextPage()}
        />
      )}
    </>
  );
}
