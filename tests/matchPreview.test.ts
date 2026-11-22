import { describe, expect, it } from "vitest";
import { matchPreviewKey, selectMatchDetail } from "../src/lib/matchPreview";
import type { FeaturedMatch } from "../src/lib/featuredMatches";
import type { MatchDTO, MatchesApiResponse } from "../src/types/matches";

const now = Date.parse("2026-11-15T18:00:00Z");
const date = "2026-11-15";
const id = "espn:fra.1:12345";
const match: MatchDTO = {
  external_match_id: id,
  tournament: { id: null, name: "Ligue 1" },
  home: { id: null, name: "Domicile" },
  away: { id: null, name: "Extérieur" },
  kickoff_at: "2026-11-15T17:00:00Z",
  status: "LIVE",
  score: { home: 1, away: 0 },
};
const preview: FeaturedMatch = {
  date,
  match,
  state: "live",
  fetchedAt: "2026-11-15T17:59:00Z",
  stale: false,
};
const response = (matches: MatchDTO[]): MatchesApiResponse => ({
  date,
  fetched_at: "2026-11-15T18:00:00Z",
  source: "espn",
  matches,
  teams: [],
  tournaments: [],
});
const select = (
  options: Partial<Parameters<typeof selectMatchDetail>[0]> = {},
) =>
  selectMatchDetail({
    date,
    id,
    preview,
    offline: false,
    hasError: false,
    now,
    ...options,
  });

describe("match detail preview", () => {
  it("shows the selected match while an update is pending", () => {
    expect(select()).toEqual({ match, stale: false, fromPreview: true });
    expect(matchPreviewKey(date, id)).not.toEqual(
      matchPreviewKey("2026-11-14", id),
    );
  });

  it("marks the preview stale when the update fails or the user is offline", () => {
    expect(select({ hasError: true })?.stale).toBe(true);
    expect(select({ offline: true })?.stale).toBe(true);
    expect(select({ now: now + 7 * 60_000 })?.stale).toBe(true);
  });

  it("prefers a refreshed result and marks a failed refresh of cached data stale", () => {
    const updated = { ...match, score: { home: 2, away: 0 } };
    expect(select({ data: response([updated]) })).toEqual({
      match: updated,
      stale: false,
      fromPreview: false,
    });
    expect(select({ data: response([updated]), hasError: true })?.stale).toBe(
      true,
    );
  });

  it("never uses a preview from another match or day", () => {
    expect(select({ id: "espn:fra.1:999" })).toBeUndefined();
    expect(select({ date: "2026-11-14" })).toBeUndefined();
  });

  it("marks an unmatched preview stale instead of claiming a verified live score", () => {
    expect(select({ data: response([]) })).toEqual({
      match,
      stale: true,
      fromPreview: true,
    });
  });
});
