import { expect, it } from "vitest";
import { proFieldValue } from "../src/lib/proFieldValue";
import { proContent } from "../src/lib/proContent";
const field = (section: string, key: string) =>
  proContent[section].fields.find((item) => item.key === key)!;
it("preserves empty scores and zero while rejecting invalid SQL integers", () => {
  const score = field("matches", "score_home");
  expect(proFieldValue(score, " ")).toBeNull();
  expect(proFieldValue(score, "0")).toBe(0);
  for (const value of ["-1", "1.5", "1e3", "0xff", "2147483648"])
    expect(() => proFieldValue(score, value)).toThrow();
});
it("rejects calendar rollover and ambiguous match times", () => {
  const date = field("matches", "match_date");
  expect(proFieldValue(date, "2028-02-29T18:30:00+02:00")).toBe(
    "2028-02-29T16:30:00.000Z",
  );
  for (const value of [
    "2026-02-29T18:30:00Z",
    "2026-04-31T18:30:00Z",
    "2026-09-08T24:00:00Z",
    "2026-09-08T18:30:00",
  ])
    expect(() => proFieldValue(date, value)).toThrow();
  expect(proFieldValue(field("posts", "event_date"), "")).toBeNull();
});
it("validates player birthdays without calendar rollover or future dates", () => {
  const birthdate = field("players", "birthdate");
  expect(proFieldValue(birthdate, "2000-02-29")).toBe("2000-02-29");
  expect(() => proFieldValue(birthdate, "2001-02-29")).toThrow();
  expect(() =>
    proFieldValue(birthdate, `${new Date().getFullYear() + 2}-01-01`),
  ).toThrow();
});
it("normalizes public media links and refuses executable or credential URLs", () => {
  const links = field("posts", "media_urls");
  expect(
    proFieldValue(
      links,
      " example.com/photo.jpg\n\nhttps://example.com/b.jpg ",
    ),
  ).toEqual(["https://example.com/photo.jpg", "https://example.com/b.jpg"]);
  for (const value of [
    "javascript:alert(1)",
    "https://user:secret@example.com/a.jpg",
    "https://",
  ])
    expect(() => proFieldValue(links, value)).toThrow();
});
it("keeps text formatting and requires real booleans and known choices", () => {
  expect(
    proFieldValue(
      field("posts", "content"),
      "  Première ligne\nDeuxième ligne  ",
    ),
  ).toBe("  Première ligne\nDeuxième ligne  ");
  expect(() => proFieldValue(field("posts", "content"), "  ")).toThrow();
  expect(proFieldValue(field("posts", "published"), false)).toBe(false);
  expect(() => proFieldValue(field("posts", "published"), "false")).toThrow();
  expect(() => proFieldValue(field("matches", "status"), "unknown")).toThrow();
});
it("validates optional coach email addresses", () => {
  const email = field("teams", "coach_email");
  expect(proFieldValue(email, " ")).toBeNull();
  expect(proFieldValue(email, " coach@example.com ")).toBe("coach@example.com");
  expect(() => proFieldValue(email, "invalid")).toThrow();
});
