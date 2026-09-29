import React, { useState } from "react";
import { useDebounced, searchPattern } from "../lib/data";
import { FlatList, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { supabase, requireBackend } from "../lib/supabase";
import {
  Banner,
  Chip,
  SearchField,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { AuthGate } from "../components/AuthGate";
import { GroupActions, EventActions } from "../components/CommunityActions";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui";
import { NativeVideo } from "../components/Video";

type Collection = "groups" | "events" | "shorts";
type Item = {
  id: string;
  privacy?: string;
  created_by?: string;
  organizer_id?: string;
  status?: string;
  price?: number;
  currency?: string;
  current_participants?: number;
  max_participants?: number;
  registration_deadline?: string;
  name?: string;
  title?: string;
  description?: string;
  cover_image?: string;
  start_date?: string;
  location_city?: string;
  member_count?: number;
  member_totals?: { count: number }[];
  video_url?: string;
  thumbnail_url?: string;
};
const titles = { groups: "Groupes", events: "Événements", shorts: "Shorts" };
function useCollection(kind: Collection, groupScope = "public", search = "") {
  const term = useDebounced(search);
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: ["collection", kind, session?.user.id, groupScope, term],
    enabled: !!session,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      requireBackend();
      let q = supabase
        .from(kind)
        .select(
          kind === "groups" && groupScope === "joined"
            ? "*,group_memberships!inner(user_id),member_totals:group_memberships(count)"
            : kind === "groups"
              ? "*,member_totals:group_memberships(count)"
              : "*",
        )
        .order(kind === "events" ? "start_date" : "created_at", {
          ascending: kind === "events",
        })
        .order("id")
        .range(pageParam * 20, pageParam * 20 + 19);
      if (kind === "groups") {
        if (groupScope === "public") q = q.eq("privacy", "public");
        if (groupScope === "joined")
          q = q.eq("group_memberships.user_id", session!.user.id);
        if (groupScope === "created") q = q.eq("created_by", session!.user.id);
        if (term) q = q.ilike("name", searchPattern(term));
      }
      if (kind === "events")
        q = q.eq("status", "published").eq("visibility", "public");
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as Item[]).map((item) => ({
        ...item,
        member_count: item.member_totals?.[0]?.count ?? item.member_count,
      }));
    },
    getNextPageParam: (last, _pages, p) =>
      last.length === 20 ? p + 1 : undefined,
  });
}
function CollectionScreen({ kind }: { kind: Collection }) {
  const s = useUIStyles();

  const [scope, setScope] = useState("public");
  const [search, setSearch] = useState("");
  const query = useCollection(kind, scope, search);
  return (
    <Screen title={titles[kind]} scroll={false}>
      <AuthGate>
        <FlatList
          contentContainerStyle={s.content}
          data={query.data?.pages.flat() || []}
          keyExtractor={(x) => x.id}
          ListHeaderComponent={
            <View style={{ gap: 14 }}>
              {kind === "groups" && (
                <>
                  <View style={[s.row, { flexWrap: "wrap" }]}>
                    {[
                      ["public", "Découvrir"],
                      ["joined", "Mes groupes"],
                      ["created", "Créés par moi"],
                    ].map(([value, label]) => (
                      <Chip
                        key={value}
                        label={label}
                        selected={scope === value}
                        onPress={() => setScope(value)}
                      />
                    ))}
                  </View>
                  <SearchField
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Rechercher un groupe"
                  />
                </>
              )}
              {kind !== "shorts" ? (
                <Button
                  title={
                    kind === "groups" ? "Créer un groupe" : "Créer un événement"
                  }
                  onPress={() => router.push(`/${kind}/new`)}
                />
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              style={s.card}
              onPress={() => router.push(`/${kind}/${item.id}`)}
            >
              {!!(item.cover_image || item.thumbnail_url) && (
                <Image
                  source={{ uri: item.cover_image || item.thumbnail_url }}
                  style={{ width: "100%", aspectRatio: 1.7, borderRadius: 14 }}
                  contentFit="cover"
                />
              )}
              <Text style={s.h2}>
                {item.name ||
                  item.title ||
                  item.description ||
                  "Short FootNation"}
              </Text>
              {!!(kind !== "shorts" && item.description) && (
                <Text style={s.subtitle} numberOfLines={3}>
                  {item.description}
                </Text>
              )}
              {!!item.start_date && (
                <Text style={s.small}>
                  {new Date(item.start_date).toLocaleString("fr-FR")}
                </Text>
              )}
              {!!item.location_city && (
                <Text style={s.small}>{item.location_city}</Text>
              )}
              {item.member_count != null && (
                <Text style={s.small}>{item.member_count} membres</Text>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            query.isPending ? (
              <Loading />
            ) : query.isError ? (
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            ) : (
              <Empty
                title={
                  kind !== "groups"
                    ? "Aucun contenu à afficher"
                    : search.trim()
                      ? "Aucun groupe ne correspond à votre recherche"
                      : scope === "joined"
                        ? "Vous n’avez rejoint aucun groupe"
                        : scope === "created"
                          ? "Vous n’avez pas encore créé de groupe"
                          : "Aucun groupe public pour le moment"
                }
              />
            )
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <Button
                secondary
                title="Afficher la suite"
                busy={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
              />
            ) : null
          }
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage)
              void query.fetchNextPage();
          }}
        />
      </AuthGate>
    </Screen>
  );
}
export function Groups() {
  return <CollectionScreen kind="groups" />;
}
export function Events() {
  return <CollectionScreen kind="events" />;
}
export function Shorts() {
  return <CollectionScreen kind="shorts" />;
}
function CollectionDetail({ kind }: { kind: Collection }) {
  const s = useUIStyles();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const query = useQuery({
    enabled: !!session,
    queryKey: ["collection", kind, id],
    queryFn: async () => {
      requireBackend();
      const { data, error } = await supabase
        .from(kind)
        .select(
          kind === "groups" ? "*,member_totals:group_memberships(count)" : "*",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      const item = data as unknown as Item;
      return {
        ...item,
        member_count: item.member_totals?.[0]?.count ?? item.member_count,
      };
    },
  });
  return (
    <Screen title={titles[kind]}>
      <AuthGate>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorState error={query.error} />
        ) : (
          <>
            {query.data.video_url ? (
              <NativeVideo uri={query.data.video_url} />
            ) : (
              <Banner
                eyebrow={titles[kind].toUpperCase()}
                title={query.data.name || query.data.title || "FootNation"}
              />
            )}
            <Text style={s.text} selectable>
              {query.data.description}
            </Text>
            {!!query.data.start_date && (
              <Text style={s.subtitle}>
                {new Date(query.data.start_date).toLocaleString("fr-FR")}
              </Text>
            )}
            {!!query.data.location_city && (
              <Text style={s.subtitle}>{query.data.location_city}</Text>
            )}
            {query.data.member_count != null && (
              <Text style={s.small}>{query.data.member_count} membres</Text>
            )}
            {kind === "groups" && (
              <GroupActions
                id={id}
                privacy={query.data.privacy}
                createdBy={query.data.created_by}
              />
            )}
            {kind === "events" && <EventActions event={query.data} />}
          </>
        )}
      </AuthGate>
    </Screen>
  );
}
export function GroupDetail() {
  return <CollectionDetail kind="groups" />;
}
export function EventDetail() {
  return <CollectionDetail kind="events" />;
}
export function ShortDetail() {
  return <CollectionDetail kind="shorts" />;
}
