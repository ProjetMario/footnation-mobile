// Adjacent full-screen cards must overlap in eligibility. Thresholds above
// 50% leave both paused in the middle of a swipe; a minimum view time creates
// the same gap after the outgoing card is removed. Keep the current eligible
// card in visibleMediaId so the overlap does not cause rapid player switches.
export const FEED_MEDIA_VISIBLE_PERCENT = 45;
export const feedMediaViewability = {
  viewAreaCoveragePercentThreshold: FEED_MEDIA_VISIBLE_PERCENT,
  minimumViewTime: 0,
};

/** Keep list keys stable when offset pages overlap after a new publication. */
export function uniqueFeedItems<T extends { id: string }>(
  pages: readonly (readonly T[])[] = [],
): T[] {
  const seen = new Set<string>();
  return pages.flatMap((page) =>
    page.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }),
  );
}

export function visibleMediaId<
  T extends { id: string; video_url?: string | null },
>(
  items: readonly { item: T; isViewable?: boolean }[],
  current: string | null,
  includeSoundtracks = false,
): string | null {
  const visible = items.filter(
    ({ item, isViewable }) =>
      isViewable !== false && (includeSoundtracks || !!item.video_url),
  );
  return (
    visible.find(({ item }) => item.id === current)?.item.id ??
    visible[0]?.item.id ??
    null
  );
}

/** Repeated end-reached events must not retry failed or non-progressing pages. */
export function createPageRequestGate() {
  let running = false;
  let lastAttempt: string | null = null;
  return {
    async run(
      state: {
        key: string;
        hasNextPage: boolean;
        isFetching: boolean;
        isError: boolean;
        retry?: boolean;
      },
      fetchNextPage: () => Promise<unknown>,
    ): Promise<boolean> {
      if (
        running ||
        state.isFetching ||
        !state.hasNextPage ||
        (!state.retry && (state.isError || lastAttempt === state.key))
      )
        return false;
      running = true;
      lastAttempt = state.key;
      try {
        await fetchNextPage();
        return true;
      } catch {
        // The query owns its error state; another scroll event is not a retry.
        return false;
      } finally {
        running = false;
      }
    },
  };
}

export interface MediaPlaybackMemory {
  seconds: number;
  seekRequest: number | null;
}

export function nextMediaPosition(
  memory: MediaPlaybackMemory,
  seek: { seconds: number; play: boolean; request: number } | undefined,
  duration: number,
): { seconds: number; play: boolean; seekRequest: number | null } {
  const validSeek =
    !!seek &&
    Number.isFinite(seek.seconds) &&
    seek.seconds >= 0 &&
    Number.isSafeInteger(Math.floor(seek.seconds)) &&
    Number.isFinite(seek.request) &&
    seek.request !== memory.seekRequest;
  const requested = validSeek ? seek.seconds : memory.seconds;
  const safe = Number.isFinite(requested) && requested >= 0 ? requested : 0;
  return {
    seconds:
      Number.isFinite(duration) && duration > 0
        ? Math.min(safe, Math.max(0, duration - 0.1))
        : safe,
    play: validSeek ? seek.play : false,
    seekRequest: validSeek ? seek.request : memory.seekRequest,
  };
}
