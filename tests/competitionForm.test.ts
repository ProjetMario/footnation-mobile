import { expect, it } from "vitest";
import { competitionPayload } from "../src/lib/competitionForm";
const base = {
  name: "Coupe du club",
  type: "cup",
  category: "",
  season: "2026-2027",
  level: "",
  start_date: "",
  end_date: "",
  external_url: "",
};
it("supports optional dates and future competition dates", () => {
  expect(competitionPayload(base).start_date).toBeNull();
  expect(
    competitionPayload({
      ...base,
      start_date: "2030-02-28",
      end_date: "2030-03-01",
    }).end_date,
  ).toBe("2030-03-01");
});
it("rejects impossible dates and reversed periods", () => {
  expect(() =>
    competitionPayload({ ...base, start_date: "2026-02-30" }),
  ).toThrow();
  expect(() =>
    competitionPayload({
      ...base,
      start_date: "2026-10-10",
      end_date: "2026-10-09",
    }),
  ).toThrow();
  expect(
    competitionPayload({
      ...base,
      start_date: "2028-02-29",
      end_date: "2028-02-29",
    }).start_date,
  ).toBe("2028-02-29");
});
it("requires name/type and validates the competition website", () => {
  expect(() => competitionPayload({ ...base, name: " " })).toThrow();
  expect(() => competitionPayload({ ...base, type: "unknown" })).toThrow();
  expect(() =>
    competitionPayload({ ...base, external_url: "javascript:alert(1)" }),
  ).toThrow();
  expect(
    competitionPayload({ ...base, external_url: "example.com" }).external_url,
  ).toBe("https://example.com/");
});
