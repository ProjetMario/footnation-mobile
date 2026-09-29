export type PublicationSource = "publications" | "shorts" | "news";
export type FeedRecord = {
  id: string;
  created_at: string;
  is_pinned?: boolean | null;
  source: PublicationSource;
};
export type FeedCursor<T extends FeedRecord> = {
  buffers: Record<PublicationSource, T[]>;
  offsets: Record<PublicationSource, number>;
  done: Record<PublicationSource, boolean>;
};
export function initialFeedCursor<T extends FeedRecord>(): FeedCursor<T> {
  return {
    buffers: { publications: [], shorts: [], news: [] },
    offsets: { publications: 0, shorts: 0, news: 0 },
    done: { publications: false, shorts: false, news: false },
  };
}

/** Merge independently paginated sources without skipping items between pages. */
export async function clubPublicationPage<T extends FeedRecord>(
  previous: FeedCursor<T>,
  sources: PublicationSource[],
  fetchBatch: (
    source: PublicationSource,
    offset: number,
    limit: number,
  ) => Promise<T[]>,
  size = 12,
) {
  const cursor: FeedCursor<T> = {
    buffers: {
      publications: [...previous.buffers.publications],
      shorts: [...previous.buffers.shorts],
      news: [...previous.buffers.news],
    },
    offsets: { ...previous.offsets },
    done: { ...previous.done },
  };
  const items: T[] = [];
  while (items.length < size) {
    await Promise.all(
      sources
        .filter(
          (source) => !cursor.buffers[source].length && !cursor.done[source],
        )
        .map(async (source) => {
          const rows = await fetchBatch(source, cursor.offsets[source], size);
          cursor.buffers[source] = rows;
          cursor.offsets[source] += rows.length;
          cursor.done[source] = rows.length < size;
        }),
    );
    const candidates = sources
      .map((source) => cursor.buffers[source][0])
      .filter((row): row is T => !!row);
    candidates.sort(
      (a, b) =>
        Number(!!b.is_pinned) - Number(!!a.is_pinned) ||
        b.created_at.localeCompare(a.created_at) ||
        a.source.localeCompare(b.source) ||
        a.id.localeCompare(b.id),
    );
    const next = candidates[0];
    if (!next) break;
    items.push(next);
    cursor.buffers[next.source].shift();
  }
  return {
    items,
    next: sources.some(
      (source) => cursor.buffers[source].length || !cursor.done[source],
    )
      ? cursor
      : undefined,
  };
}
