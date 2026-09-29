/** Display recent posts relatively; use the device's time zone for exact dates. */
export function formatPublicationDate(
  createdAt: string,
  full = false,
  now = Date.now(),
): string {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) return "Date indisponible";
  if (full) {
    return `${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  }
  const minutes = Math.floor(Math.max(0, now - date.getTime()) / 60_000);
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  if (hours < 48) return "hier";
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== new Date(now).getFullYear()
      ? { year: "numeric" as const }
      : {}),
  });
}
