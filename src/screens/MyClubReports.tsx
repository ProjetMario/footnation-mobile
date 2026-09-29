import { useState } from "react";
import { Text, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Chip,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { clubReportReasons, clubReportStatuses } from "../lib/clubReport";
export default function MyClubReports() {
  return (
    <Screen title="Mes signalements de club">
      <AuthGate>
        <Reports />
      </AuthGate>
    </Screen>
  );
}
function Reports() {
  const s = useUIStyles();

  const uid = useAuth().session!.user.id;
  const [status, setStatus] = useState("all");
  const query = useInfiniteQuery({
    queryKey: ["my-club-message-reports", uid, status],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const user = await supabase.auth.getUser();
      if (user.error) throw user.error;
      if (user.data.user?.id !== uid)
        throw new Error("La session a changé. Rechargez cet écran.");
      let q = supabase
        .from("club_chat_message_reports")
        .select("id,reason,details,status,admin_notes,created_at,reviewed_at", {
          count: "exact",
        })
        .eq("reporter_id", uid);
      if (status !== "all") q = q.eq("status", status);
      const r = await q
        .order("created_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (r.error) throw r.error;
      return { rows: r.data, count: r.count || 0 };
    },
    getNextPageParam: (last, pages) =>
      last.rows.length === 30 ? pages.length * 30 : undefined,
  });
  return (
    <>
      <Text style={s.subtitle}>
        Retrouvez ici vos signalements de messages dans les discussions de club
        et leur suivi.
      </Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries({ all: "Tous", ...clubReportStatuses }).map(
          ([key, label]) => (
            <Chip
              key={key}
              label={label}
              selected={status === key}
              onPress={() => setStatus(key)}
            />
          ),
        )}
      </View>
      <Button
        title="Actualiser le suivi"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!(query.data && !query.error) && (
        <Text style={s.small}>{query.data.pages[0].count} signalements</Text>
      )}
      {!query.error &&
        query.data?.pages
          .flatMap((p) => p.rows)
          .map((row) => (
            <View key={row.id} style={s.card}>
              <Text style={s.h2}>
                {clubReportReasons[row.reason] || row.reason}
              </Text>
              <Text style={s.text}>
                {clubReportStatuses[row.status] || row.status}
              </Text>
              <Text style={s.small}>
                Envoyé le {new Date(row.created_at).toLocaleString("fr-FR")}
              </Text>
              {!!row.details && (
                <>
                  <Text style={s.small}>Vos précisions</Text>
                  <Text selectable style={s.text}>
                    {row.details}
                  </Text>
                </>
              )}
              {!!row.admin_notes && (
                <>
                  <Text style={s.small}>Note de traitement</Text>
                  <Text selectable style={s.text}>
                    {row.admin_notes}
                  </Text>
                </>
              )}
              {!!row.reviewed_at && (
                <Text style={s.small}>
                  Dernier examen :{" "}
                  {new Date(row.reviewed_at).toLocaleString("fr-FR")}
                </Text>
              )}
              <Text selectable style={s.small}>
                Référence : {row.id}
              </Text>
            </View>
          ))}
      {!!(
        query.data &&
        !query.error &&
        !query.data.pages.flatMap((p) => p.rows).length
      ) && (
        <Empty
          title={
            status === "all"
              ? "Vous n’avez aucun signalement de club"
              : "Aucun signalement avec ce statut"
          }
          description="Un signalement enregistré depuis une discussion apparaît dans ce suivi."
        />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Charger la suite"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
