import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase, requireBackend } from "./supabase";
import { calendarDate, validCalendarDate } from "./calendarDate";
import {
  featuredMatches,
  liveMatches,
  parseMatchesResponse,
  preserveFinishedScoreboard,
} from "./featuredMatches";
import {
  fetchFeaturedScoreboard,
  fetchEspnMatchDay,
  fetchUpcomingFeaturedScoreboard,
  fetchNationalMatchDay,
} from "./espnMatches";
import { useConnectivity } from "../components/ConnectivityProvider";
import type { MatchesApiResponse } from "../types/matches";
import { fetchEspnMatchDetails } from "./espnMatchDetails";
import { isEspnMatchId } from "./espnMatches";

export function useEspnMatchDetails(id: string, live: boolean) {
  const { active } = useMatchClock();
  const { isOffline } = useConnectivity();
  return useQuery({
    queryKey: ["espn-match-details", id],
    queryFn: ({ signal }) => fetchEspnMatchDetails(id, signal),
    enabled: active && !isOffline && isEspnMatchId(id),
    staleTime: live ? 30_000 : 5 * 60_000,
    refetchInterval: active && live && !isOffline ? 60_000 : false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}

async function fetchEuropeanMatches(
  date: string,
  signal?: AbortSignal,
): Promise<MatchesApiResponse> {
  const result = await fetchFeaturedScoreboard(date, signal, 0);
  return {
    date,
    fetched_at: result.days[0]?.fetched_at || new Date().toISOString(),
    source: "espn",
    matches: result.days.flatMap((day) => day.matches),
    teams: result.days.flatMap((day) => day.teams),
    tournaments: result.days.flatMap((day) => day.tournaments),
    incomplete: result.incomplete,
  };
}

export function useMatchClock() {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive",
  );
  const [now, setNow] = useState(Date.now);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setNow(Date.now());
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      if (state === "active") setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);
  const active = focused && foreground;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [active]);
  return { now, active };
}

export async function fetchMatches(date: string, signal?: AbortSignal) {
  requireBackend();
  if (!validCalendarDate(date)) throw new Error("Date de match invalide");
  // The existing edge reads date from the URL, not a JSON request body.
  const { data, error } = await supabase.functions.invoke(
    `matches?date=${date}`,
    { method: "GET", signal, timeout: 25_000 },
  );
  if (error) throw new Error("Les scores sont temporairement indisponibles.");
  return parseMatchesResponse(data, date);
}

