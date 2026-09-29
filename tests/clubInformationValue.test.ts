import { expect, it } from "vitest";
import { clubInformationValue as value } from "../src/lib/clubInformationValue";
it("requires a name and keeps optional clearing and multiline descriptions", () => {
  expect(() => value("name", " ")).toThrow();
  expect(value("phone", " ")).toBeNull();
  expect(value("history", "  Premier\n\nDeuxième  ")).toBe(
    "Premier\n\nDeuxième",
  );
});
it("accepts real past foundation dates and rejects impossible or future dates", () => {
  const today = new Date(2026, 8, 8);
  expect(value("founded_date", "1900-01-01", today)).toBe("1900-01-01");
  expect(() => value("founded_date", "2025-02-29", today)).toThrow();
  expect(() => value("founded_date", "2027-01-01", today)).toThrow();
});
it("normalizes websites and rejects executable or credential-bearing links", () => {
  expect(value("website", "foot-nation.com")).toBe("https://foot-nation.com/");
  expect(() => value("logo_url", "javascript:alert(1)")).toThrow();
  expect(() => value("website", "https://user:pass@example.com")).toThrow();
});
it("accepts formatted phone numbers and rejects malformed contacts", () => {
  expect(value("phone", "+33 (0)4 50 00 00 00")).toBe("+33 (0)4 50 00 00 00");
  expect(value("email", " club@example.com ")).toBe("club@example.com");
  expect(() => value("phone", "123;456")).toThrow();
  expect(() => value("email", "club@@example.com")).toThrow();
});
