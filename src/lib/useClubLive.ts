import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useMatchClock } from "./useMatches";
import { useConnectivity } from "../components/ConnectivityProvider";
import { useAuth } from "./auth";
import { resolveLiveLink } from "./liveLinkResolver";
import { findClubLogo } from "./clubLogo";
import {
  isActiveClubMatch,
  isActiveLiveStream,
  type ClubLiveStream,
  type LiveClubMatch,
} from "./clubLive";

const matchSelect =
  "id,club_id,opponent_name,opponent_logo_url,category,match_date,is_home,competition,venue,status,home_score,away_score,club:fff_clubs(id,name,logo_url)";
const streamSelect =
  "id,club_id,match_id,title,home_team,away_team,status,started_at,ended_at,expires_at,video_url,transport,broadcaster_id,broadcaster:profiles!live_streams_broadcaster_id_fkey(id,full_name,username,avatar_url)";
const pageSize = 20;

async function withVerifiedOpponentLogo(match: LiveClubMatch): Promise<LiveClubMatch> {
  return { ...match, opponent_logo_url: match.opponent_logo_url ? await findClubLogo(match.opponent_name) : null };
}

function useLiveQueryOptions() {
  const { active } = useMatchClock();
  const { isOffline } = useConnectivity();
  return {
    enabled: active && !isOffline,
    staleTime: 15_000,
    refetchInterval: active && !isOffline ? 30_000 : (false as const),
    refetchIntervalInBackground: false,
    retry: 1,
  };
}

export function useLiveClubMatches(clubId?: string) {
  const options = useLiveQueryOptions();
  return useInfiniteQuery({
    ...options,
    queryKey: ["live-club-matches", clubId || "all"],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      let query = supabase
        .from("club_matches")
        .select(matchSelect)
        .eq("status", "live");
      if (clubId) query = query.eq("club_id", clubId);
      const result = await query
        .order("match_date", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + pageSize - 1)
        .abortSignal(signal)
        .returns<LiveClubMatch[]>();
      if (result.error) throw result.error;
      return Promise.all(result.data.filter(isActiveClubMatch).map(withVerifiedOpponentLogo));
    },
    getNextPageParam: (last, pages) =>
      last.length === pageSize ? pages.length * pageSize : undefined,
  });
}

export function useLiveStreams(clubId?: string) {
  const options = useLiveQueryOptions();
  return useInfiniteQuery({
    ...options,
    queryKey: ["live-club-streams", clubId || "all"],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      let query = supabase
        .from("live_streams")
        .select(streamSelect)
        .eq("status", "live")
        .is("ended_at", null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      if (clubId) query = query.eq("club_id", clubId);
      const result = await query
        .order("started_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + pageSize - 1)
        .abortSignal(signal)
        .returns<ClubLiveStream[]>();
      if (result.error) throw result.error;
      return result.data.filter((stream) => isActiveLiveStream(stream));
    },
    getNextPageParam: (last, pages) =>
      last.length === pageSize ? pages.length * pageSize : undefined,
  });
}

export function useClubLiveMatch(id: string) {
  const options = useLiveQueryOptions();
  return useQuery({
    ...options,
    queryKey: ["live-club-match", id],
    queryFn: async ({ signal }) => {
      const result = await supabase
        .from("club_matches")
        .select(matchSelect)
        .eq("id", id)
        .abortSignal(signal)
        .maybeSingle<LiveClubMatch>();
      if (result.error) throw result.error;
      return result.data ? withVerifiedOpponentLogo(result.data) : null;
    },
  });
}

export function useClubLiveStream(id: string) {
  const options = useLiveQueryOptions();
  const { isOffline } = useConnectivity();
  return useQuery({
    ...options,
    enabled: !!id && !isOffline,
    queryKey: ["live-club-stream", id],
    queryFn: async ({ signal }) => {
      const result = await supabase
        .from("live_streams")
        .select(streamSelect)
        .eq("id", id)
        .abortSignal(signal)
        .maybeSingle<ClubLiveStream>();
      if (result.error) throw result.error;
      return result.data;
    },
  });
}

export function useLiveLink(id: unknown, explicitStream?: unknown) {
  const options = useLiveQueryOptions();
  const { isOffline } = useConnectivity();
  const uid = useAuth().session?.user.id;
  return useQuery({
    ...options,
    enabled: !isOffline,
    queryKey: ["live-link", uid, id, explicitStream],
    queryFn: ({ signal }) =>
      resolveLiveLink(id, explicitStream, {
        stream: async (streamId) => {
          const result = await supabase
            .from("live_streams")
            .select(streamSelect)
            .eq("id", streamId)
            .abortSignal(signal)
            .maybeSingle<ClubLiveStream>();
          if (result.error) throw result.error;
          return result.data;
        },
        clubStreams: async (clubId) => {
          const result = await supabase
            .from("live_streams")
            .select(streamSelect)
            .eq("club_id", clubId)
            .eq("status", "live")
            .is("ended_at", null)
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .order("started_at", { ascending: false })
            .order("id")
            .limit(20)
            .abortSignal(signal)
            .returns<ClubLiveStream[]>();
          if (result.error) throw result.error;
          return result.data;
        },
      }),
  });
}
