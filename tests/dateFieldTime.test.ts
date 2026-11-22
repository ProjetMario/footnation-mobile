import { expect, it } from "vitest";
import { applyDateFieldTime } from "../src/lib/dateFieldTime";

it("rejects partial typing until the whole time can be submitted", () => {
  const selectedDay = new Date(2026, 10, 20, 12, 15);
  for (const text of ["", "2", "20", "20:", "20:3"])
    expect(applyDateFieldTime(selectedDay, text)).toBeNull();
  const complete = applyDateFieldTime(selectedDay, "20:30")!;
  expect([
    complete.getFullYear(),
    complete.getMonth(),
    complete.getDate(),
  ]).toEqual([2026, 10, 20]);
  expect([complete.getHours(), complete.getMinutes()]).toEqual([20, 30]);
  expect([selectedDay.getHours(), selectedDay.getMinutes()]).toEqual([12, 15]);
});

it("rejects invalid clock times rather than silently keeping the old hour", () => {
  const selected = new Date(2026, 10, 20, 12, 15);
  for (const text of [
    "24:00",
    "20:60",
    "-1:00",
    "1:2",
    "10:999",
    "noon",
    " 12:00",
    "12:00 ",
  ])
    expect(applyDateFieldTime(selected, text)).toBeNull();
  for (const [text, hours, minutes] of [
    ["0:00", 0, 0],
    ["09:05", 9, 5],
    ["23:59", 23, 59],
  ] as const) {
    const result = applyDateFieldTime(selected, text)!;
    expect([
      result.getHours(),
      result.getMinutes(),
      result.getSeconds(),
    ]).toEqual([hours, minutes, 0]);
  }
  expect(applyDateFieldTime(new Date("invalid"), "20:30")).toBeNull();
});
