import React, { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import {
  activityKinds,
  loadAccountActivity,
  type ActivityKind,
} from "../lib/accountActivity";
import { notificationPath } from "../lib/notificationPath";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
export default function AccountActivity() {
  const { session } = useAuth();
  return <ActivityContent key={session?.user.id || "anonymous"} />;
}
function ActivityContent() {
  const s = useUIStyles();

  const { session } = useAuth();
  const uid = session?.user.id;
  const [kind, setKind] = useState<ActivityKind>("followers");
  const query = useInfiniteQuery({
    queryKey: ["account-activity", uid, kind],
    enabled: !!uid,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => loadAccountActivity(uid!, kind, pageParam),
    getNextPageParam: (last, _pages, lastOffset) =>
      last.length === 30 ? lastOffset + 30 : undefined,
  });
  useFocusEffect(
    useCallback(() => {
      if (uid) void query.refetch();
    }, [uid, query.refetch]),
  );
  const rows = [
    ...new Map(
      (query.data?.pages.flat() || []).map((row) => [row.id, row]),
    ).values(),
  ];
  return (
    <Screen title="Activité de mon compte" scroll={false}>
      <AuthGate>
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          contentContainerStyle={s.content}
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <Text style={s.subtitle}>
                Les interactions reçues sur votre profil, vos publications et
                vos shorts.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {activityKinds.map((item) => (
                  <Chip
                    key={item.key}
                    label={item.label}
                    selected={kind === item.key}
                    onPress={() => setKind(item.key)}
                  />
                ))}
              </ScrollView>
              {!!(query.error && rows.length) && (
                <ErrorState
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={s.card}
              accessibilityRole="button"
              accessibilityLabel={item.content}
              onPress={() => {
                const path = notificationPath(item.link);
                if (path) router.push(path);
              }}
            >
              <View style={s.row}>
                <Avatar uri={item.avatar} name={item.name} size={44} />
                <Text style={[s.text, { flex: 1 }]}>{item.content}</Text>
              </View>
              <Text style={s.small}>
                {new Date(item.created_at).toLocaleString("fr-FR")}
              </Text>
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
                title="Aucune activité à afficher"
                description="Les nouvelles interactions de cette catégorie apparaîtront ici."
              />
            )
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <Button
                secondary
                title="Activité précédente"
                busy={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
              />
            ) : null
          }
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
        />
      </AuthGate>
    </Screen>
  );
}
