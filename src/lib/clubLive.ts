export type LiveClub = {
  id: string;
  name: string;
  logo_url: string | null;
};

export type LiveClubMatch = {
  id: string;
  club_id: string;
  opponent_name: string;
  opponent_logo_url: string | null;
  category: string;
  match_date: string;
  is_home: boolean;
  competition: string | null;
  venue: string | null;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  club: LiveClub | null;
};

export type ClubLiveStream = {
  id: string;
  club_id: string | null;
  match_id: string;
  title: string;
  home_team: string | null;
  away_team: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string | null;
  video_url: string | null;
  broadcaster_id?: string | null;
  broadcaster?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};


const stoppedStreamStatuses = new Set([
  "ended",
  "finished",
  "stopped",
  "cancelled",
  "canceled",
  "expired",
  "archived",
]);

export function isActiveLiveStream(stream: ClubLiveStream, now = Date.now()) {
  if (stoppedStreamStatuses.has(String(stream.status || "").toLowerCase()))
    return false;
  if (stream.ended_at) return false;
  if (stream.expires_at) {
    const expiry = Date.parse(stream.expires_at);
    if (!Number.isFinite(expiry) || expiry <= now) return false;
  }
  if (stream.started_at) {
    const started = Date.parse(stream.started_at);
    // Safety net: a live left open in the database should disappear from the
    // match page instead of looking active forever.
    if (Number.isFinite(started) && now - started > 6 * 60 * 60 * 1000)
      return false;
  }
  return stream.status === "live";
}

export function isActiveClubMatch(match: LiveClubMatch) {
  return match.status === "live";
}
export function liveMatchTeams(match: LiveClubMatch) {
  const club = { name: match.club?.name || "Club", logo: match.club?.logo_url };
  const opponent = { name: match.opponent_name, logo: match.opponent_logo_url };
  return match.is_home
    ? { home: club, away: opponent }
    : { home: opponent, away: club };
}

export function clubMatchStatus(status: string | null) {
  return (
    {
      live: "En direct",
      scheduled: "À venir",
      finished: "Terminé",
      postponed: "Reporté",
      cancelled: "Annulé",
    }[status || ""] || "Statut à confirmer"
  );
}

// A live status alone is not a playable broadcast. The web recorder currently
// publishes its video URL only after upload; never invent a stream endpoint.
export function streamVideoUrl(stream: ClubLiveStream, now = Date.now()) {
  if (
    !stream.video_url ||
    (stream.status !== "live" && stream.status !== "ended")
  )
    return null;
  if (stream.expires_at) {
    const expiry = Date.parse(stream.expires_at);
    if (!Number.isFinite(expiry) || expiry <= now) return null;
  }
  try {
    const url = new URL(stream.video_url);
    return url.protocol === "https:" && !url.username && !url.password
      ? stream.video_url
      : null;
  } catch {
    return null;
  }
}

export function clubMatchPath(id: string) {
  return `/club-match/${encodeURIComponent(id)}`;
}

export function liveStreamPath(id: string) {
  return `/live/watch/${encodeURIComponent(id)}`;
}
