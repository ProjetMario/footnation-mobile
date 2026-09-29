import { expect, it } from "vitest";
import { formatHighlightTime, highlightTime } from "../src/lib/highlight";
it("accepts match and extra-time positions without hour rollover", () => {
  expect(highlightTime("125:09")).toBe(7509);
  expect(formatHighlightTime(7509.8)).toBe("125:09");
  expect(highlightTime("0:00")).toBe(0);
});
it("rejects malformed and overflowing timestamps", () => {
  for (const value of [
    "",
    "1:60",
    "-1:00",
    "1:2",
    "NaN",
    "1:00:00",
    "35791394:08",
    "999999999999999:00",
  ])
    expect(() => highlightTime(value)).toThrow();
  expect(highlightTime("35791394:07")).toBe(2147483647);
});
it("requires a highlight to precede the known end of the video", () => {
  expect(highlightTime("1:59", 120)).toBe(119);
  expect(() => highlightTime("2:00", 120)).toThrow();
  expect(() => highlightTime("3:00", 120)).toThrow();
  expect(highlightTime("2:00", 0)).toBe(120);
});
