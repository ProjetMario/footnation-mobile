import { ClubMessageModeration } from "../components/ClubMessageModeration";
import { useState } from "react";
import { Text, View } from "react-native";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
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
import { ExternalLinkButton } from "../components/ExternalLinkButton";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { clubReportReasons, clubReportStatuses } from "../lib/clubReport";
const statuses = clubReportStatuses;
async function requireAdmin(uid: string) {
  const user = await supabase.auth.getUser();
  if (user.error) throw user.error;
  if (user.data.user?.id !== uid) throw new Error("La session a changé.");
  const r = await supabase.rpc("is_site_admin");
  if (r.error) throw r.error;
  if (r.data !== true)
    throw new Error(
      "Cet espace est réservé aux administrateurs de FootNation.",
    );
}
export default function ClubReportReview() {
  return (
    <Screen title="Signalements des discussions de club">
      <AuthGate>
        <Reports />
      </AuthGate>
    </Screen>
  );
}
function Reports() {
  const s = useUIStyles();

  const uid = useAuth().session!.user.id;
  const [status, setStatus] = useState("pending");
  const [selected, setSelected] = useState<Record<string, any> | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["club-message-report-review", uid, status],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      await requireAdmin(uid);
      let q = supabase
        .from("club_chat_message_reports")
        .select(
          "id,message_id,reason,details,status,admin_notes,created_at,reviewed_at,reviewed_by",
          { count: "exact" },
        );
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
  if (selected)
    return (
      <Review
        key={selected.id}
        initial={selected}
        uid={uid}
        close={() => {
          setSelected(null);
          void query.refetch();
        }}
      />
    );
  return (
    <>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries({ ...statuses, all: "Tous" }).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={status === key}
            onPress={() => setStatus(key)}
          />
        ))}
      </View>
      <Button
        title="Actualiser"
        secondary
        busy={query.isFetching}
        onPress={() => void query.refetch()}
      />
      {!!query.isPending && <Loading />}
      {!!query.error && <ErrorState error={query.error} />}
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
              <Text style={s.small}>
                {statuses[row.status] || row.status} ·{" "}
                {new Date(row.created_at).toLocaleString("fr-FR")}
              </Text>
              {!!row.details && <Text style={s.text}>{row.details}</Text>}
              <Button
                title="Examiner le signalement"
                onPress={() => setSelected(row)}
              />
            </View>
          ))}
      {!!(
        query.data &&
        !query.error &&
        !query.data.pages.flatMap((p) => p.rows).length
      ) && <Empty title="Aucun signalement dans cette catégorie" />}
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
function Review({
  initial,
  uid,
  close,
}: {
  initial: Record<string, any>;
  uid: string;
  close: () => void;
}) {
  const s = useUIStyles();

  const [baseline] = useState(initial);
  const [moderating, setModerating] = useState(false);
  const [status, setStatus] = useState(initial.status);
  const [notes, setNotes] = useState(initial.admin_notes || "");
  const message = useQuery({
    queryKey: ["club-report-message", uid, initial.id],
    queryFn: async () => {
      await requireAdmin(uid);
      const r = await supabase.rpc("get_native_club_report_message", {
        p_report_id: initial.id,
      });
      if (r.error) throw r.error;
      return r.data as Record<string, any> | null;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      await requireAdmin(uid);
      if (!Object.hasOwn(statuses, status) || notes.trim().length > 3000)
        throw new Error("Vérifiez le statut et la longueur de la note.");
      let q = supabase
        .from("club_chat_message_reports")
        .update({ status, admin_notes: notes.trim() || null })
        .eq("id", baseline.id);
      for (const key of ["status", "admin_notes", "reviewed_at", "reviewed_by"])
        q = baseline[key] == null ? q.is(key, null) : q.eq(key, baseline[key]);
      const r = await q.select("id").maybeSingle();
      if (r.error) throw r.error;
      if (!r.data)
        throw new Error(
          "Le signalement a changé ou n’est plus accessible. Fermez le formulaire pour le recharger.",
        );
    },
    onSuccess: close,
  });
  return (
    <View style={{ gap: 14 }}>
      <Text style={s.h2}>
        {clubReportReasons[initial.reason] || initial.reason}
      </Text>
      {!!initial.details && <Text style={s.text}>{initial.details}</Text>}
      {!!message.isPending && <Loading />}
      {!!message.error && (
        <ErrorState
          error={message.error}
          retry={() => void message.refetch()}
        />
      )}
      <Button
        title="Actualiser le message"
        secondary
        busy={message.isFetching}
        disabled={moderating || save.isPending}
        onPress={() => void message.refetch()}
      />
      {!!(message.data && !message.error) && (
        <View style={s.card}>
          <Text style={s.h2}>
            {message.data.group_name || "Discussion de club"}
          </Text>
          <Text style={s.small}>{message.data.author_name || "Membre"}</Text>
          <Text style={s.small}>
            {message.data.is_deleted
              ? "Message supprimé"
              : message.data.is_blocked
                ? "Message bloqué"
                : "Message disponible"}
          </Text>
          {!message.data.is_deleted && (
            <Text selectable style={s.text}>
              {message.data.content}
            </Text>
          )}
          {!!(message.data.media_url && !message.data.is_deleted) && (
            <ExternalLinkButton
              url={message.data.media_url}
              title="Examiner la pièce jointe"
            />
          )}
        </View>
      )}
      {!!(message.data && !message.error) && (
        <ClubMessageModeration
          reportId={initial.id}
          message={message.data}
          uid={uid}
          disabled={save.isPending || message.isFetching}
          onBusy={setModerating}
        />
      )}
      {!!(!message.isPending && !message.error && !message.data) && (
        <Empty title="Message introuvable" />
      )}
      <Text style={s.subtitle}>
        Le statut suit le traitement du signalement. Il ne bloque ni ne supprime
        automatiquement le message.
      </Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {Object.entries(statuses).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            selected={status === key}
            disabled={save.isPending || moderating}
            onPress={() => setStatus(key)}
          />
        ))}
      </View>
      <Field
        label="Note de traitement (accessible au déclarant)"
        multiline
        maxLength={3000}
        value={notes}
        onChangeText={setNotes}
        editable={!save.isPending && !moderating}
      />
      {!!save.error && <ErrorState error={save.error} />}
      <Button
        title="Enregistrer le traitement"
        busy={save.isPending}
        disabled={message.isPending || !!message.error || moderating}
        onPress={() => save.mutate()}
      />
      <Button
        title="Fermer le formulaire"
        secondary
        disabled={save.isPending || moderating}
        onPress={close}
      />
    </View>
  );
}
