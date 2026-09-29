import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { invalidateClubRecord } from "../src/lib/clubAdminCache";

it.each([
  [
    "matches",
    [
      "member-calendar",
      "club-public-managed-matches",
      "club-native-stats",
      "club-stats-match",
    ],
  ],
  ["convocations", ["member-calendar", "convocation-roster"]],
  [
    "teams",
    [
      "calendar-editor-teams",
      "club-organization-teams",
      "club-invite-teams",
      "club-member-context",
    ],
  ],
  [
    "players",
    [
      "attendance-player-picker",
      "club-attendance-summary",
      "club-statistics-players",
      "convocation-roster",
    ],
  ],
] as const)(
  "refreshes dependent %s screens after saving or deleting without touching another club",
  (section, prefixes) => {
    const cache = new QueryClient();
    const keys = [...prefixes, "club-coach-kit", "club-member-rows"];
    for (const prefix of keys) {
      cache.setQueryData([prefix, "club-a", "user"], ["old"]);
      cache.setQueryData([prefix, "club-b", "user"], ["other"]);
    }
    cache.setQueryData(
      ["club-admin-records", "club-a", section, "user"],
      ["old"],
    );
    invalidateClubRecord(cache, "club-a", section);
    for (const prefix of keys) {
      expect(
        cache.getQueryState([prefix, "club-a", "user"])?.isInvalidated,
      ).toBe(true);
      expect(
        cache.getQueryState([prefix, "club-b", "user"])?.isInvalidated,
      ).toBe(false);
    }
    expect(
      cache.getQueryState(["club-admin-records", "club-a", section, "user"])
        ?.isInvalidated,
    ).toBe(true);
    cache.clear();
  },
);
