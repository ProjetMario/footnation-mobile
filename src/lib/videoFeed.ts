/** Merge two independently paginated sources without skipping the unused rows. */
export type VideoFeedCursor = { offset: number; posts: number; shorts: number };
export type DatedVideo = {
  id: string;
  created_at: string;
  origin?: "post" | "short";
};
export const initialVideoCursor: VideoFeedCursor = {
  offset: 0,
  posts: 0,
  shorts: 0,
};

export function mergeVideoPage<T extends DatedVideo>(
  posts: T[],
  shorts: T[],
  cursor: VideoFeedCursor,
  limit = 12,
) {
  const candidates = [
    ...posts.map((item) => ({ item, origin: "post" as const })),
    ...shorts.map((item) => ({ item, origin: "short" as const })),
  ].sort(
    (a, b) =>
      Date.parse(b.item.created_at) - Date.parse(a.item.created_at) ||
      a.origin.localeCompare(b.origin) ||
      a.item.id.localeCompare(b.item.id),
  );
  const selected = candidates.slice(0, limit);
  const usedPosts = selected.filter((entry) => entry.origin === "post").length;
  return {
    items: selected.map(({ item, origin }) => ({ ...item, origin })),
    next:
      candidates.length > limit
        ? {
            offset: cursor.offset + selected.length,
            posts: cursor.posts + usedPosts,
            shorts: cursor.shorts + selected.length - usedPosts,
          }
        : undefined,
  };
}

export const videoFeedKey = (item: { id: string; origin?: "post" | "short" }) =>
  `${item.origin || "short"}:${item.id}`;
