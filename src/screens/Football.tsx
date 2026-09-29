import { MatchPrediction } from "./Predictions";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { readNewsFeed } from "../lib/newsFeed";
import { useDebounced } from "../lib/data";
import type { MatchDTO } from "../types/matches";
import {
  useMatches,
  useFeaturedMatches,
  useNationalMatches,
  useRecentFinishedFeaturedMatches,
  useUpcomingFeaturedMatches,
} from "../lib/useMatches";
import { matchState, matchDataStale } from "../lib/featuredMatches";
import { validCalendarDate } from "../lib/calendarDate";
import { CalendarDayField } from "../components/CalendarDayField";
import { EspnMatchDetails } from "../components/EspnMatchDetails";
import { ClubLiveSection } from "../components/ClubLiveSection";
import { useConnectivity } from "../components/ConnectivityProvider";
import { espnLeagueFromId } from "../lib/espnMatches";
import { isNationalMatch } from "../lib/nationalMatches";
import type { NewsTopic } from "../types/news";
import { useTheme } from "../theme";
import {
  Avatar,
  Button,
  Chip,
  Empty,
  ErrorState,
  Field,
  Loading,
  Screen,
  SearchField,
  useUIStyles,
} from "../components/ui";

type CompetitionFilter =
  | "all"
  | "amateurs"
  | "nations"
  | "top"
  | "champions"
  | "france"
  | "england"
  | "spain"
  | "italy"
  | "germany";

const competitionFilters: { id: CompetitionFilter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "amateurs", label: "Amateurs" },
  { id: "nations", label: "Nations" },
  { id: "top", label: "Grandes compétitions" },
  { id: "champions", label: "Ligue des champions" },
  { id: "france", label: "Ligue 1" },
  { id: "england", label: "Premier League" },
  { id: "spain", label: "Liga" },
  { id: "italy", label: "Serie A" },
  { id: "germany", label: "Bundesliga" },
];

