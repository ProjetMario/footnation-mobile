/** Scan a bounded number of legacy pages without losing the next offset. */
export async function readLegacyConversationPage<T extends { unread_count: number }>(
  fetchPage: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  offset: number,
  unreadOnly: boolean,
  pageSize = 30,
  maxPages = 3,
): Promise<{ items: T[]; next: number | undefined }> {
  let cursor = offset;
  for (let scanned = 0; scanned < (unreadOnly ? maxPages : 1); scanned++) {
    const result = await fetchPage(cursor);
    if (result.error) throw result.error;
    if (!Array.isArray(result.data)) throw new Error("Impossible de charger les conversations.");
    const items = unreadOnly ? result.data.filter((item) => Number(item.unread_count) > 0) : result.data;
    const next = result.data.length === pageSize ? cursor + pageSize : undefined;
    if (items.length > 0 || next === undefined || !unreadOnly) return { items, next };
    cursor = next;
  }
  return { items: [], next: cursor };
}
