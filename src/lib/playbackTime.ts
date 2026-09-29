export function playbackTime(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const seconds = Number(value);
  return Number.isSafeInteger(Math.floor(seconds)) && seconds >= 0
    ? Math.floor(seconds)
    : null;
}
export function clampedPlaybackTime(seconds: number, duration: number) {
  return Number.isFinite(duration) && duration > 0
    ? Math.min(seconds, Math.max(0, duration - 0.1))
    : seconds;
}
