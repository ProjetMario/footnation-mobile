import React, { useState } from "react";
import { Linking, Text, View } from "react-native";
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
import { createClient } from "@supabase/supabase-js";
const labels = {
  pending: "En attente",
  approved: "Approuvées",
  rejected: "Refusées",
  all: "Toutes",
};
type Status = keyof typeof labels;
type Claim = {
  id: string;
  user_id: string;
  club_id: string;
  full_name: string;
  position: string;
  email: string;
  phone: string | null;
  message: string | null;
  numero_affiliation_fff: string | null;
  status: Exclude<Status, "all">;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  admin_notes: string | null;
  id_card_front_url: string | null;
  id_card_back_url: string | null;
  club: { name: string; city: string | null } | null;
};
async function requireReviewer(uid: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.user.id !== uid)
    throw new Error("La session a changé. Rechargez cet écran.");
  const jwt = data.session.access_token;
  const result = await supabase
    .rpc("can_review_content")
    .setHeader("Authorization", `Bearer ${jwt}`);
  if (result.error) throw result.error;
  if (result.data !== true)
    throw new Error(
      "Cet espace est réservé aux administrateurs de FootNation.",
    );
  return jwt;
}
export default function ClubClaimReview() {
  return (
    <Screen title="Demandes de club">
      <AuthGate>
        <ClubClaimRequests />
      </AuthGate>
    </Screen>
  );
}
export function ClubClaimRequests() {
  const uid = useAuth().session?.user.id;
  return uid ? <Requests key={uid} uid={uid} /> : null;
}
function Requests({ uid }: { uid: string }) {
  const s = useUIStyles();
  const [status, setStatus] = useState<Status>("pending");
  const [search, setSearch] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["club-claim-review", uid, status, search.trim()],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const jwt = await requireReviewer(uid);
      let request = supabase
        .from("club_claim_requests")
        .select(
          "id,user_id,club_id,full_name,position,email,phone,message,numero_affiliation_fff,status,created_at,updated_at,reviewed_at,admin_notes,id_card_front_url,id_card_back_url,club:fff_clubs!club_id(name,city)",
        )
        .order("created_at", { ascending: false })
        .order("id");
      if (status !== "all") request = request.eq("status", status);
      if (search.trim())
        request = request.ilike(
          "full_name",
          `%${search.trim().replace(/[\\%_]/g, "")}%`,
        );
      const { data, error } = await request
        .range(pageParam, pageParam + 19)
        .setHeader("Authorization", `Bearer ${jwt}`);
      if (error) throw error;
      return data as unknown as Claim[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 20 ? pages.length * 20 : undefined,
  });
  return (
    <>
      <Text style={s.subtitle}>
        Vérifiez la demande et les justificatifs avant d’accorder
        l’administration du club.
      </Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(labels).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={status === key}
            onPress={() => setStatus(key as Status)}
          />
        ))}
      </View>
      <Field label="Nom du demandeur" value={search} onChangeText={setSearch} />
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
      {query.data?.pages.flat().map((claim) => (
        <Request
          key={`${claim.id}:${claim.updated_at}`}
          claim={claim}
          uid={uid}
        />
      ))}
      {!!(query.data && !query.data.pages.flat().length) && (
        <Empty title="Aucune demande pour ce filtre" />
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
function Request({ claim, uid }: { claim: Claim; uid: string }) {
  const s = useUIStyles();

  const cache = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(claim.admin_notes || "");
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(
    null,
  );
  const review = useMutation({
    mutationFn: async () => {
      if (!decision) throw new Error("Choisissez une décision.");
      const jwt = await requireReviewer(uid);
      const { data, error } = await supabase
        .rpc("review_club_claim", {
          p_claim_id: claim.id,
          p_decision: decision,
          p_notes: notes.trim() || null,
          p_expected_updated_at: claim.updated_at,
        })
        .setHeader("Authorization", `Bearer ${jwt}`);
      if (error) throw error;
      if (data !== decision)
        throw new Error(
          "La décision n’a pas été confirmée. Actualisez la liste.",
        );
    },
    onSuccess: () => {
      setDecision(null);
      void cache.invalidateQueries({ queryKey: ["club-claim-review"] });
      void cache.invalidateQueries({ queryKey: ["my-club-claims"] });
      void cache.invalidateQueries({ queryKey: ["claim-club", claim.club_id] });
      void cache.invalidateQueries({ queryKey: ["site-admin-counts"] });
      void cache.invalidateQueries({ queryKey: ["admin", uid] });
    },
  });
  const document = useMutation({
    mutationFn: async (path: string) => {
      const jwt = await requireReviewer(uid);
      if (
        !path.startsWith(`club-claims/${claim.user_id}/`) ||
        path.includes("..") ||
        path.includes("\\")
      )
        throw new Error(
          "Format du justificatif non reconnu. Consultez la demande depuis le site.",
        );
      const reviewer = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        },
      );
      const { data, error } = await reviewer.storage
        .from("verification-documents")
        .createSignedUrl(path, 60);
      if (error) throw error;
      await requireReviewer(uid);
      await Linking.openURL(data.signedUrl);
    },
  });
  return (
    <View style={s.card}>
      <Text style={s.h2}>{claim.club?.name || "Club"}</Text>
      <Text style={s.text}>{claim.full_name}</Text>
      <Text style={s.small}>
        {labels[claim.status]} ·{" "}
        {new Date(claim.created_at).toLocaleDateString("fr-FR")}
      </Text>
      <Button
        title={expanded ? "Réduire" : "Examiner la demande"}
        secondary
        disabled={review.isPending}
        onPress={() => setExpanded(!expanded)}
      />
      {!!expanded && (
        <>
          <Text style={s.text}>Fonction : {claim.position}</Text>
          <Text style={s.text}>E-mail : {claim.email}</Text>
          {!!claim.phone && (
            <Text style={s.text}>Téléphone : {claim.phone}</Text>
          )}
          <Text style={s.text}>
            Numéro FFF : {claim.numero_affiliation_fff || "Non renseigné"}
          </Text>
          {!!claim.message && <Text style={s.text}>{claim.message}</Text>}
          <Button
            title="Voir le club"
            secondary
            onPress={() => router.push(`/club/${claim.club_id}`)}
          />
          <Button
            title="Voir le profil du demandeur"
            secondary
            onPress={() => router.push(`/profile/${claim.user_id}`)}
          />
          {!!claim.id_card_front_url && (
            <Button
              title="Consulter le justificatif recto"
              secondary
              busy={document.isPending}
              onPress={() => document.mutate(claim.id_card_front_url!)}
            />
          )}
          {!!claim.id_card_back_url && (
            <Button
              title="Consulter le justificatif verso"
              secondary
              busy={document.isPending}
              onPress={() => document.mutate(claim.id_card_back_url!)}
            />
          )}
          {!!document.error && <ErrorState error={document.error} />}
          {claim.status === "pending" ? (
            <>
              <Field
                label="Note de décision (visible par le demandeur)"
                multiline
                maxLength={3000}
                value={notes}
                editable={!review.isPending}
                onChangeText={setNotes}
              />
              {!decision && (
                <>
                  <Button
                    title="Approuver"
                    disabled={review.isPending}
                    onPress={() => setDecision("approved")}
                  />
                  <Button
                    title="Refuser"
                    secondary
                    disabled={review.isPending}
                    onPress={() => setDecision("rejected")}
                  />
                </>
              )}
              {!!decision && (
                <>
                  <Text style={s.text}>
                    {decision === "approved"
                      ? "Confirmer l’approbation ? Le demandeur deviendra administrateur du club. La fiche officielle sera vérifiée et les profils de club liés seront masqués au profit de cette fiche."
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
                    onPress={() => {
                      setDecision(null);
                      review.reset();
                    }}
                  />
                </>
              )}
              {!!review.error && <ErrorState error={review.error} />}
            </>
          ) : (
            <>
              {!!claim.admin_notes && (
                <Text style={s.text}>Note : {claim.admin_notes}</Text>
              )}
              {!!claim.reviewed_at && (
                <Text style={s.small}>
                  Décision du{" "}
                  {new Date(claim.reviewed_at).toLocaleDateString("fr-FR")}
                </Text>
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}
