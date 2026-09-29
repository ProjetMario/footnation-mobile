import { feedPageIndex, feedPageOffset } from "./feedPaging";

export type HomeFeedLayout = {
  scope: string;
  firstPost: { id: string } | undefined;
  posts: readonly { id: string }[];
  hasFooter: boolean;
  introHeight: number;
  pageHeight: number;
  paged: boolean;
};

export type HomeFeedAnchor = {
  kind: "intro" | "post" | "footer";
  index: number;
  id: string | null;
  offset: number;
};

export function captureHomeFeedAnchor(
  layout: HomeFeedLayout,
  offset: number,
): HomeFeedAnchor {
  const index =
    offset <= 1 || !layout.paged
      ? -1
      : feedPageIndex(
          offset,
          layout.introHeight,
          layout.pageHeight,
          layout.posts.length + (layout.hasFooter ? 1 : 0),
        );
  const id = (index < 0 ? layout.firstPost : layout.posts[index])?.id ?? null;
  return {
    kind: id ? "post" : index < 0 ? "intro" : "footer",
    index,
    id,
    offset,
  };
}

export function restoredHomeFeedOffset(
  anchor: HomeFeedAnchor,
  previous: HomeFeedLayout,
  next: HomeFeedLayout,
): number | null {
  if (previous.scope !== next.scope || previous.paged !== next.paged) return 0;
  // Natural rows have variable heights. Never derive their positions from
  // the viewport height; changing presentation returns to the first post.
  if (!next.paged) return null;
  let index = -1;
  let footerBecamePost = false;
  if (anchor.kind === "post" && anchor.id !== next.firstPost?.id) {
    const found = next.posts.findIndex((post) => post.id === anchor.id);
    index = found >= 0 ? found : Math.min(anchor.index, next.posts.length - 1);
  } else if (anchor.kind === "footer") {
    const oldIds = new Set([
      previous.firstPost?.id,
      ...previous.posts.map((post) => post.id),
    ]);
    const tail = previous.posts.at(-1)?.id ?? previous.firstPost?.id;
    const tailIndex = tail
      ? next.posts.findIndex((post) => post.id === tail)
      : -1;
    const firstNew = next.posts.findIndex(
      (post, position) => position > tailIndex && !oldIds.has(post.id),
    );
    footerBecamePost =
      firstNew >= 0 && next.posts.length > previous.posts.length;
    index = footerBecamePost
      ? firstNew
      : next.hasFooter
        ? next.posts.length
        : next.posts.length - 1;
  }
  const resized =
    previous.pageHeight !== next.pageHeight ||
    previous.introHeight !== next.introHeight;
  // Same-page refreshes must not cancel a drag or its momentum.
  if (!resized && index === anchor.index && !footerBecamePost) return null;
  const nextStart = feedPageOffset(index, next.introHeight, next.pageHeight);
  if (resized || anchor.kind === "intro" || index < 0) return nextStart;
  const oldStart = feedPageOffset(
    anchor.index,
    previous.introHeight,
    previous.pageHeight,
  );
  return Math.max(0, anchor.offset + nextStart - oldStart);
}

/** The first publication lives in the list header, outside RN viewability. */
export function homeHeaderPostVisible({
  offset,
  viewportHeight,
  contentStart,
  contentEnd,
}: {
  offset: number;
  viewportHeight: number;
  contentStart: number;
  contentEnd: number;
}): boolean {
  if (contentEnd <= contentStart || viewportHeight <= 0) return false;
  const visible = Math.max(
    0,
    Math.min(contentEnd, offset + viewportHeight) -
      Math.max(contentStart, offset),
  );
  // Fully visible short cards qualify, as do tall cards filling the viewport.
  return (
    visible >= Math.min(contentEnd - contentStart, viewportHeight * 0.65) - 0.5
  );
}
