import {
  ClubButton as Button,
  useClubUIStyles as useUIStyles,
  ClubSectionHeading,
} from "./ClubDesign";
import { ClubMatchMVP } from "./ClubMatchMVP";
import {
  ClubGoalLiveRecorder,
  ClubMatchContributors,
} from "./ClubMatchContributors";
import { useState } from "react";
import { Text, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Chip, Empty, ErrorState, Loading } from "./ui";
type Match = {
  id: string;
  opponent_name: string;
  category: string;
  match_date: string;
  home_score: number | null;
  away_score: number | null;
  is_home: boolean;
  competition: string | null;
  venue: string | null;
  status: string | null;
};
export function ClubManagedMatches({ id, name }: { id: string; name: string }) {
  const s = useUIStyles();

  const [mode, setMode] = useState<"upcoming" | "past" | "all">("upcoming");
  const [votingMatch, setVotingMatch] = useState<string | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [liveStatsMatch, setLiveStatsMatch] = useState<string | null>(null);
  const [asOf, setAsOf] = useState(() => new Date().toISOString());
  const query = useInfiniteQuery({
    queryKey: ["club-public-managed-matches", id, mode, asOf],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let request = supabase
        .from("club_matches")
        .select(
          "id,opponent_name,category,match_date,home_score,away_score,is_home,competition,venue,status",
          { count: "exact" },
        )
        .eq("club_id", id);
      if (mode === "upcoming")
        request = request.or(
          `match_date.gte.${asOf},status.in.(scheduled,live)`,
        );
      if (mode === "past")
        request = request
          .lt("match_date", asOf)
          .in("status", ["finished", "cancelled", "postponed"]);
      const result = await request
        .order("match_date", { ascending: mode === "upcoming" })
        .order("id")
        .range(pageParam, pageParam + 29)
        .returns<Match[]>();
      if (result.error) throw result.error;
      return { rows: result.data, count: result.count || 0 };
    },
    getNextPageParam: (last, pages) =>
      pages.reduce((sum, page) => sum + page.rows.length, 0) < last.count
        ? pages.length * 30
        : undefined,
  });
  return (
    <>
      <ClubSectionHeading
        title="Rencontres du club"
        busy={query.isFetching}
        refresh={() => setAsOf(new Date().toISOString())}
      />
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {(
          [
            ["upcoming", "À venir / en cours"],
            ["past", "Passés"],
            ["all", "Tous"],
          ] as const
        ).map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={mode === value}
            onPress={() => setMode(value)}
          />
        ))}
      </View>
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      {!!query.data && (
        <Text style={s.small}>
          {query.data.pages[0].count} rencontre
          {query.data.pages[0].count > 1 ? "s" : ""}
        </Text>
      )}
      {query.data?.pages
        .flatMap((page) => page.rows)
        .map((match) => (
          <View key={match.id} style={s.card}>
            <Text style={s.small}>
              {[match.category, match.competition].filter(Boolean).join(" · ")}
            </Text>
            <Text style={s.h2}>
              {match.is_home ? name : match.opponent_name} –{" "}
              {match.is_home ? match.opponent_name : name}
            </Text>
            <Text style={s.subtitle}>
              {new Date(match.match_date).toLocaleString("fr-FR")}
            </Text>
            {!!match.venue && <Text style={s.text}>{match.venue}</Text>}
            {!!(match.home_score != null || match.away_score != null) && (
              <Text style={s.title}>
                {match.home_score ?? "–"} – {match.away_score ?? "–"}
              </Text>
            )}
            <Text style={s.small}>
              {(
                {
                  scheduled: "À venir",
                  live: "En cours",
                  finished: "Terminé",
                  cancelled: "Annulé",
                  postponed: "Reporté",
                } as Record<string, string>
              )[match.status || ""] ||
                match.status ||
                "Statut non renseigné"}
            </Text>
            <Text style={s.small}>
              {match.is_home ? "À domicile" : "À l’extérieur"}
            </Text>
            {!!(match.status === "live" || match.status === "scheduled") && (
              <>
                <Button
                  title={
                    liveStatsMatch === match.id
                      ? "Masquer l’ajout de but"
                      : "Ajouter un but en direct"
                  }
                  onPress={() =>
                    setLiveStatsMatch(
                      liveStatsMatch === match.id ? null : match.id,
                    )
                  }
                />
                {liveStatsMatch === match.id && (
                  <ClubGoalLiveRecorder
                    key={`live:${match.id}`}
                    matchId={match.id}
                    clubId={id}
                    category={match.category}
                  />
                )}
              </>
            )}
            {match.status === "finished" && (
              <>
                <Button
                  title={
                    votingMatch === match.id
                      ? "Masquer le vote joueur du match"
                      : "Vote joueur du match"
                  }
                  secondary
                  onPress={() =>
                    setVotingMatch(votingMatch === match.id ? null : match.id)
                  }
                />
                {votingMatch === match.id && (
                  <ClubMatchMVP matchId={match.id} clubId={id} />
                )}
                <Button
                  title={
                    expandedMatch === match.id
                      ? "Masquer les buteurs et passeurs"
                      : "Voir les buteurs et passeurs"
                  }
                  secondary
                  onPress={() =>
                    setExpandedMatch(
                      expandedMatch === match.id ? null : match.id,
                    )
                  }
                />
                {expandedMatch === match.id && (
                  <ClubMatchContributors
                    key={match.id}
                    matchId={match.id}
                    clubId={id}
                  />
                )}
              </>
            )}
          </View>
        ))}
      {!!(
        query.data && !query.data.pages.flatMap((page) => page.rows).length
      ) && (
        <Empty
          title="Aucune rencontre dans cette rubrique"
          description="Les matchs renseignés par le club apparaîtront ici."
        />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Voir les rencontres suivantes"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
