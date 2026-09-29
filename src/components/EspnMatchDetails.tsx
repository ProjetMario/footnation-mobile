import React from "react";
import { Text, View } from "react-native";
import { useEspnMatchDetails } from "../lib/useMatches";
import { matchState } from "../lib/featuredMatches";
import type { MatchDTO } from "../types/matches";
import type { MatchStatistic } from "../lib/espnMatchDetails";
import { useConnectivity } from "./ConnectivityProvider";
import { Button, Loading, useUIStyles } from "./ui";
import { useTheme } from "../theme";

function display(value: number | null, percent: boolean) {
  return value === null
    ? "—"
    : `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}${percent ? " %" : ""}`;
}
function StatisticRow({
  stat,
  match,
}: {
  stat: MatchStatistic;
  match: MatchDTO;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const total = (stat.home ?? 0) + (stat.away ?? 0);
  const hasBoth = stat.home !== null && stat.away !== null && total > 0;
  return (
    <View
      accessible
      accessibilityLabel={`${stat.label}. ${match.home.name} : ${display(stat.home, stat.percent)}. ${match.away.name} : ${display(stat.away, stat.percent)}.`}
      style={{ gap: 6 }}
    >
      <View style={s.between}>
        <Text style={[s.text, { minWidth: 62, fontWeight: "700" }]}>
          {display(stat.home, stat.percent)}
        </Text>
        <Text style={[s.small, { flex: 1, textAlign: "center" }]}>
          {stat.label}
        </Text>
        <Text
          style={[
            s.text,
            { minWidth: 62, textAlign: "right", fontWeight: "700" },
          ]}
        >
          {display(stat.away, stat.percent)}
        </Text>
      </View>
      <View
        style={{
          height: 5,
          flexDirection: "row",
          borderRadius: 5,
          overflow: "hidden",
          backgroundColor: colors.border,
        }}
      >
        {hasBoth && (
          <>
            <View
              style={{
                width: `${(stat.home! / total) * 100}%`,
                backgroundColor: colors.blue,
              }}
            />
            <View style={{ flex: 1, backgroundColor: "#8b5cf6" }} />
          </>
        )}
      </View>
    </View>
  );
}
export function EspnMatchDetails({ match }: { match: MatchDTO }) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const state = matchState(match);
  const query = useEspnMatchDetails(match.external_match_id, state === "live");
  const { isOffline } = useConnectivity();
  const details = query.data;
  if (!details)
    return (
      <View style={s.card}>
        <Text style={s.h2}>Buteurs et statistiques</Text>
        {isOffline ? (
          <Text style={s.small}>
            Connecte-toi à Internet pour charger les détails du match.
          </Text>
        ) : query.isError ? (
          <>
            <Text style={s.small}>
              Les détails du match sont temporairement indisponibles.
            </Text>
            <Button
              title="Réessayer"
              secondary
              onPress={() => void query.refetch()}
            />
          </>
        ) : (
          <Loading />
        )}
      </View>
    );
  const noGoals = match.score.home === 0 && match.score.away === 0;
  return (
    <View style={{ gap: 18 }}>
      {(query.isError || isOffline) && (
        <Text style={s.small}>
          Détails enregistrés · Actualisation indisponible pour le moment.
        </Text>
      )}
      <View style={s.card}>
        <Text style={s.h2}>Buteurs</Text>
        {details.goals.length ? (
          details.goals.map((goal) => (
            <View
              key={goal.id}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <View
                style={{
                  minWidth: 50,
                  borderRadius: 10,
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  backgroundColor: colors.background,
                }}
              >
                <Text
                  style={[s.text, { textAlign: "center", fontWeight: "700" }]}
                >
                  {goal.minute}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.text, { fontWeight: "700" }]}>
                  ⚽ {goal.player}
                  {goal.ownGoal ? " (c.s.c.)" : goal.penalty ? " (pen.)" : ""}
                </Text>
                {!!goal.team && <Text style={s.small}>{goal.team}</Text>}
                {!!goal.assist && (
                  <Text style={s.small}>Passe décisive : {goal.assist}</Text>
                )}
              </View>
            </View>
          ))
        ) : (
          <Text style={s.small}>
            {state === "scheduled"
              ? "Les buteurs apparaîtront après le coup d’envoi."
              : details.goalsAvailable && noGoals
                ? "Aucun but marqué."
                : "Les buteurs ne sont pas encore communiqués par ESPN."}
          </Text>
        )}
      </View>
      <View style={s.card}>
        <Text style={s.h2}>Statistiques du match</Text>
        <View style={s.between}>
          <Text
            style={[
              s.small,
              { flex: 1, color: colors.blue, fontWeight: "700" },
            ]}
          >
            {match.home.name}
          </Text>
          <Text
            style={[
              s.small,
              {
                flex: 1,
                textAlign: "right",
                color: "#8b5cf6",
                fontWeight: "700",
              },
            ]}
          >
            {match.away.name}
          </Text>
        </View>
        {state !== "scheduled" && details.statistics.length ? (
          details.statistics.map((stat) => (
            <StatisticRow key={stat.key} stat={stat} match={match} />
          ))
        ) : (
          <Text style={s.small}>
            {state === "scheduled"
              ? "Les statistiques seront disponibles après le coup d’envoi."
              : "Statistiques non communiquées par ESPN."}
          </Text>
        )}
        <Text style={s.small}>
          Source : ESPN · Données consultées à{" "}
          {new Date(details.fetchedAt).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {state === "live" ? " · Actualisation chaque minute" : ""}. Les
          données manquantes sont indiquées par —.
        </Text>
      </View>
      {!!(details.referee || details.attendance) && (
        <View style={s.card}>
          <Text style={s.h2}>Informations du match</Text>
          {!!details.referee && (
            <Text style={s.text}>Arbitre : {details.referee}</Text>
          )}
          {!!details.attendance && (
            <Text style={s.text}>
              Affluence : {details.attendance.toLocaleString("fr-FR")}{" "}
              spectateurs
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