function normalizeCompetition(value: unknown) {
  return typeof value === "string"
    ? value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
    : "";
}
function competitionGroup(match: MatchDTO): CompetitionFilter | null {
  if (isNationalMatch(match)) return "nations";
  const name = normalizeCompetition(
    `${match.tournament.name} ${match.tournament.slug || ""} ${match.tournament.code || ""}`,
  );
  if (name.includes("champions") || name.includes("uefa champions"))
    return "champions";
  if (name.includes("ligue 1") || name.includes("fra 1")) return "france";
  if (name.includes("premier league") || name.includes("eng 1"))
    return "england";
  if (
    name.includes("laliga") ||
    name.includes("la liga") ||
    name.includes("spanish") ||
    name.includes("esp 1")
  )
    return "spain";
  if (name.includes("serie a") || name.includes("ita 1")) return "italy";
  if (name.includes("bundesliga") || name.includes("ger 1")) return "germany";
  return null;
}
function competitionRank(match: MatchDTO) {
  const group = competitionGroup(match);
  if (group === "amateurs") return -2;
  if (group === "nations") return -1;
  if (group === "champions") return 0;
  if (group === "england") return 1;
  if (group === "spain") return 2;
  if (group === "france") return 3;
  if (group === "italy") return 4;
  if (group === "germany") return 5;
  return 20;
}
function matchKickoff(match: MatchDTO) {
  const timestamp = Date.parse(match.kickoff_at || "");
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}
function matchesForCompetition(
  matches: readonly MatchDTO[],
  filter: CompetitionFilter,
) {
  return matches.filter((match) => {
    if (filter === "amateurs") return false;
    if (filter === "all") return true;
    const group = competitionGroup(match);
    if (filter === "top") return group !== null;
    return group === filter;
  });
}
function filterAndSortMatches(
  matches: readonly MatchDTO[],
  filter: CompetitionFilter,
) {
  return [...matchesForCompetition(matches, filter)].sort((a, b) => {
    const rankDifference = competitionRank(a) - competitionRank(b);
    if (rankDifference) return rankDifference;
    const kickoffDifference = matchKickoff(a) - matchKickoff(b);
    if (kickoffDifference) return kickoffDifference;
    return a.external_match_id.localeCompare(b.external_match_id);
  });
}
function filterAndSortRecentFinishedMatches(
  matches: readonly MatchDTO[],
  filter: CompetitionFilter,
) {
  return [...matchesForCompetition(matches, filter)]
    .filter((match) => matchState(match) === "finished")
    .sort((a, b) => {
      const kickoffDifference = matchKickoff(b) - matchKickoff(a);
      if (kickoffDifference) return kickoffDifference;
      const rankDifference = competitionRank(a) - competitionRank(b);
      if (rankDifference) return rankDifference;
      return a.external_match_id.localeCompare(b.external_match_id);
    });
}
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function Score({ match, stale = false }: { match: MatchDTO; stale?: boolean }) {
  const s = useUIStyles();

  const state = matchState(match);
  const status =
    state === "finished"
      ? "Terminé"
      : state === "live"
        ? stale
          ? "Score à actualiser"
          : "En direct"
        : state === "scheduled"
          ? "À venir"
          : match.status_label ||
            match.extra?.raw_status ||
            "Statut à confirmer";
  return (
    <View style={s.card}>
      <Text style={s.small}>
        {match.tournament.name} · {status}
      </Text>
      <View style={s.between}>
        <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
          <Avatar uri={match.home.logo} name={match.home.name} />
          <Text style={[s.text, { textAlign: "center", fontWeight: "700" }]}>
            {match.home.shortName || match.home.name}
          </Text>
        </View>
        <Text style={[s.title, { fontSize: 28 }]}>
          {match.score.home ?? "–"} : {match.score.away ?? "–"}
        </Text>
        <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
          <Avatar uri={match.away.logo} name={match.away.name} />
          <Text style={[s.text, { textAlign: "center", fontWeight: "700" }]}>
            {match.away.shortName || match.away.name}
          </Text>
        </View>
      </View>
      {!!match.kickoff_at && (
        <Text style={[s.small, { textAlign: "center" }]}>
          {new Date(match.kickoff_at).toLocaleString("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      )}
    </View>
  );
}

function openMatch(match: MatchDTO, date: string) {
  router.push(
    `/match/${encodeURIComponent(match.external_match_id)}?date=${encodeURIComponent(date)}`,
  );
}
function FeaturedMatchCard({
  match,
  date,
  action = "Pronostiquer",
}: {
  match: MatchDTO;
  date: string;
  action?: string;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const state = matchState(match);
  const score =
    state === "finished" || state === "live"
      ? `${match.score.home ?? "–"} : ${match.score.away ?? "–"}`
      : "VS";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${action} ${match.home.name} contre ${match.away.name}`}
      onPress={() => openMatch(match, date)}
      style={[
        s.card,
        {
          width: 300,
          minHeight: 250,
          justifyContent: "space-between",
        },
      ]}
    >
      <Text style={s.small}>
        {match.tournament.name} ·{" "}
        {state === "finished"
          ? "Terminé récemment"
          : state === "live"
            ? "En direct"
            : isNationalMatch(match)
              ? "À venir"
              : "Gros match à venir"}
      </Text>
      <View style={s.between}>
        <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
          <Avatar uri={match.home.logo} name={match.home.name} size={58} />
          <Text
            style={[s.text, { textAlign: "center", fontWeight: "700" }]}
            numberOfLines={2}
          >
            {isNationalMatch(match)
              ? match.home.name
              : match.home.shortName || match.home.name}
          </Text>
        </View>
        <Text style={[s.title, { fontSize: 24 }]}>{score}</Text>
        <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
          <Avatar uri={match.away.logo} name={match.away.name} size={58} />
          <Text
            style={[s.text, { textAlign: "center", fontWeight: "700" }]}
            numberOfLines={2}
          >
            {isNationalMatch(match)
              ? match.away.name
              : match.away.shortName || match.away.name}
          </Text>
        </View>
      </View>
      {!!match.kickoff_at && (
        <Text style={[s.small, { textAlign: "center" }]}>
          {new Date(match.kickoff_at).toLocaleString("fr-FR", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      )}
      <View
        style={[
          s.button,
          {
            backgroundColor:
              state === "finished" ? colors.surfaceRaised : "#0064D8",
            borderWidth: state === "finished" ? 1 : 0,
            borderColor: colors.border,
          },
        ]}
      >
        <Text
          style={{
            fontFamily: "Inter-Bold",
            fontSize: 15,
            textAlign: "center",
            color: state === "finished" ? colors.ink : colors.white,
          }}
        >
          {action}
        </Text>
      </View>
    </Pressable>
  );
}
function CompetitionFilterBar({
  value,
  onChange,
}: {
  value: CompetitionFilter;
  onChange: (value: CompetitionFilter) => void;
}) {
  const s = useUIStyles();
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>Compétitions</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {competitionFilters.map((filter) => (
          <Chip
            key={filter.id}
            label={filter.label}
            selected={value === filter.id}
            onPress={() => onChange(filter.id)}
          />
        ))}
      </ScrollView>
      <Text style={s.small}>Ce filtre s’applique aussi aux gros matchs.</Text>
    </View>
  );
}
function UpcomingFeaturedMatches({
  upcoming,
  upcomingItems,
}: {
  upcoming: ReturnType<typeof useUpcomingFeaturedMatches>;
  upcomingItems: MatchDTO[];
}) {
  const s = useUIStyles();
  return (
    <View style={{ gap: 12 }}>
      <View style={s.between}>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>Gros matchs à venir</Text>
          <Text style={s.small}>
            Choisis ton vainqueur avant le coup d’envoi.
          </Text>
        </View>
        {upcoming.refreshing ? <Text style={s.small}>Mise à jour…</Text> : null}
      </View>
      {upcoming.loading ? (
        <Loading />
      ) : upcoming.unavailable ? (
        <ErrorState
          error={
            new Error("Les gros matchs sont temporairement indisponibles.")
          }
          retry={upcoming.retry}
        />
      ) : upcomingItems.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingRight: 4 }}
        >
          {upcomingItems.map((match) => (
            <FeaturedMatchCard
              key={match.external_match_id}
              match={match}
              date={
                upcoming.items.find(
                  (item) =>
                    item.match.external_match_id === match.external_match_id,
                )?.date || localDate()
              }
            />
          ))}
        </ScrollView>
      ) : (
        <Empty title="Aucun gros match à venir pour le moment" />
      )}
      {upcoming.incomplete ? (
        <Text style={s.small}>
          Certains championnats sont temporairement indisponibles.
        </Text>
      ) : null}
    </View>
  );
}

function RecentFinishedFeaturedMatches({
  competitionFilter,
}: {
  competitionFilter: CompetitionFilter;
}) {
  const s = useUIStyles();
  const recent = useRecentFinishedFeaturedMatches();
  const recentItems = useMemo(
    () =>
      filterAndSortRecentFinishedMatches(
        recent.items.map((item) => item.match),
        competitionFilter,
      ).slice(0, 10),
    [competitionFilter, recent.items],
  );
  return (
    <View style={{ gap: 12 }}>
      <View style={s.between}>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>Gros matchs terminés récemment</Text>
          <Text style={s.small}>
            Les résultats les plus récents en premier.
          </Text>
        </View>
      </View>
      {recent.loading ? (
        <Loading />
      ) : recent.unavailable ? (
        <ErrorState
          error={
            new Error(
              "Les derniers gros matchs sont temporairement indisponibles.",
            )
          }
          retry={recent.retry}
        />
      ) : recentItems.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingRight: 4 }}
        >
          {recentItems.map((match) => (
            <FeaturedMatchCard
              key={match.external_match_id}
              match={match}
              date={
                recent.items.find(
                  (item) =>
                    item.match.external_match_id === match.external_match_id,
                )?.date || localDate()
              }
              action="Voir le résultat"
            />
          ))}
        </ScrollView>
      ) : (
        <Empty title="Aucun gros match terminé récemment" />
      )}
    </View>
  );
}
function FeaturedMatchSections({
  competitionFilter,
}: {
  competitionFilter: CompetitionFilter;
}) {
  const upcoming = useUpcomingFeaturedMatches();
  const upcomingItems = useMemo(
    () =>
      filterAndSortMatches(
        upcoming.items.map((item) => item.match),
        competitionFilter,
      ),
    [competitionFilter, upcoming.items],
  );
  const recentFirst =
    !upcoming.loading && !upcoming.unavailable && upcomingItems.length === 0;
  const sections = [
    <UpcomingFeaturedMatches
      key="upcoming"
      upcoming={upcoming}
      upcomingItems={upcomingItems}
    />,
    <RecentFinishedFeaturedMatches
      key="recent"
      competitionFilter={competitionFilter}
    />,
  ];
  return <>{recentFirst ? sections.reverse() : sections}</>;
}

function LiveMatches({
  competitionFilter,
}: {
  competitionFilter: CompetitionFilter;
}) {
  const s = useUIStyles();
  // Independent of the calendar day: a game that crosses midnight stays here.
  const live = useFeaturedMatches(true, false);
  const items = matchesForCompetition(
    live.items
      .filter((item) => item.state === "live")
      .map((item) => item.match),
    competitionFilter,
  );
  if (!items.length) return null;
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.h2}>Matchs en direct</Text>
      <Text style={s.small}>
        Ouvre une rencontre pour suivre son score et les faits de jeu
        disponibles.
      </Text>
      {live.offline && (
        <Text style={s.small}>Hors connexion · derniers scores connus.</Text>
      )}
      {live.unavailable ? (
        <ErrorState
          error={
            new Error("Les scores en direct sont temporairement indisponibles.")
          }
          retry={live.retry}
        />
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {items.map((match) => {
          const entry = live.items.find(
            (item) => item.match.external_match_id === match.external_match_id,
          )!;
          return (
            <View key={match.external_match_id} style={{ gap: 6 }}>
              {entry.stale && (
                <Text style={s.small}>Dernier score connu · à actualiser</Text>
              )}
              <FeaturedMatchCard
                match={match}
                date={entry.date}
                action="Suivre le match"
              />
            </View>
          );
        })}
      </ScrollView>
      {live.incomplete && (
        <Text style={s.small}>
          Certaines compétitions sont momentanément indisponibles.
        </Text>
      )}
    </View>
  );
}

export function Matches() {
  const s = useUIStyles();

  const { source } = useLocalSearchParams<{ source?: string }>();
  const [date, setDate] = useState(localDate());
  const [competitionFilter, setCompetitionFilter] =
    useState<CompetitionFilter>("all");
  const { isOffline } = useConnectivity();
  const query = useMatches(date, source === "espn" ? "all" : undefined);
  const nations = useNationalMatches(
    date,
    competitionFilter === "all" || competitionFilter === "nations",
  );
  const calendarQuery = competitionFilter === "nations" ? nations : query;
  const amateursOnly = competitionFilter === "amateurs";
  const matches = useMemo(
    () =>
      filterAndSortMatches(
        calendarQuery.data?.matches || [],
        competitionFilter,
      ),
    [competitionFilter, calendarQuery.data?.matches],
  );
  const visibleMatches = amateursOnly ? [] : matches;
  return (
    <Screen title="Matchs" scroll={false}>
      <FlatList
        data={visibleMatches}
        keyExtractor={(m) => m.external_match_id}
        contentContainerStyle={s.content}
        ListHeaderComponent={
          <View style={{ gap: 18 }}>
            <CompetitionFilterBar
              value={competitionFilter}
              onChange={setCompetitionFilter}
            />
            {amateursOnly ? (
              <ClubLiveSection heading="Matchs amateurs en direct" />
            ) : (
              <LiveMatches competitionFilter={competitionFilter} />
            )}
            {!amateursOnly &&
              competitionFilter === "all" &&
              !!nations.data?.matches.length && (
                <View style={{ gap: 12 }}>
                  <Text style={s.h2}>Matchs des nations</Text>
                  <Text style={s.small}>
                    Sélections nationales ·{" "}
                    {new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                    })}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12 }}
                  >
                    {[...nations.data.matches]
                      .sort((a, b) => {
                        const ranks = {
                          live: 0,
                          scheduled: 1,
                          finished: 2,
                          unknown: 3,
                        };
                        return (
                          ranks[matchState(a)] - ranks[matchState(b)] ||
                          matchKickoff(a) - matchKickoff(b)
                        );
                      })
                      .slice(0, 12)
                      .map((match) => (
                        <FeaturedMatchCard
                          key={match.external_match_id}
                          match={match}
                          date={date}
                          action={
                            matchState(match) === "live"
                              ? "Suivre le match"
                              : matchState(match) === "finished"
                                ? "Voir le résultat"
                                : "Pronostiquer"
                          }
                        />
                      ))}
                  </ScrollView>
                  {nations.isError && (
                    <Text style={s.small}>
                      Derniers scores connus · actualisation indisponible.
                    </Text>
                  )}
                  {nations.data.incomplete && (
                    <Text style={s.small}>
                      Certaines compétitions internationales sont indisponibles.
                    </Text>
                  )}
                  <Button
                    title="Voir tous les matchs des nations"
                    secondary
                    onPress={() => setCompetitionFilter("nations")}
                  />
                </View>
              )}
            {!amateursOnly && competitionFilter !== "nations" && (
              <FeaturedMatchSections competitionFilter={competitionFilter} />
            )}
            {!amateursOnly && (
              <CalendarDayField
                label="Calendrier"
                value={date}
                onChange={setDate}
              />
            )}
            {!amateursOnly && source === "espn" ? (
              <Text style={s.small}>Grands championnats européens · ESPN</Text>
            ) : null}
            {!amateursOnly && !!calendarQuery.data?.incomplete && (
              <Text style={s.small}>
                Certaines compétitions sont temporairement indisponibles.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Voir le match ${item.home.name} contre ${item.away.name}`}
            onPress={() => openMatch(item, date)}
          >
            <Score
              match={item}
              stale={
                isOffline ||
                calendarQuery.isError ||
                (!!calendarQuery.data &&
                  matchDataStale(calendarQuery.data, Date.now()))
              }
            />
          </Pressable>
        )}
        refreshing={amateursOnly ? false : calendarQuery.isRefetching}
        onRefresh={() => {
          if (amateursOnly) return;
          void calendarQuery.refetch();
          if (competitionFilter === "all") void nations.refetch();
        }}
        ListEmptyComponent={
          amateursOnly ? (
            <Empty
              title="Aucun match amateur en direct"
              description="Les lives des clubs apparaîtront ici dès leur lancement."
            />
          ) : !validCalendarDate(date) ? (
            <Empty title="Saisissez une date valide au format AAAA-MM-JJ" />
          ) : isOffline && !calendarQuery.data ? (
            <Empty
              title="Hors connexion"
              description="Les matchs seront disponibles au retour du réseau."
            />
          ) : calendarQuery.isPending ? (
            <Loading />
          ) : calendarQuery.isError ? (
            <ErrorState
              error={calendarQuery.error}
              retry={() => void calendarQuery.refetch()}
            />
          ) : (
            <Empty
              title={
                competitionFilter === "all"
                  ? "Aucun match pour cette date"
                  : "Aucun match pour ce filtre"
              }
            />
          )
        }
      />
    </Screen>
  );
}
export function MatchDetail() {
  const s = useUIStyles();

  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const { isOffline } = useConnectivity();
  const espnLeague = espnLeagueFromId(id);
  const query = useMatches(date || localDate(), espnLeague);
  const match = query.data?.matches.find((m) => m.external_match_id === id);
  return (
    <Screen title="Match">
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : match ? (
        <>
          <Score
            match={match}
            stale={
              isOffline ||
              (!!query.data && matchDataStale(query.data, Date.now()))
            }
          />
          {!!espnLeague && <EspnMatchDetails match={match} />}
          <MatchPrediction match={match} />
          {espnLeague ? (
            <Text style={s.small}>
              Source : ESPN · Scores selon les mises à jour du fournisseur.
            </Text>
          ) : null}
          {!!match.venue && <Text style={s.text}>{match.venue}</Text>}
          {!!match.round && <Text style={s.subtitle}>{match.round}</Text>}
        </>
      ) : (
        <Empty title="Match introuvable pour cette date" />
      )}
    </Screen>
  );
}
const topics: [NewsTopic, string][] = [
  ["top", "À la une"],
  ["mercato", "Mercato"],
  ["ligue1", "Ligue 1"],
  ["ucl", "Ligue des champions"],
  ["feminine", "Football féminin"],
  ["world", "International"],
];
export function News() {
  const s = useUIStyles();

  const [topic, setTopic] = useState<NewsTopic>("top"),
    [search, setSearch] = useState("");
  const term = useDebounced(search);
  const query = useInfiniteQuery({
    queryKey: ["news", topic, term],
    retry: false,
    initialPageParam: 1,
    staleTime: 300_000,
    queryFn: ({ pageParam, signal }) =>
      readNewsFeed({ topic, query: term, limit: 20, page: pageParam, signal }),
    getNextPageParam: (last) =>
      last.items.length === last.limit ? last.page + 1 : undefined,
  });
  return (
    <Screen title="Actualités" scroll={false}>
      <FlatList
        data={query.data?.pages.flatMap((p) => p.items) || []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={s.content}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher une actualité"
            />
            <ScrollView
              horizontal
              contentContainerStyle={{ gap: 8 }}
              showsHorizontalScrollIndicator={false}
            >
              {topics.map(([id, label]) => (
                <Chip
                  key={id}
                  label={label}
                  selected={topic === id}
                  onPress={() => setTopic(id)}
                />
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => router.push(`/actu/${encodeURIComponent(item.id)}`)}
            style={s.card}
          >
            {!!item.imageUrl && (
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: "100%", aspectRatio: 1.7, borderRadius: 14 }}
                contentFit="cover"
              />
            )}
            <Text style={s.small}>{item.sourceName}</Text>
            <Text style={s.h2}>{item.title}</Text>
            <Text style={s.text}>{item.description}</Text>
            {!!item.publishedAt && (
              <Text style={s.small}>
                {new Date(item.publishedAt).toLocaleDateString("fr-FR")}
              </Text>
            )}
          </Pressable>
        )}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage)
            void query.fetchNextPage();
        }}
        ListEmptyComponent={
          query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : (
            <Empty title="Aucune actualité trouvée" />
          )
        }
      />
    </Screen>
  );
}
