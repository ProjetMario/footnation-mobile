import React, { useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { readAsset } from "../lib/readAsset";
import { AuthGate } from "../components/AuthGate";
import {
  Button,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export default function Verification() {
  return (
    <Screen title="Vérifier mon profil">
      <AuthGate>
        <Request />
      </AuthGate>
    </Screen>
  );
}
function Request() {
  const s = useUIStyles();

  const { session } = useAuth();
  const uid = session!.user.id;
  const cache = useQueryClient();
  const [files, setFiles] = useState<
    Record<string, DocumentPicker.DocumentPickerAsset>
  >({});
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const attempt = useRef({
    id: randomUUID(),
    paths: {} as Record<string, string>,
  });
  const latest = useQuery({
    queryKey: ["verification-request", uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verification_requests")
        .select("id,status,requested_at,reviewer_notes")
        .eq("profile_id", uid)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error?.code === "42P01" || error?.code === "PGRST205")
        throw new Error(
          "Les demandes de vérification ne sont pas encore disponibles. Merci de réessayer ultérieurement.",
        );
      if (error) throw error;
      return data;
    },
  });
  const pick = useMutation({
    mutationFn: async (kind: string) => {
      const result = await DocumentPicker.getDocumentAsync({
        type: Object.keys(mimeExtensions),
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (
        !mimeExtensions[file.mimeType || ""] ||
        (file.size || 0) > 5 * 1024 * 1024
      )
        throw new Error(
          "Choisissez un PDF, JPG, PNG ou WebP de moins de 5 Mo.",
        );
      setFiles((current) => ({ ...current, [kind]: file }));
      delete attempt.current.paths[kind];
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      if (!files.identities || !files.supporting)
        throw new Error("Les deux documents sont requis.");
      if (url.trim() && !/^https:\/\//i.test(url.trim()))
        throw new Error("Le lien doit commencer par https://.");
      const existing = await supabase
        .from("verification_requests")
        .select("id,status")
        .eq("id", attempt.current.id)
        .eq("profile_id", uid)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data) {
        const current = await latest.refetch();
        if (current.error) throw current.error;
        if (["pending", "approved"].includes(current.data?.status || ""))
          throw new Error("Une demande est déjà en cours ou approuvée.");
        for (const kind of ["identities", "supporting"]) {
          if (attempt.current.paths[kind]) continue;
          const file = files[kind];
          const body = await readAsset(file.uri, 5 * 1024 * 1024);
          const path = `${uid}/${kind}/${attempt.current.id}.${mimeExtensions[file.mimeType!]}`;
          const upload = await supabase.storage
            .from("verification-documents")
            .upload(path, body, { contentType: file.mimeType, upsert: true });
          if (upload.error) throw upload.error;
          attempt.current.paths[kind] = path;
        }
        const insert = await supabase.from("verification_requests").insert({
          id: attempt.current.id,
          profile_id: uid,
          identity_document_url: attempt.current.paths.identities,
          supporting_document_url: attempt.current.paths.supporting,
          transfermarkt_url: url.trim() || null,
          notability_description: description.trim() || null,
          status: "pending",
        });
        if (insert.error) throw insert.error;
      }
      return "Votre demande de vérification a été reçue.";
    },
    onSuccess: () => {
      setFiles({});
      void cache.invalidateQueries({ queryKey: ["verification-request", uid] });
    },
  });
  return (
    <>
      <Text style={s.subtitle}>
        Joignez une pièce d’identité et un justificatif de votre activité.
        Formats acceptés : PDF, JPG, PNG, WebP ; 5 Mo maximum par document.
      </Text>
      {latest.isPending ? (
        <Loading />
      ) : latest.error ? (
        <ErrorState error={latest.error} />
      ) : (
        latest.data && (
          <View style={s.card}>
            <Text style={s.text}>
              Statut :{" "}
              {latest.data.status === "pending"
                ? "En cours d’examen"
                : latest.data.status === "approved"
                  ? "Approuvée"
                  : "Refusée"}
            </Text>
            {!!latest.data.reviewer_notes && (
              <Text style={s.text}>{latest.data.reviewer_notes}</Text>
            )}
          </View>
        )
      )}
      {!!(
        !latest.isPending &&
        !latest.error &&
        !["pending", "approved"].includes(latest.data?.status || "")
      ) && (
        <>
          <Button
            title={files.identities?.name || "Choisir la pièce d’identité"}
            secondary
            disabled={send.isPending || pick.isPending}
            onPress={() => pick.mutate("identities")}
          />
          <Button
            title={
              files.supporting?.name || "Choisir le justificatif d’activité"
            }
            secondary
            disabled={send.isPending || pick.isPending}
            onPress={() => pick.mutate("supporting")}
          />
          <Field
            label="Lien Transfermarkt (facultatif)"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
          />
          <Field
            label="Présentation de votre activité"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={4000}
          />
          <Button
            title="Envoyer ma demande"
            busy={send.isPending}
            disabled={!files.identities || !files.supporting}
            onPress={() => send.mutate()}
          />
        </>
      )}
      {!!pick.error && <ErrorState error={pick.error} />}
      {!!send.error && <ErrorState error={send.error} />}
      {!!send.isSuccess && <Text style={s.text}>{send.data}</Text>}
    </>
  );
}
async function requireSiteAdmin() {
  const { data, error } = await supabase.rpc("is_site_admin");
  if (error) throw error;
  if (data !== true)
    throw new Error("Accès réservé à l’administration FootNation.");
}
export function AdminVerifications() {
  return (
    <Screen title="Vérifications des profils">
      <AuthGate>
        <ReviewList />
      </AuthGate>
    </Screen>
  );
}
function ReviewList() {
  const { session } = useAuth();
  const access = useQuery({
    queryKey: ["verification-admin-access", session!.user.id],
    queryFn: async () => {
      await requireSiteAdmin();
      return true;
    },
    staleTime: 0,
  });
  const requests = useInfiniteQuery({
    queryKey: ["admin-verification-requests", session!.user.id],
    enabled: access.data === true,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      await requireSiteAdmin();
      const { data, error } = await supabase
        .from("verification_requests")
        .select(
          "*,profile:profiles!verification_requests_profile_id_fkey(full_name)",
        )
        .order("requested_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 29);
      if (error) throw error;
      return data as any[];
    },
    getNextPageParam: (last, pages) =>
      last.length === 30 ? pages.length * 30 : undefined,
  });
  if (access.isPending) return <Loading />;
  if (access.error) return <ErrorState error={access.error} />;
  return (
    <>
      {requests.isPending ? (
        <Loading />
      ) : requests.error ? (
        <ErrorState error={requests.error} />
      ) : !requests.data.pages.flat().length ? (
        <Empty title="Aucune demande" />
      ) : (
        requests.data.pages
          .flat()
          .map((request) => (
            <Review
              key={`${request.id}:${request.updated_at}`}
              request={request}
            />
          ))
      )}
      {!!requests.hasNextPage && (
        <Button
          title="Voir plus"
          busy={requests.isFetchingNextPage}
          onPress={() => void requests.fetchNextPage()}
        />
      )}
    </>
  );
}
function Review({ request }: { request: any }) {
  const s = useUIStyles();

  const { session } = useAuth();
  const cache = useQueryClient();
  const [notes, setNotes] = useState(request.reviewer_notes || "");
  const [choice, setChoice] = useState<"approved" | "rejected" | null>(null);
  const document = useMutation({
    mutationFn: async (path: string) => {
      await requireSiteAdmin();
      const { data, error } = await supabase.storage
        .from("verification-documents")
        .createSignedUrl(path, 120);
      if (error) throw error;
      await Linking.openURL(data.signedUrl);
    },
  });
  const review = useMutation({
    mutationFn: async (status: "approved" | "rejected") => {
      await requireSiteAdmin();
      const { error } = await supabase.rpc("review_profile_verification", {
        p_request_id: request.id,
        p_status: status,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setChoice(null);
      void cache.invalidateQueries({
        queryKey: ["admin-verification-requests"],
      });
    },
  });
  return (
    <View style={s.card}>
      <Text style={s.h2}>{request.profile?.full_name || "Profil"}</Text>
      <Text style={s.small}>{request.status}</Text>
      {!!request.notability_description && (
        <Text style={s.text}>{request.notability_description}</Text>
      )}
      <Button
        title="Voir le profil"
        secondary
        onPress={() => router.push(`/profile/${request.profile_id}`)}
      />
      <Button
        title="Consulter la pièce d’identité"
        secondary
        busy={document.isPending}
        onPress={() => document.mutate(request.identity_document_url)}
      />
      <Button
        title="Consulter le justificatif"
        secondary
        disabled={document.isPending}
        onPress={() => document.mutate(request.supporting_document_url)}
      />
      <Field
        label="Note de décision"
        value={notes}
        onChangeText={setNotes}
        multiline
        maxLength={3000}
      />
      <Button
        title="Approuver"
        secondary
        disabled={review.isPending}
        onPress={() => setChoice("approved")}
      />
      <Button
        title="Refuser"
        secondary
        disabled={review.isPending}
        onPress={() => setChoice("rejected")}
      />
      {!!choice && (
        <>
          <Text style={s.text}>Confirmer cette décision ?</Text>
          <Button
            title="Confirmer"
            busy={review.isPending}
            onPress={() => review.mutate(choice)}
          />
          <Button
            title="Annuler"
            secondary
            disabled={review.isPending}
            onPress={() => setChoice(null)}
          />
        </>
      )}
      {!!document.error && <ErrorState error={document.error} />}
      {!!review.error && <ErrorState error={review.error} />}
    </View>
  );
}
