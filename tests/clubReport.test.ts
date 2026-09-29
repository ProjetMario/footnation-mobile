import { expect, it } from "vitest";
import { clubReportPayload } from "../src/lib/clubReport";
it("validates report reasons and treats optional details consistently", () => {
  expect(clubReportPayload("spam", "   ")).toEqual({
    reason: "spam",
    details: null,
  });
  expect(clubReportPayload("other", "  Explication\ncomplète  ").details).toBe(
    "Explication\ncomplète",
  );
  for (const reason of ["", "resolved", "constructor"])
    expect(() => clubReportPayload(reason, "")).toThrow();
});
it("limits details and never supplies review fields from the report form", () => {
  expect(
    clubReportPayload("harassment", "a".repeat(3000)).details,
  ).toHaveLength(3000);
  expect(() => clubReportPayload("harassment", "a".repeat(3001))).toThrow();
  expect(Object.keys(clubReportPayload("other", "test")).sort()).toEqual([
    "details",
    "reason",
  ]);
});
