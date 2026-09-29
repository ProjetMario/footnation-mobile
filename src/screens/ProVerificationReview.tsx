import { withProReview } from "../lib/proReviewDetails";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
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
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { proVerificationLabels } from "../lib/proVerification";
type Page = {
  id: string;
  name: string;
  page_type: string;
  club_id: string | null;
  updated_at: string;
  request_message: string | null;
  verification_status: string;
  verification_notes: string | null;
  verification_requested_at: string | null;
  club: {
    name: string;
    city: string | null;
    numero_affiliation: string | null;
  } | null;
  owner: { full_name: string } | null;
};
async function requireAdmin(uid: string) {
  const session = await supabase.auth.getUser();
  if (session.error) throw session.error;
  if (session.data.user?.id !== uid)
    throw new Error("La session a changé. Rechargez cet écran.");
  const access = await supabase.rpc("is_site_admin");
  if (access.error) throw access.error;
  if (access.data !== true)
    throw new Error(
      "Cet espace est réservé aux administrateurs de FootNation.",
    );
}
export default function ProVerificationReview() {
  return (
    <Screen title="Validation des Pages Pro">
      <AuthGate>
        <Requests />
      </AuthGate>
    </Screen>
  );
}
function Requests() {
  const s = useUIStyles();

  const uid = useAuth().session!.user.id;
  const [status, setStatus] = useState("pending_review");
  const query = useInfiniteQuery({
    queryKey: ["admin-pro-validation", uid, status],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      await requireAdmin(uid);
      const { data, error } = await supabase
        .from("pro_pages")
        .select(
          "id,name,page_type,club_id,updated_at,request_message,verification_status,verification_notes,verification_requested_at,club:clubs!club_id(name,city,numero_affiliation),owner:profiles!owner_id(full_name),review:pro_page_review_details(request_message,verification_notes)",
        )
        .eq("verification_status", status)
        .order("verification_requested_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 19);
      if (error) throw error;
      return (data || []).map(withProReview) as unknown as Page[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 20 ? pages.length * 20 : undefined,
  });
  return (
    <>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {["pending_review", "approved", "rejected"].map((value) => (
          <Chip
            key={value}
            label={proVerificationLabels[value]}
            selected={status === value}
            onPress={() => setStatus(value)}
          />
        ))}
      </View>
      <Button
        title="Actualiser"
        secondary
        busy={query.isRefetching}
        onPress={() => void query.refetch()}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data?.pages.flat().map((page) => (
        <Decision key={`${page.id}:${page.updated_at}`} page={page} uid={uid} />
      ))}
      {!!(query.data && !query.data.pages.flat().length) && (
        <Empty title="Aucune demande pour ce statut" />
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
function Decision({ page, uid }: { page: Page; uid: string }) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(
    null,
  );
  const review = useMutation({
    mutationFn: async () => {
      if (!decision) return;
      await requireAdmin(uid);
      const { data, error } = await supabase.rpc("review_pro_page", {
        p_id: page.id,
        p_decision: decision,
        p_notes: notes.trim() || null,
        p_expected_updated_at: page.updated_at,
      });
      if (error?.code === "40001")
        throw new Error(
          "La page a changé depuis son ouverture. Actualisez la liste avant de décider.",
        );
      if (error) throw error;
      if (data !== decision)
        throw new Error(
          "La décision n’a pas été confirmée. Actualisez la liste.",
        );
    },
    onSuccess: () => {
      setDecision(null);
      void cache.invalidateQueries({ queryKey: ["admin-pro-validation"] });
      void cache.invalidateQueries({ queryKey: ["native-pro-page"] });
      void cache.invalidateQueries({ queryKey: ["native-pro-pages"] });
    },
  });
  return (
    <View style={s.card}>
      <Text style={s.h2}>{page.name}</Text>
      <Text style={s.text}>
        Propriétaire : {page.owner?.full_name || "Non renseigné"}
      </Text>
      <Text style={s.text}>Club lié : {page.club?.name || "Aucun"}</Text>
      {!!page.verification_requested_at && (
        <Text style={s.small}>
          Demande du{" "}
          {new Date(page.verification_requested_at).toLocaleString("fr-FR")}
        </Text>
      )}
      <Text style={s.text}>
        {page.request_message || "Aucun message joint à la demande."}
      </Text>
      {!!page.verification_notes && (
        <Text style={s.text}>
          Décision précédente : {page.verification_notes}
        </Text>
      )}
      <Button
        title="Consulter la page"
        secondary
        onPress={() => router.push(`/pro-pages/${page.id}`)}
      />
      {!!page.club?.city && (
        <Text style={s.text}>Ville : {page.club.city}</Text>
      )}
      {!!page.club?.numero_affiliation && (
        <Text style={s.text}>
          Numéro d’affiliation : {page.club.numero_affiliation}
        </Text>
      )}
      {page.verification_status === "pending_review" && (
        <>
          <Field
            label="Note visible par le propriétaire"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={3000}
            editable={!review.isPending}
          />
          {!decision ? (
            <>
              <Button
                title="Approuver la certification"
                disabled={review.isPending}
                onPress={() => setDecision("approved")}
              />
              <Button
                title="Refuser la demande"
                secondary
                disabled={review.isPending}
                onPress={() => setDecision("rejected")}
              />
            </>
          ) : (
            <>
              <Text style={s.text}>
                {decision === "approved"
                  ? "Confirmer la certification officielle de cette page ?"
                  : "Confirmer le refus de cette demande ?"}
              </Text>
              <Button
                title="Confirmer la décision"
                busy={review.isPending}
                onPress={() => review.mutate()}
              />
              <Button
                title="Annuler"
                secondary
                disabled={review.isPending}
                onPress={() => setDecision(null)}
              />
            </>
          )}
          {!!review.error && <ErrorState error={review.error} />}
        </>
      )}
    </View>
  );
}
