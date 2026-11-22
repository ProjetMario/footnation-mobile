/** Partial edits are not a valid submission; retain the selected day separately. */
export function applyDateFieldTime(base: Date, value: string): Date | null {
  if (!Number.isFinite(base.getTime()) || !/^\d{1,2}:\d{2}$/.test(value))
    return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
}
