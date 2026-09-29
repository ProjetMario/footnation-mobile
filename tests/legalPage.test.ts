import { expect, it } from "vitest";
import { legalPage } from "../src/lib/legalPage";
it.each([
  "__proto__",
  "constructor",
  "toString",
  "missing",
  "",
  undefined,
  ["legal"],
])("rejects an unknown or inherited document key: %j", (key) => {
  expect(legalPage(key)).toBeNull();
});
it("preserves existing legal aliases and selects the correct document", () => {
  expect(legalPage("privacy")).toBe(legalPage("politique-confidentialite"));
  expect(legalPage("safety")).toBe(legalPage("securite-des-mineurs"));
  expect(legalPage("privacy")).not.toBe(legalPage("legal"));
  expect(legalPage("legal")?.paragraphs.length).toBeGreaterThan(0);
});
