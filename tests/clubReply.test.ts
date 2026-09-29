import { expect, it } from "vitest";
import { clubReplyPreview, loadClubReplies } from "../src/lib/clubReply";
it("never exposes unavailable quoted text or media", () => {
  for (const message of [
    undefined,
    { id: "1", content: "secret", is_deleted: true },
    {
      id: "1",
      content: "secret",
      media_url: "https://example.com/private",
      is_blocked: true,
    },
  ])
    expect(clubReplyPreview(message)).toBe("Message indisponible");
  expect(clubReplyPreview({ id: "1", content: "  Bonjour  " })).toBe("Bonjour");
  expect(
    clubReplyPreview({
      id: "1",
      content: "",
      media_url: "https://example.com/image",
    }),
  ).toBe("Pièce jointe");
});
it("deduplicates references and bounds requests across long histories", async () => {
  const requests: string[][] = [];
  const ids = Array.from({ length: 121 }, (_, i) => String(i));
  const rows = await loadClubReplies([...ids, ...ids], async (batch) => {
    requests.push(batch);
    return batch.map((id) => ({ id }));
  });
  expect(requests.map((r) => r.length)).toEqual([50, 50, 21]);
  expect(new Set(rows.map((r) => r.id)).size).toBe(121);
  expect(
    await loadClubReplies([], async () => {
      throw new Error("Unexpected request");
    }),
  ).toEqual([]);
});
it("propagates a failed reference request instead of showing it as missing", async () => {
  await expect(
    loadClubReplies(["1"], async () => {
      throw new Error("Network");
    }),
  ).rejects.toThrow("Network");
});
