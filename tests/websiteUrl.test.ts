import { it, expect } from "vitest";
import { websiteUrl } from "../src/lib/websiteUrl";
it("opens domains without a scheme using HTTPS and preserves existing HTTP URLs", () => {
  expect(websiteUrl(" foot-nation.com ")).toBe("https://foot-nation.com/");
  expect(websiteUrl("http://example.com/club?q=1")).toBe(
    "http://example.com/club?q=1",
  );
});
it("rejects executable links, embedded credentials and malformed domains", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///tmp/test",
    "https://name:secret@example.com",
    "https://",
    "club name.fr",
    "example.com\nattack",
  ])
    expect(() => websiteUrl(value)).toThrow();
});
