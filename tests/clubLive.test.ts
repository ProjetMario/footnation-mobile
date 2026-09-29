import { describe, expect, it } from "vitest";
import {
  liveMatchTeams,
  streamVideoUrl,
  type LiveClubMatch,
  type ClubLiveStream,
} from "../src/lib/clubLive";
import { liveMatches } from "../src/lib/featuredMatches";
import type { MatchDTO, MatchesApiResponse } from "../src/types/matches";

const now = Date.parse("2026-09-27T00:15:00Z");
const match: MatchDTO = {
  external_match_id: "test-match",
  home: { id: "1", name: "Club local A" },
  away: { id: "2", name: "Club local B" },
  tournament: { id: "league", name: "Ligue" },
  status: "LIVE",
  kickoff_at: "2026-09-26T23:30:00Z",
  score: { home: 0, away: 1 },
};
function day(matches: MatchDTO[], fetchedAt = now): MatchesApiResponse {
  return {
    date: "2026-09-26",
    fetched_at: new Date(fetchedAt).toISOString(),
    matches,
    teams: [],
    tournaments: [],
    source: "test",
  };
}
describe("live match selection", () => {
  it("includes smaller clubs and keeps a game crossing midnight", () => {
    expect(
      liveMatches([day([match])], now).map(
        (row) => row.match.external_match_id,
      ),
    ).toEqual(["test-match"]);
  });
  it("hides the section data when no game is explicitly live", () => {
    expect(
      liveMatches(
        [
          day([
            { ...match, status: "SCHEDULED" },
            { ...match, external_match_id: "finished", status: "FINISHED" },
          ]),
        ],
        now,
      ),
    ).toEqual([]);
  });
  it("removes a finished game even if a previous reading called it live", () => {
    expect(
      liveMatches(
        [day([match], now - 60_000), day([{ ...match, status: "FINISHED" }])],
        now,
      ),
    ).toEqual([]);
  });
  it("excludes old live flags and preserves unknown scores", () => {
    expect(
      liveMatches(
        [day([{ ...match, kickoff_at: "2026-09-25T23:00:00Z" }])],
        now,
      ),
    ).toEqual([]);
    expect(
      liveMatches(
        [day([{ ...match, score: { home: null, away: null } }])],
        now,
      )[0].match.score.home,
    ).toBeNull();
  });
  it("shows every live game rather than limiting them to eight", () => {
    expect(
      liveMatches(
        [
          day(
            Array.from({ length: 12 }, (_, index) => ({
              ...match,
              external_match_id: String(index),
            })),
          ),
        ],
        now,
      ),
    ).toHaveLength(12);
  });
  it("marks cached live scores as stale", () => {
    expect(liveMatches([day([match], now - 3_600_000)], now)[0].stale).toBe(
      true,
    );
  });
});

describe("club live presentation", () => {
  const clubMatch = {
    club: { id: "club", name: "Mon club", logo_url: "club.png" },
    opponent_name: "Adversaire",
    opponent_logo_url: "opponent.png",
    is_home: true,
  } as LiveClubMatch;
  it("keeps home and away identity and logos in the correct order", () => {
    expect(liveMatchTeams(clubMatch).home).toEqual({
      name: "Mon club",
      logo: "club.png",
    });
    expect(liveMatchTeams({ ...clubMatch, is_home: false }).home).toEqual({
      name: "Adversaire",
      logo: "opponent.png",
    });
  });
  const stream = {
    status: "live",
    video_url: null,
    expires_at: null,
  } as ClubLiveStream;
  it("does not turn a recording without a URL into a playable live", () => {
    expect(streamVideoUrl(stream, now)).toBeNull();
  });
  it("accepts an available video and rejects expired, invalid and unsupported sources", () => {
    expect(
      streamVideoUrl(
        { ...stream, video_url: "https://example.com/live.m3u8" },
        now,
      ),
    ).toBe("https://example.com/live.m3u8");
    for (const value of [
      "javascript:alert(1)",
      "http://example.com/video.mp4",
      "https://user:pass@example.com/video.mp4",
      "invalid",
    ]) {
      expect(streamVideoUrl({ ...stream, video_url: value }, now)).toBeNull();
    }
    expect(
      streamVideoUrl(
        {
          ...stream,
          video_url: "https://example.com/replay.mp4",
          expires_at: new Date(now - 1).toISOString(),
        },
        now,
      ),
    ).toBeNull();
  });
});
