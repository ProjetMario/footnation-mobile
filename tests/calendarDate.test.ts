import { it, expect } from "vitest";
import {
  calendarDate,
  latestAllowedBirthdate,
  relativeCalendarDate,
  validBirthdate,
} from "../src/lib/calendarDate";
it("rejects calendar rollover dates and accepts leap years", () => {
  expect(validBirthdate("2024-02-29")).toBe(true);
  for (const date of [
    "2023-02-29",
    "2024-02-30",
    "2024-04-31",
    "2024-13-01",
    "2024-00-01",
    "2024-2-01",
  ])
    expect(validBirthdate(date)).toBe(false);
});
it("uses the local calendar day and rejects future birthdates", () => {
  const today = new Date(2026, 8, 8, 0, 10);
  expect(calendarDate(today)).toBe("2026-09-08");
  expect(validBirthdate("2026-09-08", today)).toBe(true);
  expect(validBirthdate("2026-09-09", today)).toBe(false);
});
it("does not roll the minimum-age cutoff into March on February 29", () => {
  expect(latestAllowedBirthdate(new Date(2024, 1, 29), 13)).toBe("2011-02-28");
  expect(latestAllowedBirthdate(new Date(2024, 1, 29), 16)).toBe("2008-02-29");
  expect(latestAllowedBirthdate(new Date(2024, 2, 1), 13)).toBe("2011-03-01");
});
it("moves one local day across Paris daylight-saving changes without skipping or repeating a date", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "Europe/Paris";
  try {
    expect(relativeCalendarDate(1, new Date("2026-03-28T23:30:00+01:00"))).toBe(
      "2026-03-29",
    );
    expect(
      relativeCalendarDate(-1, new Date("2026-03-30T00:30:00+02:00")),
    ).toBe("2026-03-29");
    expect(relativeCalendarDate(1, new Date("2026-10-25T00:30:00+02:00"))).toBe(
      "2026-10-26",
    );
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
