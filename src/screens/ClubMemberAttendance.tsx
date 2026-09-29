import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  useUIStyles,
} from "../components/ui";
import { supabase } from "../lib/supabase";
export default function ClubMemberAttendance({
  id,
  uid,
}: {
  id: string;
  uid: string;
}) {
  const s = useUIStyles();

  const query = useInfiniteQuery({
    queryKey: ["club-member-attendance", id, uid],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw auth.error;
      if (auth.data.user?.id !== uid)
        throw new Error("La session a changé. Rechargez cet écran.");
      const result = await supabase.rpc("get_native_member_attendance", {
        p_club_id: id,
        p_offset: pageParam,
        p_limit: 30,
      });
      if (result.error) throw result.error;
      return result.data as {
        id: string;
        category: string | null;
        session_type: string | null;
        session_date: string | null;
      }[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );
  return (
    <>
      <Text style={s.h2}>Présences · séances du club</Text>
      <Text style={s.small}>
        Retrouvez les séances de vos équipes et les événements du club qui vous
        concernent.
      </Text>
      <Button
        title="Actualiser"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data?.pages.flat().length && (
            <Empty title="Aucune séance enregistrée" />
          )}
          {query.data?.pages.flat().map((row) => (
            <View key={row.id} style={s.card}>
              <Text style={s.h2}>
                {(
                  {
                    training: "Entraînement",
                    match: "Match",
                    other: "Autre séance",
                  } as Record<string, string>
                )[row.session_type || ""] ||
                  row.session_type ||
                  "Séance"}
              </Text>
              <Text style={s.text}>
                {row.session_date
                  ? new Date(row.session_date).toLocaleString("fr-FR")
                  : "Date à préciser"}
              </Text>
              <Text style={s.small}>
                {row.category || "Catégorie non précisée"}
              </Text>
            </View>
          ))}
          {!!query.hasNextPage && (
            <Button
              title="Afficher davantage"
              busy={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          )}
        </>
      )}
    </>
  );
}
