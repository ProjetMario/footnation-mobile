import { resolveVideoSource, type OptimizedVideoFields } from "./videoSource";

export type VideoGridMedia = OptimizedVideoFields & {
  video_url?: string | null;
  thumbnail_url?: string | null;
};

/** Keep profile tiles on the same current derivative as the full-screen player. */
export function videoGridSource(media: VideoGridMedia) {
  return resolveVideoSource(media, media.thumbnail_url || null);
}
