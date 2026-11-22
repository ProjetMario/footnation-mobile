import { blockedSocialAuthors } from "./socialVisibility";

// These checks are independent. Keep both mandatory, but avoid a network
// round-trip between them before the first publication or Short can load.
export async function readFeedAccess<T>(
  userId: string,
  feedRequest: PromiseLike<T>,
  signal?: AbortSignal,
) {
  const [blocked, feed] = await Promise.all([
    blockedSocialAuthors(userId, signal),
    feedRequest,
  ]);
  return { blocked, feed };
}
