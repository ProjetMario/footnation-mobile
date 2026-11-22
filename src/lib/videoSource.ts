/** Derivatives must always refer to the current original, never an older edit. */
export interface OptimizedVideoFields {
  optimized_video_url?: string | null;
  optimized_video_source_url?: string | null;
  optimized_thumbnail_url?: string | null;
}

function playableDerivative(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password
      ? value
      : null;
  } catch {
    return null;
  }
}

export function resolveVideoSource(
  media: OptimizedVideoFields & { video_url?: string | null },
  posterUri: string | null = null,
): { uri: string; fallbackUri?: string; posterUri: string | null } {
  const original = media.video_url || "";
  const current = !!original && media.optimized_video_source_url === original;
  const optimized = current ? playableDerivative(media.optimized_video_url) : null;
  return {
    uri: optimized || original,
    fallbackUri: optimized && optimized !== original ? original : undefined,
    posterUri: (current && playableDerivative(media.optimized_thumbnail_url)) || posterUri,
  };
}
