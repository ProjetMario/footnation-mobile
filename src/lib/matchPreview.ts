import { matchDataStale, type FeaturedMatch } from "./featuredMatches";
import type { MatchDTO, MatchesApiResponse } from "../types/matches";

/** A preview belongs to one match on one calendar day only. */
export const matchPreviewKey = (date: string, id: string) =>
  ["match-detail-preview", date, id] as const;

export type MatchDetailSelection = {
  match: MatchDTO;
  stale: boolean;
  fromPreview: boolean;
};

/** Prefer a refreshed result; otherwise retain the exact match already shown. */
export function selectMatchDetail({
  date,
  id,
  data,
  preview,
  offline,
  hasError,
  now,
}: {
  date: string;
  id: string;
  data?: MatchesApiResponse;
  preview?: FeaturedMatch;
  offline: boolean;
  hasError: boolean;
  now: number;
}): MatchDetailSelection | undefined {
  const match =
    data?.date === date
      ? data.matches.find((entry) => entry.external_match_id === id)
      : undefined;
  if (match && data) {
    return {
      match,
      fromPreview: false,
      stale: offline || hasError || matchDataStale(data, now),
    };
  }
  if (preview?.date !== date || preview.match.external_match_id !== id)
    return undefined;
  return {
    match: preview.match,
    fromPreview: true,
    stale:
      preview.stale ||
      offline ||
      hasError ||
      !!data ||
      matchDataStale({ source: "memory", fetched_at: preview.fetchedAt }, now),
  };
}
