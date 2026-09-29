import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Loading,
  useUIStyles,
} from "../ui";
import {
  formatCount,
  formatDate,
  objectValue,
  profileName,
  safeExternalUrl,
  textValue,
  type AdminSection,
  type Filters,
} from "../../lib/admin/contracts";
import { useAdmin, useAdminLayout } from "./AdminUI";
import { ProfileLink } from "./AdminRecords";
import { useTheme } from "../../theme";
import PosthogEmbed from "./PosthogEmbed";
import {
  metricTrend,
  ratio,
  weightedSessionDuration,
} from "../../lib/admin/metrics";

export function Metric({
  label,
  value,
  onPress,
  detail,
}: {
  label: string;
  value: unknown;
  onPress?: () => void;
  detail?: string;
}) {
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.card, styles.stat]}
    >
      <Text style={s.small}>{label}</Text>
      <Text
        style={[s.title, { fontSize: typeof value === "number" ? 30 : 16 }]}
      >
        {typeof value === "string" ? value : formatCount(value)}
      </Text>
      {!!detail && <Text style={s.small}>{detail}</Text>}
    </Pressable>
  );
}
export function AdminOverview({
  navigate,
}: {
  navigate: (section: AdminSection, filters?: Filters) => void;
}) {
  const { api, uid } = useAdmin();
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const query = useQuery({
    queryKey: ["admin", uid, "overview", "day"],
    queryFn: () => api.overview(),
    retry: false,
    staleTime: 30000,
  });
  if (query.isPending) return <Loading />;
  if (!query.data)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const data = query.data;
  const counts = data.counts;
  const cards: [string, string, AdminSection][] = [
    ["users", "Utilisateurs", "users"],
    ["clubs", "Clubs", "clubs"],
    ["premium", "Membres Premium", "premium"],
    ["reports", "Signalements en attente", "moderation"],
    ["newToday", "Nouveaux aujourd’hui", "users"],
    ["newWeek", "Nouveaux · 7 jours", "users"],
    ["newMonth", "Nouveaux · 30 jours", "users"],
    ["claimed", "Clubs revendiqués", "clubs"],
    ["indoor", "Centres indoor", "clubs"],
    ["posts", "Publications", "publications"],
    ["postsToday", "Publications aujourd’hui", "publications"],
    ["connections", "Connexions acceptées", "users"],
    ["connectionsToday", "Connexions aujourd’hui", "users"],
    ["messages", "Messages", "moderation"],
    ["messagesWeek", "Messages · 7 jours", "moderation"],
    ["profileViews", "Vues de profils", "performance"],
  ];
  return (
    <View style={styles.stack}>
      <Text style={s.small}>Actualisé le {formatDate(data.generatedAt)}</Text>
      {!!query.error && <ErrorState error={query.error} />}
      <View style={styles.grid}>
        {cards.map(([key, label, section]) => (
          <Metric
            key={key}
            label={label}
            value={counts[key]}
            onPress={() => navigate(section)}
          />
        ))}
      </View>
      <Text style={s.h2}>Engagement et activité</Text>
      <View style={styles.grid}>
        {[
          ["activeDay", "Actifs · 24 h"],
          ["activeWeek", "Actifs · 7 jours"],
          ["activeMonth", "Actifs · 30 jours"],
        ].map(([key, label]) => (
          <Metric
            key={key}
            label={label}
            value={counts[key]}
            detail="Utilisateurs distincts ayant ouvert une session mesurée"
          />
        ))}
      </View>
      <View style={styles.grid}>
        <Metric label="Publications · 5 minutes" value={counts.actions5m} />
        <Metric label="Publications · 30 minutes" value={counts.actions30m} />
      </View>
      <View style={styles.grid}>
        {[
          ["primary_role", "Répartition par rôle", "role"],
          ["department", "Répartition par département", "department"],
          ["nationality", "Répartition par nationalité", "country"],
        ].map(([key, label, filter]) => (
          <View key={key} style={[styles.card, styles.cell]}>
            <Text style={s.h2}>{label}</Text>
            {(data.breakdowns[key] || []).map((item) => (
              <Button
                key={item.label}
                title={`${item.label} · ${formatCount(item.count)}`}
                secondary
                onPress={() =>
                  navigate(
                    "users",
                    item.label === "Non renseigné"
                      ? {}
                      : { [filter]: item.label },
                  )
                }
              />
            ))}
            {!data.breakdowns[key]?.length && (
              <Text style={s.small}>Aucune donnée renseignée.</Text>
            )}
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        <View style={[styles.card, styles.cell]}>
          <Text style={s.h2}>Utilisateurs les plus actifs</Text>
          <Text style={s.small}>Classement par publications</Text>
          {data.topUsers == null ? (
            <Text style={s.small}>Classement indisponible</Text>
          ) : (
            data.topUsers.map((row) => (
              <View key={row.id} style={s.between}>
                <ProfileLink profile={row} />
                <Text style={s.small}>{formatCount(row.posts)} posts</Text>
              </View>
            ))
          )}
        </View>
        <View style={[styles.card, styles.cell]}>
          <Text style={s.h2}>Clubs les plus suivis</Text>
          {data.topClubs == null ? (
            <Text style={s.small}>Classement indisponible</Text>
          ) : (
            data.topClubs.map((row) => (
              <Pressable
                key={row.id}
                accessibilityRole="link"
                onPress={() => router.push(`/club/${row.id}`)}
                style={[s.row, { minHeight: 48 }]}
              >
                <Avatar
                  uri={textValue(row.logo_url, "")}
                  size={36}
                  name={textValue(row.name)}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.text}>{textValue(row.name)}</Text>
                  <Text style={s.small}>
                    {formatCount(row.members)} abonnés
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </View>
      <View style={styles.card}>
        <Text style={s.h2}>Dernières inscriptions</Text>
        {data.recent.map((row) => (
          <View key={row.id} style={[s.between, { flexWrap: "wrap" }]}>
            <ProfileLink profile={row} />
            <Text style={s.small}>{formatDate(row.created_at)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
function Series({
  title,
  rows,
}: {
  title: string;
  rows: { period: string; value: number }[];
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const { styles } = useAdminLayout();
  const [details, setDetails] = useState(false);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const points = rows
    .map(
      (r, i) =>
        `${10 + (i * 580) / Math.max(1, rows.length - 1)},${145 - (r.value * 125) / max}`,
    )
    .join(" ");
  return (
    <View style={styles.card}>
      <Text style={s.h2}>{title}</Text>
      {!rows.length ? (
        <Empty title="Aucune mesure disponible" />
      ) : (
        <>
          <View
            accessible
            accessibilityLabel={`${title} : ${rows.reduce((n, r) => n + r.value, 0).toLocaleString("fr-FR")} sur la période`}
          >
            <Svg width="100%" height={160} viewBox="0 0 600 160">
              <Line x1={10} y1={145} x2={590} y2={145} stroke={colors.border} />
              <Polyline
                points={points}
                fill="none"
                stroke={colors.blue}
                strokeWidth={3}
              />
            </Svg>
          </View>
          <View style={s.between}>
            <Text style={s.small}>{rows[0].period}</Text>
            <Text style={s.small}>{rows.at(-1)?.period}</Text>
          </View>
          <Button
            title={
              details ? "Masquer les valeurs" : "Voir les valeurs du graphique"
            }
            secondary
            onPress={() => setDetails(!details)}
          />
          {details &&
            rows.map((r) => (
              <View key={r.period} style={s.between}>
                <Text style={s.small}>{r.period}</Text>
                <Text style={s.text}>{formatCount(r.value)}</Text>
              </View>
            ))}
        </>
      )}
    </View>
  );
}
function PerformanceSummary({
  counts,
  rows,
  signups,
}: {
  counts: Record<string, number | null>;
  rows: Record<string, unknown>[];
  signups: { period: string; value: number }[];
}) {
  const { styles } = useAdminLayout();
  const s = useUIStyles();
  const percentage = (n: number | null) =>
    n === null
      ? "Indisponible"
      : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
  const money = (n: number | null) =>
    n === null
      ? "Indisponible"
      : n.toLocaleString("fr-FR", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        });
  const duration = weightedSessionDuration(rows);
  const estimatedRevenue =
    typeof counts.premium === "number" ? counts.premium * 9.99 : null;
  const latest = [
    {
      key: "signups",
      label: "Nouveaux inscrits",
      rows: signups,
      isPercent: false,
    },
    ...[
      ["users", "Utilisateurs GA"],
      ["sessions", "Sessions"],
      ["pageViews", "Pages vues"],
      ["engagementRate", "Taux d’engagement"],
    ].map(([key, label]) => ({
      key,
      label,
      isPercent: key === "engagementRate",
      rows: rows
        .filter((r) => typeof r[key] === "number")
        .map((r) => ({ period: String(r.period), value: Number(r[key]) })),
    })),
  ];
  return (
    <View style={styles.stack}>
      <Text style={s.h2}>Dernière période mesurée</Text>
      <View style={styles.grid}>
        {latest.map((item) => {
          const trend = metricTrend(item.rows);
          return (
            <Metric
              key={item.key}
              label={item.label}
              value={item.isPercent ? percentage(trend.value) : trend.value}
              detail={
                trend.percent === null
                  ? "Évolution non disponible"
                  : `${trend.percent > 0 ? "+" : ""}${trend.percent.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % par rapport à la période précédente`
              }
            />
          );
        })}
      </View>
      <Text style={s.h2}>Métriques business et produit</Text>
      <View style={styles.grid}>
        <Metric
          label="Temps moyen par session"
          value={
            duration === null
              ? null
              : `${Math.floor(duration / 60)} min ${Math.round(duration % 60)} s`
          }
          detail="Moyenne pondérée par les sessions mesurées"
        />
        <Metric
          label="DAU / MAU"
          value={percentage(ratio(counts.activeDay, counts.activeMonth, 100))}
          detail="Part des actifs du mois présents sur les dernières 24 h"
        />
        <Metric
          label="Profils complets"
          value={percentage(ratio(counts.completeProfiles, counts.users, 100))}
          detail={`${formatCount(counts.completeProfiles)} / ${formatCount(counts.users)} profils · 7 champs réellement renseignés`}
        />
        <Metric
          label="Densité du réseau"
          value={
            ratio(counts.connections, counts.users)?.toLocaleString("fr-FR", {
              maximumFractionDigits: 2,
            }) ?? null
          }
          detail="Connexions acceptées par utilisateur"
        />
        <Metric
          label="MRR estimé"
          value={money(estimatedRevenue)}
          detail="Simulation identique au Web : 9,99 € × membres Premium. Ce montant n’est pas un revenu encaissé."
        />
        <Metric
          label="ARR estimé"
          value={money(
            estimatedRevenue === null ? null : estimatedRevenue * 12,
          )}
          detail="Projection annuelle de cette simulation"
        />
        <Metric
          label="Rétention à 30 jours"
          value={null}
          detail="Source de rétention à connecter"
        />
        <Metric
          label="Coût d’acquisition"
          value={null}
          detail="Dépenses marketing à connecter"
        />
      </View>
    </View>
  );
}
export function AdminPerformance() {
  const { api, uid } = useAdmin();
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const [period, setPeriod] = useState("day");
  const query = useQuery({
    queryKey: ["admin", uid, "overview", period],
    queryFn: () => api.overview(period),
    retry: false,
  });
  const ga = useQuery({
    queryKey: ["admin", uid, "ga4", period],
    queryFn: () => api.edge("ga4-analytics", { granularity: period }),
    retry: false,
  });
  const rows: Record<string, unknown>[] = Array.isArray(ga.data?.rows)
    ? ga.data.rows
        .map(objectValue)
        .map((row) => ({
          ...row,
          engagementRate:
            typeof row.engagementRate === "number"
              ? row.engagementRate * 100
              : undefined,
        }))
    : [];
  return (
    <View style={styles.stack}>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {[
          ["day", "Jour"],
          ["week", "Semaine"],
          ["month", "Mois"],
        ].map(([id, label]) => (
          <Chip
            key={id}
            label={label}
            selected={period === id}
            onPress={() => setPeriod(id)}
          />
        ))}
      </View>
      <PerformanceSummary
        counts={query.data?.counts || {}}
        rows={rows}
        signups={query.data?.signups || []}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <Series title="Nouvelles inscriptions" rows={query.data.signups} />
        )
      )}
      <Text style={s.h2}>Audience Web · Google Analytics</Text>
      {ga.isPending ? (
        <Loading />
      ) : ga.error ? (
        <ErrorState error={ga.error} retry={() => void ga.refetch()} />
      ) : !rows.length ? (
        <Empty
          title="Aucune mesure Analytics disponible"
          description="Le tableau affichera les mesures lorsque le service sera configuré et alimenté."
        />
      ) : (
        <View style={styles.stack}>
          {[
            ["users", "Utilisateurs"],
            ["sessions", "Sessions"],
            ["pageViews", "Pages vues"],
            ["engagementRate", "Taux d’engagement"],
            ["averageSessionDuration", "Durée moyenne de session (s)"],
          ].map(([key, label]) => (
            <Series
              key={key}
              title={label}
              rows={rows
                .filter((r) => typeof r[key] === "number")
                .map((r) => ({
                  period: textValue(r.period),
                  value: Number(r[key]),
                }))}
            />
          ))}
        </View>
      )}
      <View style={styles.grid}>
        <MobileStats platform="android" />
        <MobileStats platform="ios" />
      </View>
    </View>
  );
}
function MobileStats({ platform }: { platform: "ios" | "android" }) {
  const { api, uid } = useAdmin();
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const q = useQuery({
    queryKey: ["admin", uid, "mobile-stats", platform],
    queryFn: () => api.edge("get-mobile-stats", { platform }),
    retry: false,
    staleTime: 60000,
  });
  return (
    <View style={[styles.card, styles.cell]}>
      <Text style={s.h2}>{platform === "ios" ? "iOS" : "Android"}</Text>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {[
            ["totalInstalls", "Installations mesurées"],
            ["activeToday", "Actifs aujourd’hui"],
            ["activeWeek", "Actifs cette semaine"],
          ].map(([k, label]) => (
            <View key={k} style={[s.between, { flexWrap: "wrap" }]}>
              <Text style={s.text}>{label}</Text>
              <Text style={s.h2}>{formatCount(q.data?.[k])}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
export function AdminSports() {
  const { api, uid } = useAdmin();
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const year =
    new Date().getUTCFullYear() - (new Date().getUTCMonth() < 6 ? 1 : 0);
  const season = `${year}-${year + 1}`;
  const q = useQuery({
    queryKey: ["admin", uid, "sports", season],
    queryFn: () => api.sports(season),
    retry: false,
    refetchInterval: 60000,
  });
  const groups: Record<string, Record<string, string>> = {
    clubs: {
      total: "Clubs",
      checked: "Clubs examinés",
      withTeams: "Avec équipes",
      incomplete: "Collecte partielle",
      identityUnverified: "Affiliation à vérifier",
      noTeamsPublished: "Aucune équipe publiée",
      sourceUnavailable: "Source indisponible",
      stale: "À revérifier",
    },
    teams: { total: "Équipes" },
    matches: {
      total: "Rencontres uniques",
      played: "Matchs joués",
      upcoming: "Matchs à venir",
    },
    queue: {
      pending: "Tâches en attente",
      running: "Tâches en cours",
      failed: "Tâches en échec",
    },
  };
  return (
    <View style={styles.stack}>
      <Text style={s.h2}>Actualisation nationale · {season}</Text>
      <Button
        title="Actualiser le suivi"
        secondary
        busy={q.isFetching}
        onPress={() => void q.refetch()}
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} />
      ) : (
        <>
          <View style={styles.grid}>
            {Object.entries(groups).flatMap(([group, fields]) =>
              Object.entries(fields).map(([key, label]) => (
                <Metric
                  key={`${group}.${key}`}
                  label={label}
                  value={objectValue(q.data?.[group])[key]}
                />
              )),
            )}
          </View>
          <Text style={s.small}>
            Dernière réussite : {formatDate(q.data?.lastSuccessAt)} · Dernière
            tentative : {formatDate(q.data?.lastAttemptAt)}
          </Text>
          <Text style={s.small}>
            Une absence de données publiées ne signifie pas qu’un club est
            inactif.
          </Text>
          {Array.isArray(q.data?.recentErrors) &&
            q.data.recentErrors.map((error, i) => {
              const item = objectValue(error);
              return (
                <View key={i} style={styles.card}>
                  <Button
                    title={textValue(item.clubName, "Voir le club")}
                    secondary
                    onPress={() => router.push(`/club/${String(item.clubId)}`)}
                  />
                  <Text style={s.text}>{textValue(item.message)}</Text>
                  <Text style={s.small}>{formatDate(item.attemptedAt)}</Text>
                </View>
              );
            })}
        </>
      )}
    </View>
  );
}
export function AdminPosthog() {
  const s = useUIStyles();
  const { styles } = useAdminLayout();
  const [error, setError] = useState<unknown>(null);
  const url = safeExternalUrl(process.env.EXPO_PUBLIC_POSTHOG_DASHBOARD_URL);
  return (
    <View style={styles.card}>
      <Text style={s.h2}>PostHog</Text>
      {url ? (
        <>
          <Text style={s.text}>Tableau de bord FootNation configuré.</Text>
          <PosthogEmbed url={url} />
          <Button
            title="Ouvrir PostHog"
            secondary
            onPress={() => {
              void Linking.openURL(url).catch(setError);
            }}
          />
        </>
      ) : (
        <Empty
          title="Tableau de bord non configuré"
          description="Renseignez l’URL du tableau de bord partagé pour le consulter ici."
        />
      )}
      {!!error && <ErrorState error={error} />}
      <Text style={s.small}>
        Cette rubrique consulte le tableau de bord existant. Elle n’ajoute aucun
        suivi dans l’application.
      </Text>
    </View>
  );
}