export function useMatches(date: string, espnLeague?: string) {
  const { active } = useMatchClock();
  return useQuery({
    queryKey: espnLeague
      ? ["espn-match-day", espnLeague, date]
      : ["matches", date],
    enabled: active && validCalendarDate(date),
    queryFn: ({ signal }) =>
      espnLeague === "all"
        ? fetchEuropeanMatches(date, signal)
        : espnLeague
          ? fetchEspnMatchDay(espnLeague, date, signal)
          : fetchMatches(date, signal),
    staleTime: 30_000,
    refetchInterval: active ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useNationalMatches(date: string, visible = true) {
  const { active } = useMatchClock();
  const { isOffline } = useConnectivity();
  return useQuery({
    queryKey: ["national-match-day", date],
    enabled: active && visible && !isOffline && validCalendarDate(date),
    queryFn: ({ signal }) => fetchNationalMatchDay(date, signal),
    staleTime: 60_000,
    retry: false,
    refetchInterval: (query) =>
      active && visible && !isOffline
        ? liveMatches(query.state.data ? [query.state.data] : [], Date.now())
            .length > 0
          ? 60_000
          : 5 * 60_000
        : false,
    refetchIntervalInBackground: false,
  });
}

export function useFeaturedMatches(visible = true, includeHistory = true) {
  const { now, active: screenActive } = useMatchClock();
  const active = screenActive && visible;
  const { isOffline } = useConnectivity();
  const today = calendarDate(new Date(now));
  const selectMatches = includeHistory ? featuredMatches : liveMatches;
  // Include yesterday for matches that cross midnight. Only this short window
  // polls; the two-week results snapshot is cached separately.
  const current = useQuery({
    queryKey: ["featured-scoreboard", today, "current"],
    enabled: active,
    queryFn: ({ signal }) => fetchFeaturedScoreboard(today, signal, 1),
    structuralSharing: preserveFinishedScoreboard,
    staleTime: 60_000,
    retry: false,
    refetchInterval: (query) =>
      active
        ? selectMatches(query.state.data?.days || [], now).some(
            (item) => item.state === "live",
          )
          ? 60_000
          : includeHistory
            ? 5 * 60_000
            : 60_000
        : false,
    refetchIntervalInBackground: false,
  });
  const currentItems = featuredMatches(current.data?.days || [], now);
  const needHistory =
    includeHistory &&
    currentItems.filter((item) => item.state !== "scheduled").length < 8;
  const historyEnabled = active && current.isSuccess && needHistory;
  const history = useQuery({
    queryKey: ["featured-scoreboard", today, "history"],
    enabled: historyEnabled,
    queryFn: ({ signal }) => fetchFeaturedScoreboard(today, signal, 14),
    structuralSharing: preserveFinishedScoreboard,
    staleTime: 30 * 60_000,
    retry: false,
  });
  const fallbackEnabled = active && current.isError;
  const fallback = useQuery({
    queryKey: ["matches", today],
    enabled: fallbackEnabled,
    queryFn: ({ signal }) => fetchMatches(today, signal),
    staleTime: 60_000,
    refetchInterval: fallbackEnabled ? 60_000 : false,
    refetchIntervalInBackground: false,
  });
  const espnItems = selectMatches(
    [
      ...(includeHistory ? history.data?.days || [] : []),
      ...(current.data?.days || []),
    ],
    now,
  );
  const fallbackItems = selectMatches(
    fallback.data ? [fallback.data] : [],
    now,
  );
  const useFallback =
    current.isError &&
    fallbackItems.length > 0 &&
    (!espnItems.length ||
      fallbackItems.some((item) => item.state === "live" && !item.stale));
  const items = (
    useFallback ? selectMatches([fallback.data!], now) : espnItems
  ).map((item) => ({
    ...item,
    stale:
      item.stale ||
      isOffline ||
      (useFallback
        ? fallback.isError
        : current.isError ||
          (item.state === "live" && !!current.data?.incomplete)),
  }));
  return {
    items,
    loading:
      !items.length &&
      (current.isPending ||
        (historyEnabled && history.isPending) ||
        (fallbackEnabled && fallback.isPending)),
    refreshing: current.isFetching || history.isFetching || fallback.isFetching,
    unavailable: current.isError && (!fallback.data || fallback.isError),
    incomplete:
      !!current.data?.incomplete ||
      !!history.data?.incomplete ||
      history.isError ||
      (current.isError && !!fallback.data),
    offline: isOffline,
    retry: () => {
      if (!active || isOffline) return;
      void current.refetch();
      if (needHistory) void history.refetch();
      if (fallbackEnabled) void fallback.refetch();
    },
  };
}

export function useUpcomingFeaturedMatches(visible = true) {
  const { now, active: screenActive } = useMatchClock();
  const active = screenActive && visible;
  const { isOffline } = useConnectivity();
  const today = calendarDate(new Date(now));
  const query = useQuery({
    queryKey: ["featured-scoreboard", today, "upcoming"],
    enabled: active && !isOffline,
    queryFn: ({ signal }) => fetchUpcomingFeaturedScoreboard(today, signal, 14),
    staleTime: 10 * 60_000,
    retry: false,
  });
  const items = featuredMatches(query.data?.days || [], now, 10)
    .filter(
      (item) =>
        item.state === "scheduled" &&
        Number.isFinite(Date.parse(item.match.kickoff_at || "")) &&
        Date.parse(item.match.kickoff_at || "") > now,
    )
    .map((item) => ({
      ...item,
      stale:
        item.stale || isOffline || query.isError || !!query.data?.incomplete,
    }));
  return {
    items,
    loading: !items.length && query.isPending,
    refreshing: query.isFetching,
    unavailable: query.isError,
    incomplete: !!query.data?.incomplete,
    offline: isOffline,
    retry: () => {
      if (!active || isOffline) return;
      void query.refetch();
    },
  };
}

export function useRecentFinishedFeaturedMatches(visible = true) {
  const { now, active: screenActive } = useMatchClock();
  const active = screenActive && visible;
  const { isOffline } = useConnectivity();
  const today = calendarDate(new Date(now));
  const query = useQuery({
    queryKey: ["featured-scoreboard", today, "recent-finished"],
    enabled: active && !isOffline,
    queryFn: ({ signal }) => fetchFeaturedScoreboard(today, signal, 14),
    structuralSharing: preserveFinishedScoreboard,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const items = featuredMatches(query.data?.days || [], now, 12)
    .filter((item) => item.state === "finished")
    .map((item) => ({
      ...item,
      stale:
        item.stale || isOffline || query.isError || !!query.data?.incomplete,
    }));
  return {
    items,
    loading: !items.length && query.isPending,
    refreshing: query.isFetching,
    unavailable: query.isError,
    incomplete: !!query.data?.incomplete,
    offline: isOffline,
    retry: () => {
      if (!active || isOffline) return;
      void query.refetch();
    },
  };
}
