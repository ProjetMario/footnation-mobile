import React from "react";
import { membershipOperation } from "../lib/groupMembership";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { Profile, displayName } from "../lib/models";
import { Avatar, Button, Empty, ErrorState, Loading, useUIStyles } from "./ui";
import { useTheme } from "../theme";

export function GroupActions({
  id,
  privacy,
  createdBy,
}: {
  id: string;
  privacy?: string;
  createdBy?: string;
}) {
  const s = useUIStyles();

  const { session } = useAuth();
  const uid = session?.user.id;
  const cache = useQueryClient();
  const mine = useQuery({
    queryKey: ["group-membership", id, uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_memberships")
        .select("id,role")
        .eq("group_id", id)
        .eq("user_id", uid!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const members = useInfiniteQuery({
    queryKey: ["group-members", id, uid],
    enabled: !!uid,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("group_memberships")
        .select(
          "id,user_id,role,profile:profiles!group_memberships_user_id_fkey(id,full_name,username,avatar_url)",
        )
        .eq("group_id", id)
        .order("joined_at", { ascending: false })
        .order("id")
        .range(pageParam * 30, pageParam * 30 + 29);
      if (error) throw error;
      return data as unknown as {
        id: string;
        user_id: string;
        role: string;
        profile: Profile;
      }[];
    },
    getNextPageParam: (last, _pages, p) =>
      last.length === 30 ? p + 1 : undefined,
  });
  const change = useMutation({
    mutationFn: async (desired: "join" | "leave") => {
      const {
        data: { session: fresh },
        error: authError,
      } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!uid || fresh?.user.id !== uid)
        throw new Error("Reconnectez-vous avant de modifier votre adhésion.");
      const membership = await supabase
        .from("group_memberships")
        .select("id,role")
        .eq("group_id", id)
        .eq("user_id", uid)
        .maybeSingle();
      if (membership.error) throw membership.error;
      const group = await supabase
        .from("groups")
        .select("privacy,created_by")
        .eq("id", id)
        .single();
      if (group.error) throw group.error;
      const operation = membershipOperation(
        desired,
        membership.data?.role || null,
        group.data.created_by === uid,
        group.data.privacy,
      );
      if (operation === "none") return null;
      const leaving = operation === "leave";
      const r = leaving
        ? await supabase
            .from("group_memberships")
            .delete()
            .eq("id", membership.data!.id)
            .eq("user_id", uid)
            .eq("role", membership.data!.role)
            .select("id")
            .maybeSingle()
        : await supabase
            .from("group_memberships")
            .insert({ group_id: id, user_id: uid, role: "member" })
            .select("id")
            .single();
      if (r.error) throw r.error;
      if (!r.data) return null;
      // Membership is authoritative; a count refresh must never retry the mutation.
      const count = await supabase.rpc(
        leaving
          ? "decrement_group_member_count"
          : "increment_group_member_count",
        { group_id: id },
      );
      return count.error
        ? "Votre adhésion est enregistrée. Le compteur sera actualisé ultérieurement."
        : null;
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["group-membership", id] });
      void cache.invalidateQueries({ queryKey: ["group-members", id] });
      void cache.invalidateQueries({ queryKey: ["collection", "groups"] });
    },
  });
  return (
    <View style={{ gap: 16 }}>
      {mine.isPending ? (
        <Loading />
      ) : mine.isError ? (
        <ErrorState error={mine.error} />
      ) : mine.data?.role === "admin" || createdBy === uid ? (
        <Button
          title="Modifier le groupe"
          secondary
          onPress={() => router.push(`/groups/${id}/edit`)}
        />
      ) : (
        <Button
          title={mine.data ? "Quitter le groupe" : "Rejoindre le groupe"}
          secondary={!!mine.data}
          disabled={!mine.data && privacy === "private"}
          busy={change.isPending}
          onPress={() => change.mutate(mine.data ? "leave" : "join")}
        />
      )}
      {!!change.isError && <ErrorState error={change.error} />}
      {!!change.data && <Text style={s.small}>{change.data}</Text>}
      <Text style={s.h2}>Membres</Text>
      {members.isPending ? (
        <Loading />
      ) : members.isError ? (
        <ErrorState error={members.error} />
      ) : !members.data.pages.flat().length ? (
        <Empty title="Aucun membre pour le moment" />
      ) : (
        members.data.pages.flat().map((member) => (
          <Pressable
            key={member.id}
            style={[s.card, s.row]}
            accessibilityRole="button"
            onPress={() => router.push(`/profile/${member.user_id}`)}
          >
            <Avatar
              uri={member.profile?.avatar_url}
              name={displayName(member.profile)}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.text}>{displayName(member.profile)}</Text>
              <Text style={s.small}>
                {member.role === "admin"
                  ? "Administrateur"
                  : member.role === "moderator"
                    ? "Modérateur"
                    : "Membre"}
              </Text>
            </View>
          </Pressable>
        ))
      )}
      {!!members.hasNextPage && (
        <Button
          title="Voir plus de membres"
          secondary
          busy={members.isFetchingNextPage}
          onPress={() => void members.fetchNextPage()}
        />
      )}
    </View>
  );
}
export function EventActions({
  event,
}: {
  event: {
    id: string;
    organizer_id?: string;
    status?: string;
    price?: number;
    currency?: string;
    current_participants?: number;
    max_participants?: number;
    registration_deadline?: string;
    start_date?: string;
  };
}) {
  const { colors } = useTheme();
  const s = useUIStyles();

  const { session } = useAuth();
  const uid = session?.user.id;
  const cache = useQueryClient();
  const mine = useQuery({
    queryKey: ["event-registration", event.id, uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_participants")
        .select("id,status,payment_status")
        .eq("event_id", event.id)
        .eq("participant_id", uid!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const registered = !!mine.data && mine.data.status !== "cancelled";
  const publish = useMutation({
    mutationFn: async () => {
      if (event.organizer_id !== uid)
        throw new Error("Action réservée à l’organisateur.");
      const { data, error } = await supabase.functions.invoke(
        `events/${event.id}/status`,
        { method: "PUT", body: { status: "published" } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["collection", "events"] }),
  });
  const change = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("Connexion requise");
      const { data, error } = await supabase.functions.invoke(
        `events/${event.id}/${registered ? "unregister" : "register"}`,
        {
          method: registered ? "DELETE" : "POST",
          ...(!registered ? { body: { notes: "" } } : {}),
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      void cache.invalidateQueries({
        queryKey: ["event-registration", event.id],
      });
      void cache.invalidateQueries({ queryKey: ["collection", "events"] });
    },
  });
  const closed =
    event.status !== "published" ||
    !!(
      event.max_participants &&
      (event.current_participants || 0) >= event.max_participants
    ) ||
    !!(
      event.registration_deadline &&
      Date.parse(event.registration_deadline) < Date.now()
    ) ||
    !!(event.start_date && Date.parse(event.start_date) < Date.now());
  return (
    <View style={s.card}>
      <Text style={s.h2}>Participation</Text>
      {!!(event.organizer_id === uid && event.status === "draft") && (
        <>
          <Text style={s.small}>Cet événement est en brouillon.</Text>
          <Button
            title="Publier l’événement"
            busy={publish.isPending}
            onPress={() => publish.mutate()}
          />
          {!!publish.isError && <ErrorState error={publish.error} />}
        </>
      )}
      <Text style={s.text}>
        {event.price ? `${event.price} ${event.currency || "EUR"}` : "Gratuit"}{" "}
        · {event.current_participants || 0}
        {event.max_participants ? ` / ${event.max_participants}` : ""}{" "}
        participants
      </Text>
      {mine.isPending ? (
        <Loading />
      ) : mine.isError ? (
        <ErrorState error={mine.error} />
      ) : event.organizer_id === uid ? (
        <Button
          title="Gérer l’événement"
          secondary
          onPress={() => router.push(`/events/${event.id}/manage`)}
        />
      ) : (
        <Button
          title={
            registered
              ? "Annuler mon inscription"
              : closed
                ? "Inscriptions fermées"
                : "M’inscrire"
          }
          secondary={registered}
          disabled={!registered && closed}
          busy={change.isPending}
          onPress={() => change.mutate()}
        />
      )}
      {!!registered && (
        <Text style={{ color: colors.success }}>
          Vous êtes inscrit
          {mine.data?.payment_status === "pending" && event.price
            ? " — paiement en attente"
            : ""}
          .
        </Text>
      )}
      {!!change.isError && <ErrorState error={change.error} />}
    </View>
  );
}
