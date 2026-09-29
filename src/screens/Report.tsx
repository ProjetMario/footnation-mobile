import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
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
import { AuthGate } from "../components/AuthGate";
import { createProContent } from "../lib/proContentSave";
import {
  profileReportReasons as reasons,
  profileReportPayload as reportPayload,
  resolveReportContent,
} from "../lib/contentReport";
import { applyBlockIntent } from "../lib/blockIntent";
export default function Report() {
  const { id, kind, contentId } = useLocalSearchParams<{
    id: string;
    kind?: string;
    contentId?: string;
  }>();
  const { session } = useAuth();
  return (
    <Screen title="Signaler ou bloquer">
      <AuthGate>
        <Form
          key={JSON.stringify([session?.user.id, id, kind, contentId])}
          id={id}
          kind={kind}
          contentId={contentId}
        />
      </AuthGate>
    </Screen>
  );
}
function Form({
  id,
  kind,
  contentId,
}: {
  id: string;
  kind?: string;
  contentId?: string;
}) {
  const s = useUIStyles();

  const uid = useAuth().session!.user.id;
  const cache = useQueryClient();
  const [reportId] = useState(randomUUID);
  const [reason, setReason] = useState("inappropriate");
  const [details, setDetails] = useState("");
  const [confirmation, setConfirmation] = useState<{
    blocked: boolean;
    expectedId: string | null;
  } | null>(null);
  async function currentUser() {
    const r = await supabase.auth.getUser();
    if (r.error) throw r.error;
    if (r.data.user?.id !== uid)
      throw new Error("La session a changé. Rechargez cet écran.");
    if (uid === id)
      throw new Error("Cette action ne peut pas viser votre propre profil.");
  }
  async function readBlock() {
    const r = await supabase
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", uid)
      .eq("blocked_id", id)
      .maybeSingle();
    if (r.error) throw r.error;
    return r.data;
  }
  const hasContent = kind !== undefined || contentId !== undefined;
  async function resolveContent() {
    await currentUser();
    return resolveReportContent(
      { kind, contentId, authorId: id },
      async (table, key) => {
        const result = await supabase
          .from(table)
          .select("id,user_id")
          .eq("id", key)
          .maybeSingle();
        if (result.error) throw result.error;
        await currentUser();
        return result.data;
      },
    );
  }
  const content = useQuery({
    queryKey: ["report-content", uid, id, kind, contentId],
    enabled: hasContent && uid !== id,
    queryFn: resolveContent,
  });
  const blocked = useQuery({
    queryKey: ["block", uid, id],
    enabled: uid !== id,
    queryFn: async () => {
      await currentUser();
      return readBlock();
    },
  });
  const report = useMutation({
    mutationFn: async () => {
      await currentUser();
      const target = await resolveContent();
      const row = {
        id: reportId,
        reporter_id: uid,
        reported_id: id,
        ...reportPayload(reason, details, target),
      };
      await createProContent(
        {
          read: async (key) => {
            await currentUser();
            const r = await supabase
              .from("user_reports")
              .select("id,reporter_id,reported_id,reason,details")
              .eq("id", key)
              .eq("reporter_id", uid)
              .maybeSingle();
            if (r.error) throw r.error;
            return r.data;
          },
          insert: async (value) => {
            await currentUser();
            const r = await supabase.from("user_reports").insert(value);
            if (r.error) throw r.error;
          },
        },
        row,
      );
    },
  });
  const block = useMutation({
    mutationFn: async () => {
      if (!confirmation) throw new Error("Confirmez l’action.");
      await currentUser();
      await applyBlockIntent(
        {
          read: readBlock,
          insert: async () => {
            const r = await supabase
              .from("user_blocks")
              .insert({ blocker_id: uid, blocked_id: id });
            if (r.error) throw r.error;
          },
          remove: async (key) => {
            const r = await supabase
              .from("user_blocks")
              .delete()
              .eq("id", key)
              .eq("blocker_id", uid)
              .eq("blocked_id", id)
              .select("id")
              .maybeSingle();
            if (r.error) throw r.error;
            return !!r.data;
          },
        },
        confirmation.blocked,
        confirmation.expectedId,
      );
    },
    onSuccess: () => {
      setConfirmation(null);
      void cache.invalidateQueries();
    },
  });
  if (uid === id)
    return (
      <Empty title="Vous ne pouvez pas signaler ou bloquer votre propre profil." />
    );
  return (
    <>
      <Text style={s.h2}>
        {content.data ? `Signaler ${content.data.label}` : "Signaler ce profil"}
      </Text>
      {!!hasContent &&
        (content.isPending ? (
          <Loading />
        ) : content.error ? (
          <ErrorState
            error={content.error}
            retry={() => void content.refetch()}
          />
        ) : (
          <Text style={s.small}>
            Le lien de ce contenu sera transmis à l’équipe avec votre
            signalement.
          </Text>
        ))}
      <View style={{ gap: 8 }}>
        {Object.entries(reasons).map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={reason === value}
            disabled={report.isPending || report.isSuccess}
            onPress={() => setReason(value)}
          />
        ))}
      </View>
      <Field
        label="Précisions"
        value={details}
        onChangeText={setDetails}
        editable={!report.isPending && !report.isSuccess}
        multiline
        maxLength={hasContent ? 2700 : 3000}
      />
      {!!report.error && <ErrorState error={report.error} />}
      {report.isSuccess ? (
        <View style={{ gap: 12 }}>
          <Text style={s.text} accessibilityRole="alert">
            Votre signalement a été enregistré.
          </Text>
          <Button
            title="Suivre mes signalements"
            secondary
            onPress={() => router.push("/my-reports")}
          />
        </View>
      ) : (
        <Button
          title="Envoyer le signalement"
          onPress={() => report.mutate()}
          busy={report.isPending}
          disabled={hasContent && (content.isPending || content.isError)}
        />
      )}
      <View style={s.card}>
        <Text style={s.h2}>Blocage de ce membre</Text>
        {!!blocked.error && (
          <ErrorState
            error={blocked.error}
            retry={() => void blocked.refetch()}
          />
        )}
        <Button
          title="Actualiser le blocage"
          secondary
          busy={blocked.isFetching}
          disabled={block.isPending}
          onPress={() => void blocked.refetch()}
        />
        {!!(!blocked.isPending && !blocked.error) && (
          <Text style={s.subtitle}>
            {blocked.data
              ? "Vous avez bloqué ce membre."
              : "Vous n’avez pas bloqué ce membre."}
          </Text>
        )}
        {confirmation ? (
          <>
            <Text style={s.text}>
              {confirmation.blocked
                ? "Confirmer le blocage de ce membre ?"
                : "Autoriser à nouveau les interactions avec ce membre ?"}
            </Text>
            <Button
              title={
                confirmation.blocked
                  ? "Confirmer le blocage"
                  : "Confirmer le déblocage"
              }
              busy={block.isPending}
              onPress={() => block.mutate()}
            />
            <Button
              title="Annuler"
              secondary
              disabled={block.isPending}
              onPress={() => {
                setConfirmation(null);
                block.reset();
              }}
            />
          </>
        ) : (
          <Button
            title={blocked.data ? "Débloquer" : "Bloquer"}
            secondary
            disabled={blocked.isFetching || blocked.isError}
            onPress={() => {
              block.reset();
              setConfirmation({
                blocked: !blocked.data,
                expectedId: blocked.data?.id || null,
              });
            }}
          />
        )}
        {!!block.error && <ErrorState error={block.error} />}
      </View>
    </>
  );
}
