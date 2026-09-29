import { expect, it } from "vitest";
import { clubMessageText } from "../src/lib/clubMessageText";
it("rejects empty messages while preserving internal formatting", () => {
  expect(() => clubMessageText(" \n\t ")).toThrow();
  expect(clubMessageText("  Bonjour\n\nà tous !  ")).toBe(
    "Bonjour\n\nà tous !",
  );
});
it("enforces the same message length for sending and editing", () => {
  expect(clubMessageText("a".repeat(4000))).toHaveLength(4000);
  expect(() => clubMessageText("a".repeat(4001))).toThrow();
});
