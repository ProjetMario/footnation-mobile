import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { MapPin, Shield } from "lucide-react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "../theme";
import { parseMatchDateTime } from "../lib/clubFeaturedMatch";
import { findClubLogo } from "../lib/clubLogo";
import { clubLogoIdentity, clubTeamBaseName } from "../lib/clubLogoIdentity";

import { type CalendarMatch, type MatchTeam } from "../lib/clubMatchFilters";

export type CalendarClub = {
  name: string;
  logo?: string | null;
  teamIds?: string[];
};

function MatchTeamBadge({
  team,
  club,
  showScore,
  score,
}: {
  team?: MatchTeam;
  club?: CalendarClub;
  showScore: boolean;
  score?: number | null;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState<string[]>([]);
  const name = team?.name || "Adversaire à confirmer";
  const ownTeam =
    !!club &&
    ((!!team?.id && !!club.teamIds?.includes(team.id)) ||
      (!!team?.name &&
        clubLogoIdentity(team.name) === clubLogoIdentity(club.name)));
  const primary = (ownTeam ? club?.logo : null) || team?.logo;
  const baseName = clubTeamBaseName(team?.name || "");
  const lookup = useQuery({
    queryKey: ["club-logo", baseName],
    queryFn: () => findClubLogo(baseName),
    enabled: !!baseName && (!primary || failed.includes(primary)),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });
  const uri = [primary, lookup.data].find(
    (candidate) => !!candidate && !failed.includes(candidate),
  );
  return (
    <Pressable
      disabled={!team?.id}
      accessibilityRole={team?.id ? "button" : undefined}
      accessibilityLabel={team?.id ? `Voir l’équipe ${name}` : name}
      onPress={() =>
        team?.id && router.push(`/fff-team/${encodeURIComponent(team.id)}`)
      }
      style={({ pressed }) => ({
        minWidth: 0,
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          padding: 3,
          borderRadius: 10,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {uri ? (
          <Image
            key={uri}
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
            accessibilityLabel={`Logo ${name}`}
            onError={() => setFailed((old) => [...old, uri])}
          />
        ) : (
          <Shield
            size={22}
            color="#43556A"
            accessibilityLabel={`Blason indisponible pour ${name}`}
          />
        )}
      </View>
      <Text
        style={{
          color: colors.ink,
          fontFamily: "Inter-SemiBold",
          flex: 1,
          fontSize: 14,
          lineHeight: 20,
        }}
      >
        {name}
      </Text>
      {showScore && (
        <Text
          accessibilityLabel={`Score ${name} : ${score ?? "non renseigné"}`}
          style={{
            width: 32,
            textAlign: "right",
            color: colors.ink,
            fontFamily: "Inter-Bold",
            fontSize: 20,
          }}
        >
          {score ?? "–"}
        </Text>
      )}
    </Pressable>
  );
}

export function ClubCalendarMatch({
  match,
  club,
}: {
  match: CalendarMatch;
  club?: CalendarClub;
}) {
  const { colors } = useTheme();
  const kickoff = parseMatchDateTime(match.date || "", match.time);
  const hasScore = match.homeScore != null || match.awayScore != null;
  const status =
    match.status === "finished" &&
    !hasScore &&
    kickoff &&
    kickoff.getTime() > Date.now()
      ? "scheduled"
      : match.status;
  const statusLabel =
    (
      {
        scheduled: "À venir",
        live: "En direct",
        finished: "Terminé",
        postponed: "Reporté",
        cancelled: "Annulé",
      } as Record<string, string>
    )[status || ""] || "À confirmer";
  const showScore = hasScore || status === "finished" || status === "live";
  const date =
    kickoff?.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }) || "Date à confirmer";
  const time = kickoff?.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const details = [
    ...new Set([match.competition, match.round].filter(Boolean)),
  ].join(" · ");
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 14,
        gap: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 2,
        }}
      >
        <Text
          style={{
            flex: 1,
            color: colors.muted,
            fontFamily: "Inter-Regular",
            fontSize: 12,
            lineHeight: 17,
          }}
        >
          {date}
        </Text>
        <Text
          style={{
            color: status === "live" ? colors.danger : colors.blue,
            fontFamily: "Inter-SemiBold",
            fontSize: 12,
          }}
        >
          {!showScore && status === "scheduled" && time ? time : statusLabel}
        </Text>
      </View>
      <MatchTeamBadge
        team={match.homeTeam}
        club={club}
        showScore={showScore}
        score={match.homeScore}
      />
      <MatchTeamBadge
        team={match.awayTeam}
        club={club}
        showScore={showScore}
        score={match.awayScore}
      />
      {!!details && (
        <Text
          style={{
            color: colors.muted,
            fontFamily: "Inter-Regular",
            fontSize: 11,
            lineHeight: 16,
            marginTop: 2,
          }}
        >
          {details}
        </Text>
      )}
      {!!match.venue && (
        <View
          style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}
        >
          <MapPin size={13} color={colors.muted} />
          <Text
            style={{
              flex: 1,
              color: colors.muted,
              fontFamily: "Inter-Regular",
              fontSize: 11,
              lineHeight: 16,
            }}
          >
            {match.venue}
          </Text>
        </View>
      )}
    </View>
  );
}
