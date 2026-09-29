// The dashboard deliberately has no event text, URL, IP or device identifier.
export type GrowthSnapshot = {
  version: 1;
  generated_at: string;
  measurement_started_at: string;
  sources: {
    posts: boolean;
    convocations: boolean;
    teams: boolean;
    referrals: boolean;
  };
  metrics: {
    profiles_total: number;
    signups_7d: number;
    signups_30d: number;
    active_7d: number;
    active_30d: number;
    posts_7d: number | null;
    publishers_7d: number | null;
    convocation_replies_7d: number | null;
    active_teams_7d: number | null;
    referred_signups_30d: number | null;
    referred_active_7d: number | null;
    activation_7d: { eligible: number; activated: number } | null;
  };
  daily: { date: string; signups: number; active: number | null }[];
  cohorts: {
    week: string;
    signups: number;
    d7_eligible: number;
    d7_returned: number;
    d30_eligible: number;
    d30_returned: number;
  }[];
};

export function growthPercent(numerator: number, denominator: number): string {
  if (
    !Number.isFinite(denominator) ||
    denominator <= 0 ||
    !Number.isFinite(numerator) ||
    numerator < 0 ||
    numerator > denominator
  )
    return "En observation";
  return `${Math.round((numerator / denominator) * 100)} %`;
}
export function growthCount(value: number | null): string {
  return value === null ? "Indisponible" : value.toLocaleString("fr-FR");
}

// Validate the RPC boundary so an old/partial deployment cannot silently render zeros.
export function parseGrowthSnapshot(value: unknown): GrowthSnapshot {
  const invalid = () => {
    throw new Error(
      "Les indicateurs reçus sont incomplets. Actualisez après la mise à jour du service.",
    );
  };
  if (!value || typeof value !== "object") return invalid();
  const row = value as Record<string, any>;
  if (
    row.version !== 1 ||
    !Number.isFinite(Date.parse(row.generated_at)) ||
    !Number.isFinite(Date.parse(row.measurement_started_at))
  )
    return invalid();
  if (
    !row.sources ||
    !["posts", "convocations", "teams", "referrals"].every(
      (key) => typeof row.sources[key] === "boolean",
    )
  )
    return invalid();
  const count = (v: unknown) =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  if (
    !row.metrics ||
    ![
      "profiles_total",
      "signups_7d",
      "signups_30d",
      "active_7d",
      "active_30d",
    ].every((key) => count(row.metrics[key]))
  )
    return invalid();
  if (
    ![
      "posts_7d",
      "publishers_7d",
      "convocation_replies_7d",
      "active_teams_7d",
      "referred_signups_30d",
      "referred_active_7d",
    ].every((key) => row.metrics[key] === null || count(row.metrics[key]))
  )
    return invalid();
  const activation = row.metrics.activation_7d;
  if (
    activation !== null &&
    (!activation ||
      !count(activation.eligible) ||
      !count(activation.activated) ||
      activation.activated > activation.eligible)
  )
    return invalid();
  if (
    !Array.isArray(row.daily) ||
    !row.daily.every(
      (day: any) =>
        Number.isFinite(Date.parse(day.date)) &&
        count(day.signups) &&
        (day.active === null || count(day.active)),
    )
  )
    return invalid();
  if (
    !Array.isArray(row.cohorts) ||
    !row.cohorts.every(
      (cohort: any) =>
        Number.isFinite(Date.parse(cohort.week)) &&
        [
          "signups",
          "d7_eligible",
          "d7_returned",
          "d30_eligible",
          "d30_returned",
        ].every((key) => count(cohort[key])) &&
        cohort.d7_returned <= cohort.d7_eligible &&
        cohort.d7_eligible <= cohort.signups &&
        cohort.d30_returned <= cohort.d30_eligible &&
        cohort.d30_eligible <= cohort.d7_eligible,
    )
  )
    return invalid();
  return row as GrowthSnapshot;
}

export type GrowthPlatform = "ios" | "android" | "web";
export type ActivityAttempt = {
  userId: string;
  platform: GrowthPlatform;
  now: number;
  enabled: boolean;
};
// Memory-only deduplication. Each account has its own generation, failed calls retry
// after a minute, and server uniqueness is authoritative across devices/restarts.
export function createGrowthActivityRecorder(
  record: (userId: string, platform: GrowthPlatform) => Promise<boolean>,
) {
  let account: string | null = null;
  let generation = 0;
  let completedDay: string | null = null;
  let pendingDay: string | null = null;
  let retryAfter = 0;
  return {
    reset() {
      account = null;
      generation++;
      completedDay = null;
      pendingDay = null;
      retryAfter = 0;
    },
    async attempt({
      userId,
      platform,
      now,
      enabled,
    }: ActivityAttempt): Promise<void> {
      if (!enabled) return;
      if (account !== userId) {
        account = userId;
        generation++;
        completedDay = null;
        pendingDay = null;
        retryAfter = 0;
      }
      const day = new Date(now).toISOString().slice(0, 10);
      if (completedDay === day || pendingDay || now < retryAfter) return;
      const ticket = generation;
      pendingDay = day;
      try {
        const recorded = await record(userId, platform);
        if (ticket === generation) {
          if (recorded) completedDay = day;
          else retryAfter = now + 60_000;
        }
      } catch {
        if (ticket === generation) retryAfter = now + 60_000;
      } finally {
        if (ticket === generation) pendingDay = null;
      }
    },
  };
}
