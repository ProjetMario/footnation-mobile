/** One anonymous preview per browser tab, shared by the public site and Expo. */
export const GUEST_PREVIEW_DURATION_MS = 30_000;
export const GUEST_PREVIEW_STORAGE_KEY = "fn-guest-preview-started-at-v1";

export interface GuestPreviewStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const fallbackStarts = new WeakMap<GuestPreviewStorage, number>();
let unavailableStorageStart: number | null = null;

export function guestPreviewStorage(): GuestPreviewStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readGuestPreviewDeadline(
  storage: GuestPreviewStorage | null,
  now = Date.now(),
): number | null {
  let startedAt = storage
    ? fallbackStarts.get(storage)
    : unavailableStorageStart;
  try {
    const raw = storage?.getItem(GUEST_PREVIEW_STORAGE_KEY);
    if (raw && raw.trim()) {
      const stored = Number(raw);
      if (Number.isFinite(stored) && stored >= 0 && stored <= now)
        startedAt = stored;
    }
  } catch {
    // Browsers may refuse storage. Keep the same deadline in memory in that case.
  }
  return startedAt == null ? null : startedAt + GUEST_PREVIEW_DURATION_MS;
}

export function startGuestPreview(
  storage: GuestPreviewStorage | null,
  now = Date.now(),
): number {
  const existing = readGuestPreviewDeadline(storage, now);
  if (existing !== null) return existing;
  if (storage) fallbackStarts.set(storage, now);
  else unavailableStorageStart = now;
  try {
    storage?.setItem(GUEST_PREVIEW_STORAGE_KEY, String(now));
  } catch {
    // No storage permission is needed to view the public preview.
  }
  return now + GUEST_PREVIEW_DURATION_MS;
}

export function guestPreviewRemaining(
  deadline: number,
  now = Date.now(),
): number {
  return Math.max(0, Math.min(GUEST_PREVIEW_DURATION_MS, deadline - now));
}
