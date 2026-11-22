import React, { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View, StyleSheet } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useTheme } from "../theme";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
type ProfileSummary = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  primary_role: string | null;
  club: string | null;
};
type FollowRow = {
  id: string;
  created_at: string;
  profile: ProfileSummary | null;
};
export default function Followers() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{
    profileId?: string;
    direction?: string;
  }>();
  const profileId = params.profileId || session?.user.id;
  return (
    <FollowerContent
      key={`${session?.user.id}:${profileId}:${params.direction}`}
      profileId={profileId}
      initialDirection={
        params.direction === "following" ? "following" : "followers"
      }
    />
  );
}
function FollowerContent({
  profileId,
  initialDirection,
}: {
  profileId?: string;
  initialDirection: "followers" | "following";
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const [activeControl, setActiveControl] = useState<string | null>(null);

  const { session } = useAuth();
  const uid = session?.user.id;
  const [direction, setDirection] = useState<"followers" | "following">(
    initialDirection,
  );
  const query = useInfiniteQuery({
    queryKey: ["profile-follows", uid, profileId, direction],
    enabled: !!uid && !!profileId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const foreignKey =
        direction === "followers"
          ? "profile_followers_follower_id_fkey"
          : "profile_followers_followed_id_fkey";
      const result = await supabase
        .from("profile_followers")
        .select(
          `id,created_at,profile:profiles!${foreignKey}(id,full_name,username,avatar_url,primary_role,club)`,
          { count: "exact" },
        )
        .eq(
          direction === "followers" ? "followed_id" : "follower_id",
          profileId!,
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (result.error) throw result.error;
      return {
        rows: result.data as unknown as FollowRow[],
        total: result.count,
      };
    },
    getNextPageParam: (last, _pages, offset) =>
      last.rows.length === 30 ? offset + 30 : undefined,
  });
  useFocusEffect(
    useCallback(() => {
      if (uid) void query.refetch();
    }, [uid, query.refetch]),
  );
  const rows = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.rows) || []).map((row) => [
        row.id,
        row,
      ]),
    ).values(),
  ];
  const total = query.data?.pages[0]?.total;
  return (
    <Screen title="Réseau" scroll={false}>
      <AuthGate>
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          contentContainerStyle={[s.content, { gap: 0 }]}
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 14 }}>
              <View
                style={[
                  styles.tabs,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {(
                  [
                    ["followers", "FootLovers"],
                    ["following", "Abonnements"],
                  ] as const
                ).map(([value, label]) => (
                  <Pressable
                    key={value}
                    accessibilityRole="tab"
                      aria-selected={direction === value}
                    accessibilityLabel={label}
                    accessibilityState={{ selected: direction === value }}
                    onPress={() => setDirection(value)}
                    onFocus={() => setActiveControl(value)}
                    onBlur={() => setActiveControl(null)}
                    style={({ pressed }) => [
                      styles.tab,
                      {
                        backgroundColor:
                          direction === value
                            ? colors.accentSoft
                            : "transparent",
                        borderColor:
                          activeControl === value ? colors.blue : "transparent",
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          direction === value ? colors.deepBlue : colors.muted,
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      {label}
                    </Text>
                    {direction === value && typeof total === "number" && (
                      <Text
                        style={{
                          color: colors.deepBlue,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {total}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
              {!!(query.error && rows.length) && (
                <ErrorState
                  error={query.error}
                  retry={() => void query.refetch()}
                />
              )}
            </View>
          }
          renderItem={({ item }) => {
            const profile = item.profile;
            const name =
              profile?.full_name || profile?.username || "Compte indisponible";
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.person,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor:
                      activeControl === item.id
                        ? colors.accentSoft
                        : "transparent",
                    opacity: !profile ? 0.55 : pressed ? 0.7 : 1,
                  },
                ]}
                onHoverIn={() => setActiveControl(item.id)}
                onHoverOut={() => setActiveControl(null)}
                onFocus={() => setActiveControl(item.id)}
                onBlur={() => setActiveControl(null)}
                accessibilityRole="button"
                accessibilityLabel={
                  profile ? `Voir le profil de ${name}` : name
                }
                accessibilityState={{ disabled: !profile }}
                disabled={!profile}
                onPress={() => {
                  if (profile) router.push(`/profile/${profile.id}`);
                }}
              >
                <View style={s.row}>
                  <Avatar uri={profile?.avatar_url} name={name} size={44} />
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.ink,
                        fontSize: 15,
                        fontWeight: "700",
                      }}
                    >
                      {name}
                    </Text>
                    {!!profile && (
                      <Text
                        numberOfLines={1}
                        style={{
                          color: colors.muted,
                          fontSize: 12,
                          lineHeight: 18,
                        }}
                      >
                        {[profile.primary_role, profile.club]
                          .filter(Boolean)
                          .join(" · ") || "Membre FootNation"}
                      </Text>
                    )}
                    {!profile && (
                      <Text style={s.small}>
                        Ce profil n’est plus accessible.
                      </Text>
                    )}
                  </View>
                  {!!profile && <ChevronRight size={17} color={colors.muted} />}
                </View>
              </Pressable>
            );
          }}
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
                  direction === "followers"
                    ? "Aucun FootLover pour le moment"
                    : "Vous ne suivez encore personne"
                }
              />
            )
          }
          ListFooterComponent={
            query.hasNextPage ? (
              <Button
                secondary
                title="Afficher davantage"
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

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 7,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  person: {
    minHeight: 76,
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
});
