import type { QueryClient } from "@tanstack/react-query";

/** Refresh every view of a managed record after either a save or a deletion. */
export function invalidateClubRecord(
  cache: QueryClient,
  clubId: string,
  section: string,
) {
  void cache.invalidateQueries({
    queryKey: ["club-admin-records", clubId, section],
  });
  const prefixes = new Set(["club-coach-kit", "club-member-rows"]);
  if (["matches", "convocations", "teams"].includes(section)) {
    prefixes.add("member-calendar");
    prefixes.add("club-native-stats");
  }
  if (section === "matches") {
    prefixes.add("club-public-managed-matches");
    prefixes.add("club-stats-match");
  }
  if (section === "convocations") prefixes.add("convocation-roster");
  if (section === "teams") {
    for (const prefix of [
      "calendar-editor-teams",
      "club-organization-teams",
      "club-invite-teams",
      "club-member-context",
    ])
      prefixes.add(prefix);
  }
  if (section === "publications" || section === "shorts")
    prefixes.add("club-public-media");
  if (section === "news") {
    prefixes.add("club-public-news");
    prefixes.add("club-public-media");
  }
  if (section === "players" || section === "staff")
    prefixes.add("club-public-roster");
  if (section === "players") {
    for (const prefix of [
      "convocation-roster",
      "attendance-player-picker",
      "club-statistics-players",
      "club-attendance-records",
      "club-attendance-summary",
      "club-native-stats",
    ])
      prefixes.add(prefix);
  }
  if (section === "palmares") prefixes.add("club-achievements");
  for (const prefix of prefixes)
    void cache.invalidateQueries({ queryKey: [prefix, clubId] });
}
