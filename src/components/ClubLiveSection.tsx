import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Radio, ChevronRight, Video } from "lucide-react-native";
import { router } from "expo-router";
import { Button, Empty, ErrorState, Loading } from "./ui";
import { ClubLogo, useClubUIStyles } from "./ClubDesign";
import { useTheme } from "../theme";
import { useConnectivity } from "./ConnectivityProvider";
import { useLiveClubMatches, useLiveStreams } from "../lib/useClubLive";
import {
  clubMatchPath,
  clubMatchStatus,
  isActiveClubMatch,
  isActiveLiveStream,
  liveMatchTeams,
  liveStreamPath,
  streamVideoUrl,
  type LiveClubMatch,
} from "../lib/clubLive";

export function ClubLiveScore({
  match,
  stale = false,
}: {
  match: LiveClubMatch;
  stale?: boolean;
}) {
  const s = useClubUIStyles();
  const { colors } = useTheme();
  const { home, away } = liveMatchTeams(match);
  return (
    <View style={{ gap: 16 }}>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Radio
          size={16}
          color={
            match.status === "live" && !stale ? colors.danger : colors.muted
          }
        />
        <Text
          style={[
            s.small,
            {
              color:
                match.status === "live" && !stale
                  ? colors.danger
                  : colors.muted,
              fontFamily: "Inter-SemiBold",
            },
          ]}
        >
          {stale
            ? "Dernier score connu · à actualiser"
            : clubMatchStatus(match.status)}
        </Text>
      </View>
      <Text style={s.small}>
        {[match.category, match.competition].filter(Boolean).join(" · ")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
          <ClubLogo uri={home.logo} name={home.name} size={48} />
          <Text
            style={[
              s.text,
              { textAlign: "center", fontFamily: "Inter-SemiBold" },
            ]}
            numberOfLines={3}
          >
            {home.name}
          </Text>
        </View>
        <Text style={[s.title, { fontSize: 28 }]}>
          {match.home_score ?? "–"} : {match.away_score ?? "–"}
        </Text>
        <View style={{ flex: 1, alignItems: "center", gap: 8 }}>
          <ClubLogo uri={away.logo} name={away.name} size={48} />
          <Text
            style={[
              s.text,
              { textAlign: "center", fontFamily: "Inter-SemiBold" },
            ]}
            numberOfLines={3}
          >
            {away.name}
          </Text>
        </View>
      </View>
      {!!match.venue && <Text style={s.small}>{match.venue}</Text>}
    </View>
  );
}

export function ClubLiveSection({
  clubId,
  heading = "Match en direct",
  hideEmpty = false,
}: {
  clubId?: string;
  heading?: string;
  hideEmpty?: boolean;
}) {
  const s = useClubUIStyles();
  const { colors } = useTheme();
  const { isOffline } = useConnectivity();
  const matches = useLiveClubMatches(clubId);
  const streams = useLiveStreams(clubId);
  const now = Date.now();
  const rows = (matches.data?.pages.flat() || []).filter(isActiveClubMatch);
  const broadcasts = (streams.data?.pages.flat() || []).filter((stream) =>
    isActiveLiveStream(stream, now),
  );
  const pending = matches.isPending || streams.isPending;
  const refresh = () => {
    void matches.refetch();
    void streams.refetch();
  };
  if (hideEmpty && !rows.length && !broadcasts.length) return null;
  return (
    <View style={{ gap: 14 }} testID="club-live-section">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Radio size={22} color={colors.danger} />
        <Text style={[s.h2, { flex: 1 }]}>{heading}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Actualiser les directs"
          onPress={refresh}
          disabled={isOffline || matches.isFetching || streams.isFetching}
          style={{
            minHeight: 44,
            justifyContent: "center",
            paddingHorizontal: 6,
          }}
        >
          <Text style={[s.small, { color: colors.blue }]}>
            {matches.isFetching || streams.isFetching
              ? "Actualisation…"
              : "Actualiser"}
          </Text>
        </Pressable>
      </View>
      <Text style={s.small}>
        {clubId
          ? "Suivez les scores du club et ses diffusions disponibles."
          : "Retrouvez les matchs amateurs et les diffusions des clubs FootNation."}{" "}
        Mise à jour toutes les 30 secondes.
      </Text>
      {isOffline && (
        <Text style={s.small}>
          Hors connexion · les directs reprendront au retour du réseau.
        </Text>
      )}
      {pending && !isOffline && <Loading />}
      {(matches.isError || streams.isError) && (
        <ErrorState
          error={
            new Error("Une partie des directs est indisponible. Réessayez.")
          }
          retry={refresh}
        />
      )}
      {!pending &&
        !matches.isError &&
        !streams.isError &&
        !rows.length &&
        !broadcasts.length && (
          <Empty
            title="Aucun match en direct pour le moment"
            description={
              clubId
                ? "Les rencontres apparaîtront ici dès que le club les passera en direct."
                : "Les matchs des clubs apparaîtront ici dès leur passage en direct."
            }
          />
        )}
      <ScrollView
        horizontal={!clubId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12 }}
      >
        {rows.map((match) => {
          const teams = liveMatchTeams(match);
          return (
            <Pressable
              key={match.id}
              accessibilityRole="button"
              accessibilityLabel={`Suivre le match ${teams.home.name} contre ${teams.away.name}`}
              onPress={() => router.push(clubMatchPath(match.id))}
              style={[
                s.card,
                { borderRadius: 20, gap: 16 },
                !clubId && { width: 290 },
              ]}
            >
              <ClubLiveScore
                match={match}
                stale={isOffline || matches.isError}
              />
              <View
                style={[
                  s.row,
                  { justifyContent: "space-between", minHeight: 44 },
                ]}
              >
                <Text
                  style={[
                    s.text,
                    { color: colors.blue, fontFamily: "Inter-SemiBold" },
                  ]}
                >
                  Suivre le match
                </Text>
                <ChevronRight size={18} color={colors.blue} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {matches.hasNextPage && (
        <Button
          title="Voir les autres matchs en direct"
          secondary
          busy={matches.isFetchingNextPage}
          onPress={() => void matches.fetchNextPage()}
        />
      )}
      {broadcasts.map((stream) => (
        <View key={stream.id} style={[s.card, { borderRadius: 20, gap: 12 }]}>
          <View style={s.row}>
            <Video size={18} color={colors.blue} />
            <Text style={s.small}>Match amateur en direct</Text>
          </View>
          <Text style={s.h2}>{stream.title}</Text>
          <Text style={s.small}>
            {[stream.home_team, stream.away_team].filter(Boolean).join(" – ")}
          </Text>
          <Button
            title={
              streamVideoUrl(stream)
                ? "Regarder le direct"
                : "Voir le match amateur"
            }
            onPress={() => router.push(liveStreamPath(stream.id))}
          />
        </View>
      ))}
      {streams.hasNextPage && (
        <Button
          title="Voir les autres diffusions"
          secondary
          busy={streams.isFetchingNextPage}
          onPress={() => void streams.fetchNextPage()}
        />
      )}
    </View>
  );
}
