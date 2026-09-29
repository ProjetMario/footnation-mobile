import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react-native";
import { useAuth } from "../lib/auth";
import {
  loadClubExperienceMembers,
  mergeClubMembers,
} from "../lib/clubExperienceMembers";
import { publicProfileName } from "../lib/publicTalent";
import { Avatar, ErrorState, Loading } from "./ui";
import { ClubButton as Button, useClubUIStyles } from "./ClubDesign";
import { useTheme } from "../theme";
export function ClubExperienceMembers({
  id,
  name,
  hideHeading,
  onOpenProfile,
}: {
  id: string;
  name: string;
  hideHeading?: boolean;
  onOpenProfile?: () => void;
}) {
  const { session } = useAuth();
  const uid = session?.user.id || "";
  const s = useClubUIStyles();
  const { colors } = useTheme();
  const query = useInfiniteQuery({
    queryKey: ["club-experience-members", id, name, uid],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      loadClubExperienceMembers(id, name, uid, pageParam),
    getNextPageParam: (last, pages) =>
      last.more ? pages.length * 30 : undefined,
  });
  const members = mergeClubMembers(
    id,
    name,
    query.data?.pages.flatMap((page) => page.profiles) || [],
    query.data?.pages.flatMap((page) => page.projected) || [],
  );
  return (
    <View style={{ gap: 14 }}>
      {!hideHeading && <Text style={s.h2}>Membres</Text>}
      <Text style={s.small}>
        D’après les clubs et expériences renseignés par les membres.
      </Text>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!members.length && (
            <Text style={s.small}>
              Aucun parcours lié à ce club pour le moment.
            </Text>
          )}
          {[true, false].map((current) => {
            const group = members.filter(
              (member) => member.current === current,
            );
            return group.length ? (
              <View key={String(current)} style={{ gap: 10 }}>
                <Text style={[s.h2, { fontSize: 16 }]}>
                  {current ? "Membres actuels" : "Anciens membres"} ·{" "}
                  {group.length}
                </Text>
                {group.map((member) => (
                  <Pressable
                    key={member.profile.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Voir le profil de ${publicProfileName(member.profile)}`}
                    onPress={() => {
                      onOpenProfile?.();
                      router.push(`/profile/${member.profile.id}`);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Avatar
                      uri={member.profile.avatar_url}
                      name={publicProfileName(member.profile)}
                      size={44}
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[s.text, { fontFamily: "Inter-SemiBold" }]}>
                        {publicProfileName(member.profile)}
                      </Text>
                      {member.experiences.length ? (
                        member.experiences.map((experience, i) => (
                          <Text key={i} style={s.small}>
                            {[
                              experience.category,
                              experience.position,
                              [
                                experience.start,
                                experience.current
                                  ? "Aujourd’hui"
                                  : experience.end,
                              ]
                                .filter(Boolean)
                                .join(" – "),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        ))
                      ) : (
                        <Text style={s.small}>Club du profil</Text>
                      )}
                    </View>
                    <ChevronRight size={18} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            ) : null;
          })}
          {query.hasNextPage && (
            <Button
              title="Voir plus de membres"
              busy={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          )}
        </>
      )}
    </View>
  );
}
