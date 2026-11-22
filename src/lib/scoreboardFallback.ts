import type { MatchesApiResponse } from "../types/matches";

const cancelled = (error: unknown, signal?: AbortSignal) =>
  !!signal?.aborted ||
  (typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError");

const alternative = (data: MatchesApiResponse): MatchesApiResponse => ({
  ...data,
  incomplete: true,
  alternative_source: true,
});

/** Use the alternative provider only when the main calendar cannot answer. */
export async function loadEuropeanScoreboard(
  primary: () => Promise<MatchesApiResponse>,
  fallback: () => Promise<MatchesApiResponse>,
  signal?: AbortSignal,
): Promise<MatchesApiResponse> {
  let result: MatchesApiResponse;
  try {
    result = await primary();
  } catch (error) {
    if (cancelled(error, signal)) throw error;
    return alternative(await fallback());
  }
  if (!result.incomplete || result.matches.length) return result;
  try {
    const other = await fallback();
    return other.matches.length ? alternative(other) : result;
  } catch (error) {
    if (cancelled(error, signal)) throw error;
    return result;
  }
}

/** Show a same-day cached calendar immediately while its full refresh runs. */
export function cachedScoreboard(
  date: string,
  candidates: (MatchesApiResponse | undefined)[],
): MatchesApiResponse | undefined {
  const available = candidates.filter(
    (candidate): candidate is MatchesApiResponse =>
      !!candidate && candidate.date === date && candidate.matches.length > 0,
  );
  available.sort((a, b) => {
    const timestamp = (value: string) => {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return timestamp(b.fetched_at) - timestamp(a.fetched_at);
  });
  const first = available[0];
  if (!first) return undefined;
  return {
    ...first,
    incomplete: true,
    alternative_source: first.source !== "espn",
  };
}
