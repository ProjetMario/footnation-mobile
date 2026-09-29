import { expect, it } from "vitest";
import { visibleMessageReads } from "../src/lib/visibleMessageReads";
const incoming = {
  id: "one",
  sender_id: "peer",
  receiver_id: "me",
  read_at: null,
  is_blocked: false,
};
it("marks only visible incoming messages from this conversation", () => {
  const rows = [
    incoming,
    { ...incoming, id: "old" },
    { ...incoming, id: "sent", sender_id: "me", receiver_id: "peer" },
    { ...incoming, id: "other", sender_id: "other" },
  ];
  expect(
    visibleMessageReads(
      rows,
      ["one", "sent", "other"],
      "me",
      "peer",
      true,
      new Set(),
    ),
  ).toEqual(["one"]);
});
it("does not mark messages while backgrounded, unfocused or signed out", () => {
  expect(
    visibleMessageReads([incoming], ["one"], "me", "peer", false, new Set()),
  ).toEqual([]);
  expect(
    visibleMessageReads(
      [incoming],
      ["one"],
      undefined,
      "peer",
      true,
      new Set(),
    ),
  ).toEqual([]);
});
it("excludes masked, already read and successfully marked messages", () => {
  expect(
    visibleMessageReads(
      [
        incoming,
        { ...incoming, id: "read", read_at: "2026-01-01" },
        { ...incoming, id: "blocked", is_blocked: true },
      ],
      ["one", "read", "blocked"],
      "me",
      "peer",
      true,
      new Set(["one"]),
    ),
  ).toEqual([]);
});
it("deduplicates overlapping pages and ignores stale visible IDs after changing peers", () => {
  expect(
    visibleMessageReads(
      [incoming, incoming],
      ["one"],
      "me",
      "peer",
      true,
      new Set(),
    ),
  ).toEqual(["one"]);
  expect(
    visibleMessageReads([incoming], ["one"], "me", "new-peer", true, new Set()),
  ).toEqual([]);
});
