// Return paths are navigation only. Do not carry mutation or arbitrary query
// parameters through authentication.
export const clubRouteId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sections = new Set([
  "coach-kit", "team-players", "import-clubs", "attendance", "sessions",
  "competitions", "settings", "organigramme", "stats", "players", "staff",
  "chat", "teams", "convocations", "matches", "palmares", "news",
  "publications", "shorts", "infos", "about", "contact", "members", "admins",
]);

export function clubAdminReturnPath(value: string): string | null {
  const match = /^\/club-admin\/([^/?#]+)(?:\/([^/?#]+))?(?:\/([^/?#]+))?(?:\?([^#]*))?$/.exec(value);
  if (match && clubRouteId.test(match[1])) {
    const [, id, section, detail, query] = match;
    if (!section) return !detail && !query ? `/club-admin/${id}` : null;
    if (detail) {
      if (!clubRouteId.test(detail) || !["convocation", "match"].includes(section)) return null;
      if (query && !(section === "convocation" && query === "attendance=1")) return null;
      return `/club-admin/${id}/${section}/${detail}${query ? `?${query}` : ""}`;
    }
    if (!sections.has(section)) return null;
    if (query && !(section === "attendance" && /^sessionId=/.test(query) && clubRouteId.test(query.slice(10)))
      && !(section === "members" && query === "invitation=team-link")) return null;
    return `/club-admin/${id}/${section}${query ? `?${query}` : ""}`;
  }
  const alias = /^\/club\/([^/?#]+)\/admin$/.exec(value);
  return alias && clubRouteId.test(alias[1]) ? value : null;
}

/** Reconcile the small set of display-only options with a validated path. */
export function clubAdminGateReturnPath(
  pathname: string,
  params: Record<string, unknown>,
): string | null {
  const validated = clubAdminReturnPath(pathname);
  if (!validated) return null;
  const [base, existingQuery] = validated.split("?");
  let query: string | undefined;
  if (/\/convocation\//.test(base) && params.attendance !== undefined) {
    if (params.attendance !== "1") return null;
    query = "attendance=1";
  } else if (base.endsWith("/attendance") && params.sessionId !== undefined) {
    if (typeof params.sessionId !== "string" || !clubRouteId.test(params.sessionId)) return null;
    query = `sessionId=${params.sessionId}`;
  } else if (base.endsWith("/members") && params.invitation !== undefined) {
    if (params.invitation !== "team-link") return null;
    query = "invitation=team-link";
  }
  if (existingQuery && query && existingQuery !== query) return null;
  const result = `${base}${existingQuery || query ? `?${existingQuery || query}` : ""}`;
  return clubAdminReturnPath(result);
}
