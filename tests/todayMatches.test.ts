import { expect, it } from "vitest";
import { todayMatches } from "../src/lib/todayMatches";
import { calendarDate } from "../src/lib/calendarDate";
it("merges today's calendar and results, retaining the result for duplicate IDs", () => {
  const day = "2026-09-08";
  const pending = { id: "one", date: day, time: "18:00", status: "scheduled" };
  const result = { ...pending, status: "finished" };
  const early = { id: "two", date: day, time: "09:00", status: "scheduled" };
  expect(
    todayMatches(
      [pending, early, { ...pending, id: "old", date: "2026-09-07" }],
      [result],
      day,
    ),
  ).toEqual([early, result]);
});
it("uses a local calendar date at midnight and rejects an invalid day", () => {
  const day = calendarDate(new Date(2026, 8, 8, 0, 1));
  expect(day).toBe("2026-09-08");
  expect(todayMatches([{ id: "one", date: day }], [], day)).toHaveLength(1);
  expect(
    todayMatches([{ id: "one", date: "2026-02-30" }], [], "2026-02-30"),
  ).toEqual([]);
});
