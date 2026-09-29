import React from "react";
import { Text, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { reportReasons, reportStatuses } from "../lib/reportReview";

export default function MyReports() {
  const { session } = useAuth();
  return (
    <Screen title="Mes signalements">
      <AuthGate>
        <Reports key={session?.user.id} userId={session?.user.id} />
      </AuthGate>
    </Screen>
  );
}
function Reports({ userId }: { userId?: string }) {
  const s = useUIStyles();
  const query = useInfiniteQuery({
    queryKey: ["my-content-reports", userId],
    enabled: !!userId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const current = await supabase.auth.getSession();
      if (!userId || current.error || current.data.session?.user.id !== userId)
        throw new Error("Reconnectez-vous pour consulter vos signalements.");
      const result = await supabase
        .from("user_reports")
        .select("id,reason,status,created_at")
        .eq("reporter_id", userId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29)
        .setHeader(
          "Authorization",
          `Bearer ${current.data.session.access_token}`,
        );
      if (result.error)
        throw new Error("Vos signalements sont indisponibles. Réessayez.");
      return result.data;
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  return (
    <>
      <Text style={s.subtitle}>
        Retrouvez l’état des signalements envoyés à l’équipe FootNation.
      </Text>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data?.pages.flat().length ? (
        <Empty title="Aucun signalement envoyé" />
      ) : (
        query.data.pages.flat().map((report) => (
          <View key={report.id} style={s.card}>
            <Text style={s.h2}>
              {reportReasons[report.reason] || "Signalement"}
            </Text>
            <Text style={s.text}>
              {reportStatuses[report.status as keyof typeof reportStatuses] ||
                "En attente de mise à jour"}
            </Text>
            <Text style={s.small}>
              {new Date(report.created_at).toLocaleString("fr-FR")}
            </Text>
          </View>
        ))
      )}
      <Button
        title="Actualiser les statuts"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {query.hasNextPage && (
        <Button
          title="Voir les précédents"
          secondary
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
