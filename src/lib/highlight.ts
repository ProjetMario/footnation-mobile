export const highlightTypes = [
  { value: "goal", label: "But" },
  { value: "save", label: "Arrêt" },
  { value: "action", label: "Action" },
  { value: "card", label: "Carton" },
  { value: "other", label: "Autre temps fort" },
];
export function highlightTime(value: string, duration?: number | null) {
  const match = /^(\d+):([0-5]\d)$/.exec(value.trim());
  const seconds = match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 2147483647)
    throw new Error(
      "Indiquez le temps au format minutes:secondes, par exemple 12:05.",
    );
  if (
    duration != null &&
    Number.isFinite(duration) &&
    duration > 0 &&
    seconds >= duration
  )
    throw new Error("Le temps fort doit commencer avant la fin du replay.");
  return seconds;
}
export function formatHighlightTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
