import React, { useState } from "react";
import { Text, View } from "react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
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
import {
  feedbackAreas,
  feedbackCategories,
  feedbackStatuses,
  type BetaFeedback,
  type FeedbackStatus,
} from "../lib/betaFeedback";

export default function BetaFeedbackAdmin() {
  const uid = useAuth().session?.user.id;
  return (
    <Screen title="Retours de bêta" back>
      <AuthGate>{!!uid && <FeedbackQueue key={uid} uid={uid} />}</AuthGate>
    </Screen>
  );
}
function FeedbackQueue({ uid }: { uid: string }) {
  const s = useUIStyles();
  const cache = useQueryClient();
  const [status, setStatus] = useState<FeedbackStatus>("new");
  const query = useInfiniteQuery({
    queryKey: ["beta-feedback", uid, status],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const result = await supabase.rpc("get_native_beta_feedback", {
        p_actor_id: uid,
        p_status: status,
        p_offset: pageParam,
      });
      if (result.error)
        throw new Error(
          result.error.code === "42501"
            ? "Cet espace est réservé aux administrateurs."
            : "Les retours sont indisponibles. Réessayez.",
        );
      return result.data as BetaFeedback[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  const review = useMutation({
    mutationFn: async ({
      row,
      next,
    }: {
      row: BetaFeedback;
      next: FeedbackStatus;
    }) => {
      const auth = await supabase.auth.getUser();
      if (auth.error || auth.data.user?.id !== uid)
        throw new Error("La session a changé. Rechargez l’écran.");
      const result = await supabase.rpc("review_native_beta_feedback", {
        p_actor_id: uid,
        p_id: row.id,
        p_status: next,
        p_expected_updated_at: row.updated_at,
      });
      if (result.error || result.data !== true)
        throw new Error(
          "Mise à jour non confirmée. Actualisez avant de réessayer.",
        );
    },
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["beta-feedback", uid] }),
  });
  return (
    <>
      <Text style={s.text}>
        Trier les difficultés rencontrées, suivre leur traitement puis confirmer
        les corrections avec les clubs pilotes.
      </Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(feedbackStatuses).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={status === key}
            onPress={() => setStatus(key as FeedbackStatus)}
          />
        ))}
      </View>
      <Button
        title="Actualiser"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {!!review.error && <ErrorState error={review.error} />}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data?.pages.flat().length && (
            <Empty title="Aucun retour dans cette catégorie" />
          )}
          {query.data?.pages.flat().map((row) => (
            <View key={row.id} style={s.card}>
              <Text style={s.h2}>
                {feedbackCategories[row.category]} · {feedbackAreas[row.area]}
              </Text>
              <Text style={s.small}>
                {new Date(row.created_at).toLocaleString("fr-FR")} ·{" "}
                {row.platform} · v{row.app_version}
              </Text>
              <Text selectable style={s.text}>
                {row.message}
              </Text>
              {status !== "reviewing" && (
                <Button
                  secondary
                  title="Prendre en charge"
                  busy={review.isPending}
                  onPress={() => review.mutate({ row, next: "reviewing" })}
                />
              )}
              {status !== "resolved" && (
                <Button
                  title="Marquer comme résolu"
                  busy={review.isPending}
                  onPress={() => review.mutate({ row, next: "resolved" })}
                />
              )}
              {status === "resolved" && (
                <Button
                  secondary
                  title="Rouvrir"
                  busy={review.isPending}
                  onPress={() => review.mutate({ row, next: "new" })}
                />
              )}
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
