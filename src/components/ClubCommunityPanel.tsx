import { ChevronRight } from "lucide-react-native";
import { useTheme } from "../theme";
import {
  ClubButton as Button,
  useClubUIStyles as useUIStyles,
} from "./ClubDesign";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Avatar, Empty, ErrorState, Loading, MenuRow } from "./ui";
import { ClubExperienceMembers } from "./ClubExperienceMembers";
type Member = {
  id: string;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  avatar_url: string | null;
};
export function ClubCommunityPanel({
  id,
  name,
  mode,
  hideHeading = false,
  onOpenProfile,
}: {
  id: string;
  name: string;
  mode: string;
  hideHeading?: boolean;
  onOpenProfile?: () => void;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const query = useInfiniteQuery({
    enabled: mode !== "members",
    queryKey: ["club-community", id, name, mode],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (mode === "top") {
        const { data, error } = await supabase
          .from("club_player_rankings")
          .select("id,goals_total,assists_total,player:club_players(name)")
          .eq("club_id", id)
          .eq("ranking_type", "current")
          .order("goals_total", { ascending: false })
          .order("id")
          .range(pageParam, pageParam + 29);
        if (error) throw error;
        const rows = (
          data as unknown as {
            id: string;
            goals_total: number | null;
            assists_total: number | null;
            player: { name: string } | null;
          }[]
        ).map((row) => ({
          id: row.id,
          title: row.player?.name || "Joueur",
          subtitle: `${row.goals_total ?? 0} ${(row.goals_total ?? 0) > 1 ? "buts" : "but"} · ${row.assists_total ?? 0} ${(row.assists_total ?? 0) > 1 ? "passes décisives" : "passe décisive"}`,
          avatar: null as string | null,
          profile: false,
        }));
        return { rows, fetchedCount: data?.length || 0 };
      }
      let members: Member[];
      let fetchedCount: number;
      if (mode === "followers") {
        const { data, error } = await supabase
          .from("club_followers")
          .select(
            "id,profile:profiles!club_followers_profile_id_fkey(id,full_name,first_name,last_name,username,avatar_url)",
          )
          .eq("club_id", id)
          .order("id")
          .range(pageParam, pageParam + 29)
          .returns<{ id: string; profile: Member | null }[]>();
        if (error) throw error;
        fetchedCount = data?.length || 0;
        members = (data || []).flatMap((row) =>
          row.profile ? [row.profile] : [],
        );
      } else {
        let request = supabase
          .from("profiles")
          .select("id,full_name,first_name,last_name,username,avatar_url");
        request =
          mode === "fans"
            ? request.or(
                `favorite_pro_club.eq.${JSON.stringify(name)},favorite_amateur_club.eq.${JSON.stringify(name)}`,
              )
            : request.or(
                `linked_club_id.eq.${id},club.eq.${JSON.stringify(name)}`,
              );
        const { data, error } = await request
          .order("id")
          .range(pageParam, pageParam + 29);
        if (error) throw error;
        members = data || [];
        fetchedCount = members.length;
      }
      const rows = members.map((row) => ({
        id: row.id,
        title:
          row.full_name ||
          [row.first_name, row.last_name].filter(Boolean).join(" ") ||
          row.username ||
          "Membre FootNation",
        subtitle: "",
        avatar: row.avatar_url,
        profile: true,
      }));
      return { rows, fetchedCount };
    },
    getNextPageParam: (last, pages) =>
      last.fetchedCount === 30 ? pages.length * 30 : undefined,
  });
  if (mode === "members")
    return (
      <ClubExperienceMembers
        id={id}
        name={name}
        hideHeading={hideHeading}
        onOpenProfile={onOpenProfile}
      />
    );
  return (
    <View style={{ gap: 12 }}>
      {!hideHeading && (
        <Text style={s.h2}>
          {mode === "top"
            ? "Top joueurs"
            : mode === "fans"
              ? "Fans"
              : mode === "followers"
                ? "FootLovers"
                : "Membres"}
        </Text>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data?.pages.flatMap((page) => page.rows).length && (
            <Empty title="Aucune donnée pour le moment" />
          )}
          {query.data?.pages
            .flatMap((page) => page.rows)
            .map((row, index) => {
              const content = (
                <>
                  {row.profile ? (
                    <Avatar uri={row.avatar} name={row.title} size={42} />
                  ) : (
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        backgroundColor: colors.accentSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={[s.h2, { color: colors.blue }]}>
                        {index + 1}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[s.text, { fontFamily: "Inter-SemiBold" }]}>
                      {row.title}
                    </Text>
                    {!!row.subtitle && (
                      <Text style={s.small}>{row.subtitle}</Text>
                    )}
                  </View>
                  {row.profile && (
                    <ChevronRight size={18} color={colors.muted} />
                  )}
                </>
              );
              const style = {
                flexDirection: "row" as const,
                alignItems: "center" as const,
                minHeight: 68,
                paddingVertical: 12,
                gap: 12,
                borderBottomWidth: 1,
                borderColor: colors.border,
              };
              return row.profile ? (
                <Pressable
                  key={row.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Voir le profil de ${row.title}`}
                  onPress={() => {
                    onOpenProfile?.();
                    router.push(`/profile/${row.id}`);
                  }}
                  style={({ pressed }) => [
                    style,
                    { opacity: pressed ? 0.65 : 1 },
                  ]}
                >
                  {content}
                </Pressable>
              ) : (
                <View key={row.id} style={style}>
                  {content}
                </View>
              );
            })}
          {query.hasNextPage && (
            <Button
              title="Voir plus"
              busy={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          )}
        </>
      )}
    </View>
  );
}
