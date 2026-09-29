export type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED";

export interface TeamInfo {
  id: string | null;
  name: string;
  shortName?: string | null;
  logo?: string | null;
}

export interface TournamentInfo {
  id: string | null;
  name: string;
  country?: string | null;
  level?: string | null;
  region?: string | null;
  slug?: string | null;
  code?: string | null;
}

export interface MatchScore {
  home: number | null;
  away: number | null;
}

export interface MatchDTO {
  external_match_id: string;
  tournament: TournamentInfo;
  home: TeamInfo;
  away: TeamInfo;
  kickoff_at: string | null;
  status: MatchStatus;
  status_label?: string | null;
  venue?: string | null;
  round?: string | null;
  group?: string | null;
  score: MatchScore;
  extra?: {
    raw_status?: string | null;
    live_minute?: string | number | null;
    status_detail?: string | null;
    aggregate_score?: string | null;
  };
}

export interface MatchesApiResponse {
  incomplete?: boolean;
  date: string;
  fetched_at: string;
  matches: MatchDTO[];
  tournaments: TournamentInfo[];
  teams: TeamInfo[];
  source: "memory" | "supabase" | "forza" | string;
}

export interface MatchCommentAuthor {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export interface MatchComment {
  id: string;
  external_match_id: string;
  user_id: string;
  content: string;
  created_at: string;
  is_deleted: boolean;
  report_count: number;
  author?: MatchCommentAuthor;
}

export interface MatchPollStats {
  total: number;
  home: number;
  draw: number;
  away: number;
  myChoice?: "HOME" | "DRAW" | "AWAY" | null;
  closes_at?: string | null;
}
