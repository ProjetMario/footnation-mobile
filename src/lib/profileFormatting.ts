export function formatAchievement(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[{[]/.test(trimmed)) {
      try {
        return formatAchievement(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (Array.isArray(value))
    return value.map(formatAchievement).filter(Boolean).join(" · ");
  if (typeof value === "object") {
    const a = value as Record<string, unknown>;
    return [
      a.title || a.name,
      a.club && `— ${a.club}`,
      [a.year, a.ageCategory || a.category].filter(Boolean).join(" · "),
    ]
      .filter(Boolean)
      .join(" ");
  }
  return String(value);
}
