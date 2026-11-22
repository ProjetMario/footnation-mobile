import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Empty, ErrorState, Field, Loading, useUIStyles } from "../ui";
import { AdminTabs, useAdmin, useAdminLayout } from "./AdminUI";
import { supabase } from "../../lib/supabase";
import {
  categoryLabels,
  confidenceLabel,
  createDecisionApi,
  decisionFilters,
  outcomeLabels,
  signalLabels,
  type DecisionFilter,
  type DecisionRow,
  type DecisionStatus,
  type ReviewOutcome,
} from "../../lib/admin/opportunityDecisions";

export function AdminDecisions() {
  const { uid } = useAdmin();
  const api = useMemo(() => createDecisionApi(uid, supabase), [uid]);
  const cache = useQueryClient();
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const [filter, setFilter] = useState<DecisionFilter>("review");
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState("");
  const key = ["admin", uid, "decisions"];
  const status = useQuery({
    queryKey: [...key, "status"],
    queryFn: api.status,
    retry: false,
    refetchInterval: 30000,
  });
  const page = useQuery({
    queryKey: [...key, filter, offset],
    queryFn: () => api.page(filter, offset),
    retry: false,
    enabled: status.isSuccess,
    refetchInterval: 30000,
  });
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<string>) => action(),
    onSuccess: (message) => {
      setNotice(message);
      void cache.invalidateQueries({ queryKey: key });
    },
    onError: () => {
      setNotice("");
      void cache.invalidateQueries({ queryKey: key });
    },
  });
  const run = (action: () => Promise<string>) => mutation.mutate(action);
  if (status.isPending) return <Loading />;
  if (!status.data)
    return (
      <ErrorState error={status.error} retry={() => void status.refetch()} />
    );
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={s.h2}>Analyse des annonces</Text>
        <Text style={s.text}>
          Classement proposé par OpenAI et signaux à examiner. Les annonces
          restent visibles ; tu décides des suites à donner.
        </Text>
        <Text style={s.small}>
          {status.data.review} à examiner · {status.data.pending} en attente ·{" "}
          {status.data.failed} en échec
        </Text>
        <Text style={s.small}>
          {status.data.usedToday} / {status.data.dailyLimit} analyses réservées
          aujourd’hui (UTC, tentatives incluses).
        </Text>
        {!status.data.ready && (
          <Text style={s.text}>
            La connexion OpenAI doit être configurée côté serveur avant
            l’activation.
          </Text>
        )}
        {status.data.enabled &&
          (!status.data.lastWorkerAt ||
            Date.now() - Date.parse(status.data.lastWorkerAt) > 180000) && (
            <Text style={s.text}>
              Le traitement automatique n’a pas été observé récemment. Vérifie
              la planification ou lance un lot ci-dessous.
            </Text>
          )}
        <Settings
          key={`${status.data.enabled}:${status.data.dailyLimit}`}
          status={status.data}
          busy={mutation.isPending}
          save={(enabled, limit) =>
            run(async () => {
              await api.configure(enabled, limit);
              return "Réglages enregistrés.";
            })
          }
        />
        <Button
          title="Ajouter jusqu’à 100 annonces existantes"
          secondary
          disabled={mutation.isPending}
          onPress={() =>
            run(
              async () =>
                `${await api.backfill()} annonce(s) ajoutée(s) à la file.`,
            )
          }
        />
        <Button
          title="Analyser le prochain lot (3 maximum)"
          disabled={
            mutation.isPending || !status.data.ready || !status.data.enabled
          }
          onPress={() =>
            run(async () => {
              const r = await api.run();
              return `${r.completed} analyse(s) terminée(s), ${r.failed} échec(s), ${r.superseded} résultat(s) périmé(s).`;
            })
          }
        />
      </View>
      {!!notice && (
        <Text accessibilityRole="alert" style={s.text}>
          {notice}
        </Text>
      )}
      {!!mutation.error && <ErrorState error={mutation.error} />}
      <AdminTabs
        items={decisionFilters}
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setOffset(0);
        }}
        label="Filtrer les analyses"
      />
      {page.isPending ? (
        <Loading />
      ) : page.error ? (
        <ErrorState error={page.error} retry={() => void page.refetch()} />
      ) : (
        <>
          {!page.data?.rows.length && (
            <Empty
              title="Aucune annonce dans cette rubrique"
              description="Les nouvelles annonces et les modifications de contenu rejoignent automatiquement la file."
            />
          )}
          {page.data?.rows.map((row) => (
            <ReviewCard
              key={`${row.opportunity_id}:${row.revision}:${row.review_outcome}`}
              row={row}
              busy={mutation.isPending}
              retry={() =>
                run(async () => {
                  await api.retry(row);
                  return "Annonce remise en attente.";
                })
              }
              review={(outcome, note) =>
                run(async () => {
                  await api.review(row, outcome, note);
                  return "Décision enregistrée.";
                })
              }
            />
          ))}
          <View style={styles.grid}>
            <Button
              title="Précédent"
              secondary
              disabled={!offset || mutation.isPending}
              onPress={() => setOffset(Math.max(0, offset - 20))}
            />
            <Text style={s.small}>
              {page.data?.total || 0} annonce(s) · page {offset / 20 + 1}
            </Text>
            <Button
              title="Suivant"
              secondary
              disabled={page.data?.nextOffset == null || mutation.isPending}
              onPress={() => setOffset(page.data!.nextOffset!)}
            />
          </View>
        </>
      )}
    </View>
  );
}
function Settings({
  status,
  busy,
  save,
}: {
  status: DecisionStatus;
  busy: boolean;
  save: (enabled: boolean, limit: number) => void;
}) {
  const [limit, setLimit] = useState(String(status.dailyLimit));
  const valid =
    /^\d+$/.test(limit) && Number(limit) >= 1 && Number(limit) <= 5000;
  return (
    <View style={{ gap: 10 }}>
      <Field
        label="Limite quotidienne d’analyses (1 à 5 000)"
        value={limit}
        onChangeText={setLimit}
        keyboardType="number-pad"
      />
      <Button
        title="Enregistrer la limite"
        secondary
        disabled={busy || !valid}
        onPress={() => save(status.enabled, Number(limit))}
      />
      <Button
        title={
          status.enabled
            ? "Mettre l’analyse en pause"
            : "Activer l’analyse automatique"
        }
        secondary
        disabled={busy || !valid || (!status.enabled && !status.ready)}
        onPress={() => save(!status.enabled, Number(limit))}
      />
    </View>
  );
}
function ReviewCard({
  row,
  busy,
  retry,
  review,
}: {
  row: DecisionRow;
  busy: boolean;
  retry: () => void;
  review: (outcome: ReviewOutcome, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const r = row.result;
  return (
    <View style={styles.card}>
      <Text style={s.h2}>{row.title}</Text>
      <Text style={s.small}>
        Catégorie actuelle :{" "}
        {categoryLabels[row.opportunity_type] || row.opportunity_type} ·{" "}
        {row.is_active ? "Active" : "Inactive"}
      </Text>
      <Text style={s.text}>{row.description || "Sans description"}</Text>
      <Button
        title="Ouvrir l’annonce"
        secondary
        onPress={() => router.push(`/opportunity/${row.opportunity_id}` as any)}
      />
      {r ? (
        <>
          <Text style={s.text}>
            Suggestion : {categoryLabels[r.category || "autre"]} · confiance{" "}
            {confidenceLabel(r.categoryConfidence)}
          </Text>
          <Text style={s.small}>
            Intention :{" "}
            {r.listingKind === "offer"
              ? "Offre"
              : r.listingKind === "request"
                ? "Demande"
                : "À préciser"}
          </Text>
          {Object.entries(signalLabels).map(([id, label]) => (
            <Text key={id} style={s.small}>
              {label} : {confidenceLabel(r.signals[id] ?? null)}
            </Text>
          ))}
          <Text style={s.small}>
            Ces estimations ne prouvent pas une fraude. Les alertes utilisent un
            seuil initial de 65 %, à ajuster après évaluation.
          </Text>
          {r.incomplete && (
            <Text style={s.text}>
              Analyse partielle ou refusée : vérification humaine nécessaire.
            </Text>
          )}
          {!!row.review_outcome && (
            <Text style={s.text}>
              {outcomeLabels[row.review_outcome]} · {row.review_note}
            </Text>
          )}
          {(!row.review_outcome || row.review_outcome === "escalated") && (
            <>
              <Field
                label="Motif de ta décision"
                multiline
                value={note}
                onChangeText={setNote}
                maxLength={1000}
              />
              <View style={styles.grid}>
                {(
                  [
                    "validated",
                    "dismissed",
                    "escalated",
                    "apply_category",
                  ] as ReviewOutcome[]
                ).map((outcome) => (
                  <Button
                    key={outcome}
                    title={
                      {
                        validated: "Valider l’analyse",
                        dismissed: "Écarter l’alerte",
                        escalated: "Marquer à approfondir",
                        apply_category: "Appliquer la catégorie proposée",
                      }[outcome]
                    }
                    secondary
                    disabled={
                      busy ||
                      note.trim().length < 3 ||
                      (outcome === "apply_category" &&
                        (!r.category ||
                          r.category === "autre" ||
                          r.category === row.opportunity_type))
                    }
                    onPress={() => review(outcome, note)}
                  />
                ))}
              </View>
            </>
          )}
        </>
      ) : (
        <Text style={s.text}>
          {row.status === "failed"
            ? "Analyse indisponible après trois tentatives."
            : row.status === "processing"
              ? "Analyse en cours…"
              : "En attente d’analyse."}
        </Text>
      )}
      {row.status === "failed" && (
        <Button
          title="Réessayer l’analyse"
          secondary
          disabled={busy}
          onPress={retry}
        />
      )}
    </View>
  );
}
