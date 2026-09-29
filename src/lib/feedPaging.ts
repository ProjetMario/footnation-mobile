// Bound malformed counts before allocating a native snap-offset array.
const MAX_FEED_PAGES = 100_000;
const MAX_FEED_OFFSET = Number.MAX_SAFE_INTEGER;

function validHeights(introHeight: number, pageHeight: number) {
  return (
    Number.isFinite(introHeight) &&
    introHeight >= 0 &&
    Number.isFinite(pageHeight) &&
    pageHeight > 0
  );
}

function pageCount(count: number) {
  if (!Number.isFinite(count) || count < 1 || count > MAX_FEED_PAGES) return 0;
  return Math.floor(count);
}

/** Publication indices are zero-based; a negative/invalid index means the intro. */
export function feedPageOffset(
  index: number,
  introHeight: number,
  pageHeight: number,
): number {
  if (
    !validHeights(introHeight, pageHeight) ||
    !Number.isFinite(index) ||
    index < 0
  )
    return 0;
  return Math.min(
    MAX_FEED_OFFSET,
    introHeight + Math.floor(index) * pageHeight,
  );
}

/** Intro plus publication starts only: no extra stop beyond the last post. */
export function feedSnapOffsets(
  count: number,
  introHeight: number,
  pageHeight: number,
): number[] {
  const offsets = [0];
  if (!validHeights(introHeight, pageHeight)) return offsets;
  const length = pageCount(count);
  for (let index = 0; index < length; index++) {
    const offset = feedPageOffset(index, introHeight, pageHeight);
    if (offset > offsets[offsets.length - 1]) offsets.push(offset);
  }
  return offsets;
}

/** Nearest stop; -1 is the intro or an unavailable layout. Ties go forward. */
export function feedPageIndex(
  offset: number,
  introHeight: number,
  pageHeight: number,
  count: number,
): number {
  const length = pageCount(count);
  if (
    length === 0 ||
    !Number.isFinite(offset) ||
    !validHeights(introHeight, pageHeight)
  )
    return -1;
  const position = Math.max(0, offset);
  if (position < introHeight - position) return -1;
  return Math.min(
    length - 1,
    Math.max(0, Math.round((position - introHeight) / pageHeight)),
  );
}
