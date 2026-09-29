import { expect, it } from "vitest";
import { messageLinks } from "../src/lib/messageLinks";
it("preserves the complete text while recognizing multiple web links", () => {
  const text =
    "Bonjour 👋 https://foot-nation.com/posts/id\nEt www.example.com, à bientôt !";
  const parts = messageLinks(text);
  expect(parts.map((p) => p.text).join("")).toBe(text);
  expect(parts.filter((p) => p.url).map((p) => p.url)).toEqual([
    "https://foot-nation.com/posts/id",
    "https://www.example.com/",
  ]);
});
it("keeps punctuation outside links and balanced parentheses inside URLs", () => {
  const text = "(https://example.com/wiki/Foo_(bar)).";
  const parts = messageLinks(text);
  expect(parts.find((p) => p.url)?.url).toBe(
    "https://example.com/wiki/Foo_(bar)",
  );
  expect(parts.map((p) => p.text).join("")).toBe(text);
});
it("does not turn credential URLs or unsupported schemes into links", () => {
  const text =
    "https://user:secret@example.com javascript:alert(1) file:///tmp/test";
  expect(messageLinks(text)).toEqual([{ text }]);
});
it("retains ordinary messages, empty text and malformed addresses exactly", () => {
  for (const text of [
    "",
    "Bonjour",
    "https://localhost/path et https://",
    "Rendez-vous à 18h.",
  ]) {
    expect(
      messageLinks(text)
        .map((p) => p.text)
        .join(""),
    ).toBe(text);
  }
});
