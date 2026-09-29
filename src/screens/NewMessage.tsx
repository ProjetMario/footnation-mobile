import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Search } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import { Avatar, Empty, ErrorState, Loading, Screen, SearchField, useUIStyles } from "../components/ui";
import { useAuth } from "../lib/auth";
import { displayName, type Profile } from "../lib/models";
import { supabase } from "../lib/supabase";
import { useTheme } from "../theme";

type ConnectionRow = {
  user_id: string;
  connected_user_id: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function loadMessageContacts(uid: string) {
  const connections = await supabase
    .from("connections")
    .select("user_id,connected_user_id")
    .eq("status", "accepted")
    .or(`user_id.eq.${uid},connected_user_id.eq.${uid}`)
    .returns<ConnectionRow[]>();
  if (connections.error) throw connections.error;
  const ids = [
    ...new Set(
      (connections.data || []).map((row) =>
        row.user_id === uid ? row.connected_user_id : row.user_id,
      ),
    ),
  ];
  if (!ids.length) return [] as Profile[];
  const profiles = await supabase
    .from("profiles")
    .select(
      "id,full_name,first_name,last_name,username,avatar_url,city,department,primary_role,position,is_suspended,suspended_until",
    )
    .in("id", ids)
    .order("full_name")
    .returns<Profile[]>();
  if (profiles.error) throw profiles.error;
  return (profiles.data || []).filter((profile) => {
    if (!profile.is_suspended) return true;
    if (!profile.suspended_until) return false;
    return Date.parse(profile.suspended_until) <= Date.now();
  });
}

export default function NewMessage() {
  const s = useUIStyles();
  const { colors } = useTheme();
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["new-message-contacts", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: () => loadMessageContacts(session!.user.id),
  });
  const filtered = useMemo(() => {
    const term = normalize(search);
    const rows = query.data || [];
    if (!term) return rows;
    return rows.filter((profile) =>
      normalize(
        [
          displayName(profile),
          profile.username,
          profile.city,
          profile.department,
          profile.primary_role,
          profile.position,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(term),
    );
  }, [query.data, search]);
  return (
    <Screen title="Nouveau message" scroll={false}>
      <AuthGate>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <Text style={s.text}>
                Choisis une personne de ton réseau pour démarrer ou reprendre la discussion.
              </Text>
              <SearchField
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher un contact"
              />
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Écrire à ${displayName(item)}`}
              onPress={() => router.push(`/conversation/${item.id}`)}
              style={({ pressed }) => [
                s.card,
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Avatar uri={item.avatar_url} name={displayName(item)} size={54} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.h2} numberOfLines={1}>
                  {displayName(item)}
                </Text>
                <Text style={s.small} numberOfLines={1}>
                  {[item.position || item.primary_role, item.city, item.department]
                    .filter(Boolean)
                    .join(" · ") || "Membre FootNation"}
                </Text>
              </View>
              <Search size={18} color={colors.blue} />
            </Pressable>
          )}
          ListEmptyComponent={
            query.isPending ? (
              <Loading />
            ) : query.isError ? (
              <ErrorState error={query.error} retry={() => void query.refetch()} />
            ) : (
              <Empty
                title={search.trim() ? "Aucun contact trouvé" : "Aucun contact dans ton réseau"}
                description={
                  search.trim()
                    ? "Essaie un autre nom."
                    : "Ajoute un membre à ton réseau pour pouvoir lui écrire."
                }
              />
            )
          }
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
        />
      </AuthGate>
    </Screen>
  );
}
