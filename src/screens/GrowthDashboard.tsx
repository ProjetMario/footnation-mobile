import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Activity, BarChart3, TrendingUp } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import { Button, ErrorState, Loading, Screen } from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  growthCount,
  growthPercent,
  parseGrowthSnapshot,
  type GrowthSnapshot,
} from "../lib/growthMetrics";
import { useTheme, useThemedStyles, type ThemeColors } from "../theme";

export default function GrowthDashboard() {
  return (
    <Screen title="Croissance & activité">
      <AuthGate>
        <Dashboard />
      </AuthGate>
    </Screen>
  );
}
function Dashboard() {
  const { session } = useAuth();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ["native-growth-dashboard", session?.user.id],
    enabled: !!session?.user.id,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const result = await supabase.rpc("get_native_growth_dashboard");
      if (result.error) {
        if (result.error.code === "PGRST202" || result.error.code === "42883")
          throw new Error(
            "Le tableau de bord sera disponible après l’activation du service de mesure FootNation.",
          );
        if (result.error.code === "42501")
          throw new Error(
            "Cet espace est réservé aux administrateurs de FootNation.",
          );
        throw result.error;
      }
      return parseGrowthSnapshot(result.data);
    },
  });
  if (query.isPending) return <Loading />;
  if (!query.data)
    return (
      <>
        <ErrorState error={query.error} />
        <Button title="Réessayer" onPress={() => void query.refetch()} />
      </>
    );
  const data = query.data;
  const m = data.metrics;
  const activation = m.activation_7d;
  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <BarChart3 size={26} color={colors.blue} />
        <Text style={styles.title}>Comprendre ce qui fait revenir</Text>
        <Text style={styles.body}>
          Des inscriptions aux équipes actives, suivez les usages réels de
          FootNation.
        </Text>
        <Text style={styles.caption}>
          Mesure des ouvertures depuis le{" "}
          {formatDay(data.measurement_started_at)}. Actualisé le{" "}
          {formatDay(data.generated_at)} à{" "}
          {new Date(data.generated_at).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          })}{" "}
          UTC.
        </Text>
      </View>
      {!!query.error && <ErrorState error={query.error} />}
      <Button
        title={
          query.isFetching ? "Actualisation…" : "Actualiser les indicateurs"
        }
        secondary
        disabled={query.isFetching}
        onPress={() => void query.refetch()}
      />
      <Text style={styles.sectionTitle}>Inscription et engagement</Text>
      <View style={styles.grid}>
        <Metric
          label="Comptes existants"
          value={growthCount(m.profiles_total)}
        />
        <Metric label="Inscrits · 7 jours" value={growthCount(m.signups_7d)} />
        <Metric
          label="Inscrits · 30 jours"
          value={growthCount(m.signups_30d)}
        />
        <Metric
          label="Actifs mesurés · 7 jours"
          value={growthCount(m.active_7d)}
        />
        <Metric
          label="Actifs mesurés · 30 jours"
          value={growthCount(m.active_30d)}
        />
        <Metric
          label="Première action sous 7 jours"
          value={
            activation
              ? growthPercent(activation.activated, activation.eligible)
              : "Indisponible"
          }
          detail={
            activation
              ? `${activation.activated} sur ${activation.eligible} comptes observables`
              : undefined
          }
        />
      </View>
      <View style={styles.note}>
        <Text style={styles.body}>
          Première action : publier un post ou répondre à une convocation dans
          les 7 jours suivant l’inscription. Seuls les comptes inscrits depuis
          le début de la mesure et observés pendant 7 jours sont inclus.
        </Text>
      </View>
      <Text style={styles.sectionTitle}>La vie des équipes</Text>
      <View style={styles.grid}>
        <Metric
          label="Équipes actives · 7 jours"
          value={growthCount(m.active_teams_7d)}
          detail="Au moins 2 membres actifs dans l’application"
        />
        <Metric
          label="Réponses aux convocations · 7 jours"
          value={growthCount(m.convocation_replies_7d)}
        />
        <Metric
          label="Posts publiés · 7 jours"
          value={growthCount(m.posts_7d)}
        />
        <Metric
          label="Auteurs de posts · 7 jours"
          value={growthCount(m.publishers_7d)}
        />
        <Metric
          label="Inscrits parrainés · 30 jours"
          value={growthCount(m.referred_signups_30d)}
        />
        <Metric
          label="Parrainés actifs · 7 jours"
          value={growthCount(m.referred_active_7d)}
          detail="Parmi les parrainés inscrits depuis 30 jours"
        />
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <TrendingUp color={colors.blue} size={20} />
          <Text style={styles.sectionTitle}>Les 14 derniers jours</Text>
        </View>
        <Text style={styles.caption}>
          Inscriptions et comptes ayant ouvert l’application connectée. Une
          personne compte une seule fois par jour.
        </Text>
        <ScrollView
          horizontal
          contentContainerStyle={styles.chart}
          accessibilityLabel="Historique quotidien des inscriptions et utilisateurs actifs"
        >
          {data.daily.map((day) => {
            const maximum = Math.max(
              1,
              ...data.daily.flatMap((d) => [d.signups, d.active ?? 0]),
            );
            return (
              <View
                key={day.date}
                style={styles.chartColumn}
                accessible
                accessibilityLabel={`${formatDay(day.date)} : ${day.signups} inscriptions ; ${day.active === null ? "activité non mesurée" : `${day.active} actifs`}`}
              >
                <View style={styles.barPair}>
                  <View
                    style={[
                      styles.bar,
                      {
                        backgroundColor: colors.blue,
                        height: Math.max(2, (day.signups / maximum) * 100),
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.bar,
                      {
                        backgroundColor:
                          day.active === null ? colors.border : colors.success,
                        height: Math.max(
                          2,
                          ((day.active ?? 0) / maximum) * 100,
                        ),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.caption}>
                  {day.date.slice(8)}/{day.date.slice(5, 7)}
                </Text>
                <Text style={styles.chartValue}>
                  {day.signups} / {day.active ?? "—"}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        <Text style={styles.caption}>
          Bleu : inscrits · Vert : actifs · — : avant la mesure
        </Text>
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <Activity color={colors.blue} size={20} />
          <Text style={styles.sectionTitle}>Retour à J7 et J30</Text>
        </View>
        <Text style={styles.body}>
          Retour exactement le 7e ou le 30e jour après l’inscription, en UTC. Le
          jour du retour doit être entièrement terminé ; les cohortes trop
          récentes restent en observation.
        </Text>
        {data.cohorts.length === 0 && (
          <Text style={styles.caption}>
            Les premières cohortes apparaîtront avec les nouvelles inscriptions
            après l’activation de la mesure.
          </Text>
        )}
        {data.cohorts.map((cohort) => (
          <Cohort key={cohort.week} cohort={cohort} />
        ))}
      </View>
      <View style={styles.note}>
        <Text style={styles.sectionTitle}>Lire ces chiffres</Text>
        <Text style={styles.body}>
          Périodes de 7 et 30 jours calendaires UTC, jour courant inclus. Les
          ouvertures ne sont mesurées que dans les versions intégrant ce suivi,
          au premier plan et avec une connexion réseau. L’historique précédent
          n’est pas reconstitué.
        </Text>
        <Text style={styles.body}>
          Les actions reflètent les comptes, publications et réponses encore
          présents en base. Une équipe active désigne au moins deux membres
          actuellement rattachés ayant ouvert l’application dans la période.
        </Text>
        <Text style={styles.body}>
          Les abandons avant inscription et le nombre de destinataires d’une
          invitation ne sont pas mesurés. Aucun taux de conversion d’invitation
          n’est déduit sans ce dénominateur.
        </Text>
        {!!Object.values(data.sources).some((available) => !available) && (
          <Text style={styles.unavailable}>
            Certaines sources ne sont pas disponibles sur cette base. Les
            indicateurs concernés restent « Indisponible ».
          </Text>
        )}
      </View>
    </View>
  );
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View
      style={styles.metric}
      accessible
      accessibilityLabel={`${label} : ${value}${detail ? `. ${detail}` : ""}`}
    >
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.body}>{label}</Text>
      {!!detail && <Text style={styles.caption}>{detail}</Text>}
    </View>
  );
}
function Cohort({ cohort }: { cohort: GrowthSnapshot["cohorts"][number] }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.cohort}>
      <Text style={styles.cohortTitle}>
        Semaine du {formatDay(cohort.week)} · {cohort.signups} inscrits
      </Text>
      <Text style={styles.body}>
        J7 : {growthPercent(cohort.d7_returned, cohort.d7_eligible)} ·{" "}
        {cohort.d7_returned}/{cohort.d7_eligible} comptes observables
      </Text>
      <Text style={styles.body}>
        J30 : {growthPercent(cohort.d30_returned, cohort.d30_eligible)} ·{" "}
        {cohort.d30_returned}/{cohort.d30_eligible} comptes observables
      </Text>
    </View>
  );
}
function formatDay(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stack: { gap: 18, paddingBottom: 32 },
    hero: {
      padding: 22,
      gap: 12,
      borderRadius: 22,
      backgroundColor: colors.accentSoft,
    },
    title: { fontSize: 26, fontWeight: "800", color: colors.ink },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.ink,
      flexShrink: 1,
    },
    body: { fontSize: 14, lineHeight: 21, color: colors.ink },
    caption: { fontSize: 12, lineHeight: 18, color: colors.muted },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    metric: {
      flexGrow: 1,
      flexBasis: 145,
      minWidth: 135,
      gap: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 18,
    },
    metricValue: { fontSize: 25, fontWeight: "800", color: colors.blue },
    card: {
      padding: 18,
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    note: {
      padding: 16,
      backgroundColor: colors.surfaceRaised,
      borderRadius: 16,
      gap: 10,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    chart: { gap: 12, alignItems: "flex-end", paddingVertical: 12 },
    chartColumn: { alignItems: "center", gap: 6, minWidth: 42 },
    barPair: {
      height: 102,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 4,
    },
    bar: { width: 12, borderRadius: 3 },
    chartValue: { fontSize: 11, color: colors.ink },
    cohort: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 14,
      gap: 7,
    },
    cohortTitle: { fontWeight: "700", fontSize: 14, color: colors.ink },
    unavailable: { fontSize: 14, lineHeight: 21, color: colors.danger },
  });
}
