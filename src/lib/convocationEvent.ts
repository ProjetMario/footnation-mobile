/** A linked convocation inherits its date from the event, not its editor. */
export function linkedConvocationEvent(
  section: string,
  record: Record<string, unknown>,
): "match" | "session" | null {
  if (section !== "convocations" || !record.id) return null;
  if (record.match_id) return "match";
  if (record.session_id) return "session";
  return null;
}
