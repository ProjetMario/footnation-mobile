import { describe, expect, it } from "vitest";
import { normalizeFeedback, type FeedbackInput } from "../src/lib/betaFeedback";

const input: FeedbackInput = {
  category: "bug",
  area: "team",
  message: "  Ma convocation ne se charge plus.  ",
  platform: "ios",
  appVersion: "1.0.0",
};
describe("private beta feedback", () => {
  it("trims text and drops metadata outside the finite contract", () => {
    const result = normalizeFeedback({
      ...input,
      token: "do-not-collect",
      url: "https://private.example",
    } as FeedbackInput);
    expect(result).toEqual({ ...input, message: input.message.trim() });
    expect(result).not.toHaveProperty("token");
    expect(result).not.toHaveProperty("url");
  });
  it.each([
    { category: "constructor" },
    { area: "__proto__" },
    { platform: "unknown" },
    { message: "    court " },
    { message: "x".repeat(2001) },
    { message: "⚽️".repeat(4) },
    { appVersion: "https://private.example/token" },
    { appVersion: "" },
  ])("rejects invalid values %j", (patch) => {
    expect(() =>
      normalizeFeedback({ ...input, ...patch } as FeedbackInput),
    ).toThrow();
  });
});
