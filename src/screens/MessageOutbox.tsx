import React, { useCallback } from "react";
import { FlatList, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { messageOutbox } from "../lib/messageOutboxStorage";
import { type MessageProposal } from "../lib/messageOutbox";
import { supabase } from "../lib/supabase";
import { displayName } from "../lib/models";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
export default function MessageOutbox() {
  const s = useUIStyles();

  const uid = useAuth().session?.user.id;
  const query = useQuery({
    queryKey: ["message-outbox", uid],
    enabled: !!uid,
    queryFn: () => messageOutbox.list(uid!),
  });
  useFocusEffect(
    useCallback(() => {
      if (uid) void query.refetch();
    }, [uid, query.refetch]),
  );
  return (
    <Screen title="Envois en attente" scroll={false}>
      <AuthGate>
        <FlatList
          contentContainerStyle={s.content}
          data={query.data || []}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <Text style={s.subtitle}>
                Ces tentatives sont conservées sur cet appareil. Ouvrez la
                conversation pour vérifier l’envoi ou l’abandonner. Aucun
                message n’est envoyé automatiquement.
              </Text>
              {query.error && query.data ? (
                <ErrorState
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <PendingMessage key={item.id} row={item} uid={uid!} />
          )}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          ListEmptyComponent={
            query.isPending ? (
              <Loading />
            ) : query.isError ? (
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            ) : (
              <Empty title="Aucun envoi en attente sur cet appareil" />
            )
          }
        />
      </AuthGate>
    </Screen>
  );
}
function PendingMessage({ row, uid }: { row: MessageProposal; uid: string }) {
  const s = useUIStyles();

  const profile = useQuery({
    queryKey: ["outbox-recipient", uid, row.receiver_id],
    queryFn: async () => {
      const result = await supabase
        .from("profiles")
        .select("full_name,username")
        .eq("id", row.receiver_id)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  return (
    <View style={s.card}>
      <Text style={s.h2}>
        {profile.data ? displayName(profile.data) : "Destinataire"}
      </Text>
      <Text style={s.text} numberOfLines={5}>
        {row.content}
      </Text>
      <Button
        title="Reprendre dans la conversation"
        onPress={() => router.push(`/conversation/${row.receiver_id}`)}
      />
    </View>
  );
}
