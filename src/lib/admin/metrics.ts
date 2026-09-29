export type MetricSeries = { period: string; value: number }[];
export function metricTrend(rows: MetricSeries) {
  const value = rows.at(-1)?.value;
  const previous = rows.at(-2)?.value;
  return {
    value: typeof value === "number" && Number.isFinite(value) ? value : null,
    percent:
      typeof value === "number" &&
      Number.isFinite(value) &&
      typeof previous === "number" &&
      Number.isFinite(previous) &&
      previous > 0
        ? ((value - previous) / previous) * 100
        : null,
  };
}
export function ratio(
  numerator: unknown,
  denominator: unknown,
  scale = 1,
): number | null {
  return typeof numerator === "number" &&
    Number.isFinite(numerator) &&
    numerator >= 0 &&
    typeof denominator === "number" &&
    Number.isFinite(denominator) &&
    denominator > 0
    ? (numerator / denominator) * scale
    : null;
}
export function weightedSessionDuration(
  rows: Record<string, unknown>[],
): number | null {
  const measured = rows.filter(
    (row) =>
      typeof row.sessions === "number" &&
      Number.isFinite(row.sessions) &&
      row.sessions > 0 &&
      typeof row.averageSessionDuration === "number" &&
      Number.isFinite(row.averageSessionDuration) &&
      row.averageSessionDuration >= 0,
  );
  return ratio(
    measured.reduce(
      (sum, row) =>
        sum + Number(row.sessions) * Number(row.averageSessionDuration),
      0,
    ),
    measured.reduce((sum, row) => sum + Number(row.sessions), 0),
  );
}
