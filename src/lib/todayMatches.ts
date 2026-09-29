import { validCalendarDate } from "./calendarDate";
export function todayMatches<
  T extends { id: string; date?: string; time?: string },
>(upcoming: T[], past: T[], day: string): T[] {
  if (!validCalendarDate(day)) return [];
  const unique = new Map<string, T>();
  for (const match of [...upcoming, ...past]) {
    if (match.date?.slice(0, 10) === day) unique.set(match.id, match);
  }
  return [...unique.values()].sort(
    (a, b) =>
      (a.time || "99:99").localeCompare(b.time || "99:99") ||
      a.id.localeCompare(b.id),
  );
}
