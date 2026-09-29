import { describe, expect, it } from "vitest";
import {
  clubPublicationPage,
  initialFeedCursor,
  type FeedRecord,
  type PublicationSource,
} from "../src/lib/clubPublicationFeed";

describe("combined club publications", () => {
  it("keeps pinned posts first, then chronological order across uneven source pages without losing or duplicating items", async () => {
    const row = (
      source: PublicationSource,
      id: string,
      day: number,
      pinned = false,
    ): FeedRecord => ({
      source,
      id,
      created_at: `2026-09-${String(day).padStart(2, "0")}T12:00:00Z`,
      is_pinned: pinned,
    });
    const data = {
      publications: [
        row("publications", "pinned", 1, true),
        ...[26, 25, 24, 23, 22, 21].map((day) =>
          row("publications", String(day), day),
        ),
      ],
      shorts: [row("shorts", "26", 27), row("shorts", "last", 2)],
      news: [row("news", "news", 20)],
    };
    const start = initialFeedCursor<FeedRecord>();
    const fetch = async (
      source: PublicationSource,
      offset: number,
      size: number,
    ) => data[source].slice(offset, offset + size);
    const all: FeedRecord[] = [];
    let cursor: typeof start | undefined = start;
    while (cursor) {
      const page = await clubPublicationPage(
        cursor,
        ["publications", "shorts", "news"],
        fetch,
        3,
      );
      all.push(...page.items);
      cursor = page.next;
    }
    expect(all.map((row) => `${row.source}:${row.id}`)).toEqual([
      "publications:pinned",
      "shorts:26",
      "publications:26",
      "publications:25",
      "publications:24",
      "publications:23",
      "publications:22",
      "publications:21",
      "news:news",
      "shorts:last",
    ]);
    expect(start.offsets.publications).toBe(0);
  });
  it("loads only selected sources and propagates failures for retry", async () => {
    const called: PublicationSource[] = [];
    const page = await clubPublicationPage(
      initialFeedCursor(),
      ["shorts"],
      async (source) => {
        called.push(source);
        return [];
      },
    );
    expect(called).toEqual(["shorts"]);
    expect(page.items).toEqual([]);
    expect(page.next).toBeUndefined();
    await expect(
      clubPublicationPage(initialFeedCursor(), ["news"], async () => {
        throw new Error("network");
      }),
    ).rejects.toThrow("network");
  });
});
