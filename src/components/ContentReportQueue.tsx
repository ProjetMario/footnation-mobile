import React, { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  useUIStyles,
} from "./ui";
import {
  type ContentReport,
  type ReportAction,
  reportColumns,
  reportContentPath,
  reportReasons,
  reportReviewPayload,
  reportStatuses,
  reportUrgency,
} from "../lib/reportReview";

export function ContentReportQueue() {
  const { session } = useAuth();
  return <AccountReportQueue key={session?.user.id || "guest"} />;
}
function AccountReportQueue() {
  const s = useUIStyles();
  const { session } = useAuth();
  const uid = session?.user.id;
  const cache = useQueryClient();
  const [status, setStatus] = useState<keyof typeof reportStatuses>("pending");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ContentReport | null>(null);
  const [notes, setNotes] = useState("");
  async function token() {
    const current = await supabase.auth.getSession();
    if (!uid || current.error || current.data.session?.user.id !== uid)
      throw new Error("La session a changé. Reconnectez-vous.");
    return current.data.session.access_token;
  }
  const query = useQuery({
    queryKey: ["content-report-queue", uid, status, page],
    enabled: !!uid,
    queryFn: async () => {
      const jwt = await token();
      const admin = await supabase
        .rpc("can_review_content")
        .setHeader("Authorization", `Bearer ${jwt}`);
      if (admin.error || admin.data !== true)
        throw new Error(
          "La modération est réservée aux administrateurs. Vérifiez que le service est à jour.",
        );
      const result = await supabase
        .from("user_reports")
        .select(reportColumns)
        .eq("status", status)
        .order("report_priority")
        .order("created_at")
        .order("id")
        .range(page * 30, page * 30 + 29)
        .setHeader("Authorization", `Bearer ${jwt}`);
      if (result.error)
        throw new Error("Les signalements sont indisponibles. Réessayez.");
      return result.data as ContentReport[];
    },
  });
  const review = useMutation({
    mutationFn: async (action: ReportAction) => {
      if (!selected) throw new Error("Sélectionnez un signalement.");
      const payload = reportReviewPayload(selected, action, notes);
      const jwt = await token();
      const result = await supabase
        .rpc("review_content_report", payload)
        .setHeader("Authorization", `Bearer ${jwt}`);
      if (result.error || result.data?.id !== selected.id)
        throw new Error(
          "La décision n’a pas été confirmée. Actualisez avant de réessayer.",
        );
    },
    onSuccess: () => {
      setSelected(null);
      setNotes("");
      void cache.invalidateQueries({ queryKey: ["content-report-queue"] });
    },
  });
  return (
    <View style={{ gap: 16 }}>
      <Text style={s.h2} accessibilityRole="header">
        Traiter les signalements
      </Text>
      <Text style={s.small}>
        Les décisions sont enregistrées. Le retrait masque le contenu dans
        l’application ; il ne supprime pas les contributions des autres membres.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {Object.entries(reportStatuses).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={status === key}
            disabled={review.isPending}
            onPress={() => {
              setStatus(key as keyof typeof reportStatuses);
              setPage(0);
              setSelected(null);
            }}
          />
        ))}
      </View>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data?.length === 0 ? (
        <Empty title="Aucun signalement dans cette rubrique" />
      ) : (
        query.data?.map((report) => (
          <View key={report.id} style={s.card}>
            <Text style={s.h2}>
              {reportReasons[report.reason] || report.reason}
            </Text>
            <Text style={s.small}>
              {reportStatuses[report.status]} ·{" "}
              {new Date(report.created_at).toLocaleString("fr-FR")}
            </Text>
            {!!reportUrgency(report) && (
              <Text accessibilityRole="alert" style={s.text}>
                {reportUrgency(report)}
              </Text>
            )}
            {!!report.details && (
              <Text selectable style={s.text}>
                {report.details}
              </Text>
            )}
            {!!report.admin_notes && (
              <Text style={s.text}>Décision : {report.admin_notes}</Text>
            )}
            <Button
              title="Profil signalé"
              secondary
              onPress={() => router.push(`/profile/${report.reported_id}`)}
            />
            {!!reportContentPath(report) && (
              <Button
                title="Voir le contenu"
                secondary
                onPress={() => router.push(reportContentPath(report)! as any)}
              />
            )}
            {["pending", "reviewed"].includes(report.status) && (
              <Button
                title="Examiner ce signalement"
                disabled={review.isPending}
                onPress={() => {
                  setSelected(report);
                  setNotes("");
                  review.reset();
                }}
              />
            )}
            {selected?.id === report.id && (
              <View style={{ gap: 12 }}>
                <Field
                  label="Motif de la décision (visible par l’auteur du signalement)"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  maxLength={3000}
                  editable={!review.isPending}
                />
                {!!review.error && <ErrorState error={review.error} />}
                <Button
                  title="Marquer en cours de traitement"
                  disabled={review.isPending || notes.trim().length < 3}
                  onPress={() => review.mutate("review")}
                />
                {!!reportContentPath(report) && (
                  <Button
                    title="Confirmer le retrait du contenu"
                    disabled={review.isPending || notes.trim().length < 3}
                    onPress={() => review.mutate("remove_content")}
                  />
                )}
                <Button
                  title="Classer sans suite"
                  secondary
                  disabled={review.isPending || notes.trim().length < 3}
                  onPress={() => review.mutate("dismiss")}
                />
                <Button
                  title="Annuler"
                  secondary
                  disabled={review.isPending}
                  onPress={() => setSelected(null)}
                />
              </View>
            )}
          </View>
        ))
      )}
      <Button
        title="Actualiser"
        secondary
        disabled={review.isPending}
        onPress={() => void query.refetch()}
      />
      {page > 0 && (
        <Button
          title="Précédents"
          secondary
          onPress={() => {
            setPage((v) => v - 1);
            setSelected(null);
          }}
        />
      )}
      {query.data?.length === 30 && (
        <Button
          title="Suivants"
          secondary
          onPress={() => {
            setPage((v) => v + 1);
            setSelected(null);
          }}
        />
      )}
    </View>
  );
}
