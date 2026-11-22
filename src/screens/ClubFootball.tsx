import { ClubCalendarMatch as MatchCard } from "../components/ClubCalendarMatch";
import {
  ClubButton as Button,
  useClubUIStyles as useUIStyles,
  ClubSectionHeading,
} from "../components/ClubDesign";
import React, { useEffect, useState } from "react";
import { calendarDate } from "../lib/calendarDate";
import { todayMatches } from "../lib/todayMatches";
import { AppState, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Banner,
  Chip,
  Empty,
  ErrorState,
  Loading,
  Screen,
} from "../components/ui";
import { ClubTeams } from "../components/ClubTeams";
import { ClubMatchCalendar } from "../components/ClubMatchCalendar";
import { useTheme } from "../theme";
import { ClubNews } from "../components/ClubNews";
import { ClubMemberRoster } from "./ClubMemberSpace";
import { fetchClubSports, fetchSportsTeam } from "../lib/fffSportData";
import { sportsCoverageMessage } from '../lib/sportProjection';
import { effectiveClubLogo } from '../lib/clubLogoPolicy.mjs';
export function ClubFootball({
  id,
  initialTab = "teams",
  contextual = false,
  clubName,
  clubLogoUrl,
}: {
  id: string;
  initialTab?: "teams" | "upcomingMatches";
  contextual?: boolean;
  clubName?: string;
  clubLogoUrl?: string | null;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();

  const [tab, setTab] = useState<"teams" | "upcomingMatches" | "pastMatches" | "today">(initialTab);
  const [day, setDay] = useState(() => calendarDate(new Date()));
  useEffect(() => {
    const update = () => setDay(calendarDate(new Date()));
    const timer = setInterval(update, 60000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  const query = useQuery({
    queryKey: ["native-club-football", id, 'sources-v2'],
    queryFn: () => fetchClubSports(id),
    staleTime: 120000,
  });
  const matches = tab === "today"
    ? todayMatches(query.data?.upcomingMatches || [], query.data?.pastMatches || [], day)
    : tab === "pastMatches" ? query.data?.pastMatches || [] : query.data?.upcomingMatches || [];
  const club = {
    name: clubName || query.data?.club?.name || "",
    logo: effectiveClubLogo({id, name:clubName, is_pro:query.data?.clubProfessional}, clubLogoUrl),
    is_pro: query.data?.clubProfessional,
    teamIds: (query.data?.teams || []).map((team: { id: string }) => team.id),
  };
  return (
    <>
      <ClubSectionHeading
        title={
          contextual
            ? initialTab === "teams"
              ? "Les équipes"
              : "Calendrier & résultats"
            : "La vie sportive du club"
        }
        busy={query.isFetching}
        refresh={() => {
          setDay(calendarDate(new Date()));
          void query.refetch();
        }}
      />
      {(!contextual || initialTab !== "teams") && (
        <View
          style={{
            flexDirection: "row",
            padding: 4,
            borderRadius: 14,
            backgroundColor: colors.accentSoft,
          }}
        >
          {[
            ["teams", "Équipes"],
            ["upcomingMatches", "À venir"],
            ["today", "Aujourd’hui"],
            ["pastMatches", "Résultats"],
          ]
            .filter(([key]) => !contextual || key !== "teams")
            .map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: tab === key }}
                aria-selected={tab === key}
                onPress={() => setTab(key as typeof tab)}
                style={{
                  flex: 1,
                  minHeight: 40,
                  paddingHorizontal: 6,
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 10,
                  backgroundColor: tab === key ? colors.surface : "transparent",
                }}
              >
                <Text
                  style={{
                    color: tab === key ? colors.blue : colors.muted,
                    fontFamily: "Inter-SemiBold",
                    fontSize: 12,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
        </View>
      )}
      <Text style={s.small}>{query.data ? `${query.data.sourceLabel} · ${query.data.season}` : 'Sources sportives officielles'}</Text>
      {!!query.data && <>
        {!!sportsCoverageMessage(query.data.status, query.data.stale) && <Text style={s.small}>{sportsCoverageMessage(query.data.status, query.data.stale)}</Text>}
        {!!query.data.checkedAt && <Text style={s.small}>Dernière vérification : {new Date(query.data.checkedAt).toLocaleString("fr-FR")}</Text>}
      </>}
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!query.data &&
        (tab === "teams" ? (
          <ClubTeams teams={query.data.teams} logoUrl={club.logo} />
        ) : (
          <ClubMatchCalendar
            key={id}
            matches={matches}
            allMatches={[
              ...(query.data.upcomingMatches || []),
              ...(query.data.pastMatches || []),
            ]}
            teams={query.data.teams || []}
            club={club}
            today={tab === "today"}
          />
        ))}
    </>
  );
}
export function TeamDetail() {
  const s = useUIStyles();

  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const [tab, setTab] = useState<"rankings" | "upcomingMatches" | "pastMatches" | "news" | "roster">("rankings");
  const query = useQuery({
    queryKey: ["native-team-football", teamId, 'sources-v2'],
    queryFn: () => fetchSportsTeam(teamId),
  });
  return (
    <Screen title="Équipe">
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data ? (
        <>
          <Banner
            eyebrow={query.data.team.category || "ÉQUIPE"}
            title={query.data.team.name}
            description={`${query.data.team.seasonLabel || query.data.season} · ${query.data.team.competition?.name || query.data.sourceLabel}`}
          />
          {!!sportsCoverageMessage(query.data.status, query.data.stale) && <Text style={s.small}>{sportsCoverageMessage(query.data.status, query.data.stale)}</Text>}
          {!!query.data.team.clubId && (
            <Button
              title="Voir le club"
              secondary
              onPress={() =>
                router.push(
                  `/club/${encodeURIComponent(query.data.team.clubId)}`,
                )
              }
            />
          )}
          <View style={[s.row, { flexWrap: "wrap" }]}>
            {[
              ["rankings", `Classements (${query.data.rankings.filter(r => r.rows.length).length})`],
              ["upcomingMatches", `Calendrier (${query.data.upcomingMatches.length})`],
              ["pastMatches", `Résultats (${query.data.pastMatches.length})`],
              ["roster", `Effectif${query.data.team.roster ? ` (${query.data.team.roster.players.length})` : ''}`],
              ["news", "Actualités"],
            ].map(([key, label]) => (
              <Chip
                key={key}
                label={label}
                selected={tab === key}
                onPress={() => setTab(key as typeof tab)}
              />
            ))}
          </View>
          <Text style={s.small}>{query.data.team.calendarComplete
            ? "Toutes les pages publiées des engagements de cette équipe ont été vérifiées."
            : "Calendrier partiel : certaines rencontres restent à vérifier."}</Text>
          {!!query.data.team.matchesFetchedAt && <Text style={s.small}>Calendrier vérifié le {new Date(query.data.team.matchesFetchedAt).toLocaleString("fr-FR")}</Text>}
          {!!query.data.team.collectionIssues.length && <Text style={s.small}>Actualisation incomplète : les dernières données vérifiées sont conservées.</Text>}
          {tab === 'roster' ? (
            query.data.team.roster ? <View style={s.card}>
              <Text style={s.text}>Effectif publié par la source officielle</Text>
              <Text style={s.small}>{query.data.team.roster.complete ? 'Effectif complet lors de la vérification.' : 'Effectif partiel : certains joueurs restent à vérifier.'}</Text>
              <Text style={s.small}>Vérifié le {new Date(query.data.team.roster.checkedAt).toLocaleString('fr-FR')}</Text>
              {query.data.team.roster.players.map(player => <View key={player.id} style={[s.row, {paddingVertical:8}]}>
                <Text style={s.text}>{player.shirtNumber == null ? '' : `${player.shirtNumber} · `}{player.name}</Text>
                {!!player.position && <Text style={s.small}>{player.position}</Text>}
              </View>)}
              <Button secondary title="Consulter la source" onPress={() => void Linking.openURL(query.data!.team.roster!.sourceUrl)} />
            </View> : !query.data.clubProfessional && query.data.team.clubId ? <ClubMemberRoster id={query.data.team.clubId} /> :
              <Empty title="Effectif officiel indisponible" description="Les joueurs apparaîtront lorsqu’une source autorisée et vérifiée sera disponible." />
          ) : tab === "news" && query.data.team.clubId ? (
            <ClubNews
              id={query.data.team.clubId}
              name={query.data.team.clubName || query.data.team.name}
              teamId={teamId}
              title="Actualités de l’équipe"
            />
          ) : tab === "rankings" ? (
            query.data.rankings.length ? [...query.data.rankings].sort((a,b) => Number(!!b.rows.length) - Number(!!a.rows.length)).map(standing => (
              <View key={standing.key} style={s.card}>
                <Text style={s.text}>{standing.name}</Text>
                <Text style={s.small}>{[standing.phase, standing.pool].filter(Boolean).join(" · ")}</Text>
                {!!standing.fetchedAt && <Text style={s.small}>Vérifié le {new Date(standing.fetchedAt).toLocaleString("fr-FR")}</Text>}
                {!standing.rows.length ? <Text style={s.small}>{standing.status === "source_unavailable" ? "Classement momentanément indisponible." : "Aucun classement publié pour cette compétition."}</Text> : <ScrollView horizontal accessibilityLabel={`Classement ${standing.name}`}>
                  <View>
                    <View style={{flexDirection:"row",paddingVertical:10}}>{["Rang","Équipe","Pts","J","G","N","P","BP","BC","Diff"].map((label,index) => <Text key={label} style={[s.small,{width:index===1?220:48,fontWeight:"700"}]}>{label}</Text>)}</View>
                    {standing.rows.map((row,index) => <View key={`${row.teamId}/${index}`} style={{flexDirection:"row",paddingVertical:10,borderTopWidth:1,borderTopColor:"#e2e8f0",backgroundColor:row.teamId===teamId?"#eff6ff":"transparent"}}>
                      {[row.rank,row.name,row.points,row.played,row.won,row.drawn,row.lost,row.goalsFor,row.goalsAgainst,row.goalDifference].map((value,cell) => <Text key={cell} style={[s.text,{width:cell===1?220:48,fontWeight:row.teamId===teamId?"700":"400"}]}>{value ?? "–"}</Text>)}
                    </View>)}
                  </View>
                </ScrollView>}
              </View>
            )) : <Empty title={query.data.team.calendarComplete ? "Aucun classement publié pour cette équipe et cette saison" : "Classements en attente de vérification"} />
          ) : tab === "upcomingMatches" || tab === "pastMatches" ? (
            query.data[tab].length ? query.data[tab].map(match => <MatchCard key={match.id} match={match} club={{name:query.data.team.clubName,teamIds:[query.data.team.id],is_pro:query.data.clubProfessional}} />) : <Empty title={query.data.team.calendarComplete ? tab === "pastMatches" ? "Aucun résultat publié pour cette équipe" : "Aucune rencontre à venir publiée pour cette équipe" : "Rencontres en attente de vérification"} />
          ) : <Empty title="Aucune donnée disponible" />}

        </>
      ) : null}
    </Screen>
  );
}
export function Ligue1Standings() {
  const s = useUIStyles();

  const query = useQuery({
    queryKey: ["native-ligue1-standings"],
    queryFn: async () => {
      const response = await fetch(
        "https://www.foot-nation.com/api/standings/ligue1",
      );
      if (!response.ok)
        throw new Error("Impossible de charger le classement Ligue 1.");
      const data = await response.json();
      if (!Array.isArray(data.standings))
        throw new Error("Le classement n’est pas disponible pour le moment.");
      return data;
    },
    staleTime: 60000,
  });
  return (
    <Screen title="Classement Ligue 1">
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <Banner
            eyebrow={query.data.season?.name || "LIGUE 1"}
            title={query.data.league?.name || "Classement Ligue 1"}
          />
          <View style={s.card}>
            {query.data.standings.map((row: any) => (
              <View key={`${row.rank}/${row.teamName}`} style={s.between}>
                <Text style={[s.text, { flex: 1 }]}>
                  {row.rank}. {row.teamName}
                </Text>
                <Text style={s.small}>
                  {row.played ?? "–"} J · {row.goalDiff ?? "–"}
                </Text>
                <Text style={[s.text, { fontWeight: "800" }]}>
                  {row.points} pts
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
