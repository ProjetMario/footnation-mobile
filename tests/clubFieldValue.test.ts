import { expect, it } from "vitest";
import { clubFieldValue as parse } from "../src/lib/clubFieldValue";
import { clubSections } from "../src/lib/clubSections";
const field = (section: string, key: string) =>
  clubSections[section].fields.find((f) => f.key === key)!;
it("keeps an empty score distinct from zero and rejects SQL integer overflow", () => {
  expect(parse(field("matches", "home_score"), " ")).toBeNull();
  expect(parse(field("matches", "home_score"), "0")).toBe(0);
  expect(() => parse(field("matches", "home_score"), "2147483648")).toThrow();
  expect(() => parse(field("palmares", "year"), " ")).toThrow();
  expect(() => parse(field("palmares", "year"), "10000")).toThrow();
  expect(parse(field("palmares", "year"), "2026")).toBe(2026);
});
it("rejects impossible dates and unknown match status", () => {
  expect(() =>
    parse(field("matches", "match_date"), "2026-02-30T18:00:00Z"),
  ).toThrow();
  expect(
    parse(field("matches", "match_date"), "2026-09-08T18:00:00+02:00"),
  ).toBe("2026-09-08T16:00:00.000Z");
  expect(() => parse(field("matches", "status"), "unknown")).toThrow();
  expect(parse(field("matches", "is_home"), false)).toBe(false);
});
it("validates short links and preserves article paragraphs", () => {
  expect(() =>
    parse(field("shorts", "video_url"), "javascript:alert(1)"),
  ).toThrow();
  expect(parse(field("shorts", "video_url"), "example.com/video.mp4")).toBe(
    "https://example.com/video.mp4",
  );
  expect(parse(field("news", "content"), "Premier\n\nDeuxième")).toBe(
    "Premier\n\nDeuxième",
  );
});

it("validates player jersey numbers without converting an empty number to zero", () => {
  const field = {
    key: "jersey_number",
    label: "Maillot",
    type: "number" as const,
  };
  expect(parse(field, "")).toBeNull();
  expect(parse(field, "99")).toBe(99);
  expect(() => parse(field, "0")).toThrow();
  expect(() => parse(field, "100")).toThrow();
});
