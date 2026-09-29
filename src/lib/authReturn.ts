import { validCalendarDate } from "./calendarDate";
/** A coach's invitation is an opaque code, never an automatically accepted action. */
export function normalizeTeamInvite(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(code) ? code : null;
}

const landingRoutes = new Set([
  "/",
  "/my-profile",
  "/my-invitations",
  "/my-convocations",
  "/member/invitations",
  "/member/teams",
  "/member/convocations",
  "/opportunities",
  "/clubs",
  "/network",
  "/messages",
  "/notifications",
  "/saved-posts",
  "/matching",
  "/search",
  "/shorts",
  "/events",
  "/feedback",
  "/admin/growth",
  "/admin/feedback",
  "/followers",
  "/profile-views",
  "/profile-qr",
  "/cv-football",
  "/career-preferences",
  "/experience",
  "/education",
  "/predictions",
  "/my-followed-clubs",
  "/club-claims",
  "/my-club-reports",
  "/club-dashboard",
  "/club-chat",
  "/pro-pages",
  "/organizations",
  "/groups",
  "/stories",
  "/live",
  "/events-dashboard",
  "/events/dashboard",
  "/account-activity",
  "/account-settings",
  "/settings",
  "/message-outbox",
  "/invite",
  "/referral",
  "/verification",
]);

/** Only known content/landing routes. No arbitrary URLs or automatic mutation parameters. */
export function authReturnPath(value: unknown): string | null {
  if (value === "/suppression-compte") return value;
  if (typeof value !== "string" || value.length > 1024) return null;
  if (landingRoutes.has(value)) return value;
  // Navigation only: the report screen resolves the content's real author and
  // still requires an explicit submission. No reason, text or send flag travels.
  if (
    /^\/report\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\?kind=(?:post|short|story)&contentId=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i.test(
      value,
    )
  )
    return value;
  const datedMatch = /^(\/match\/[^/?#]+)\?date=(\d{4}-\d{2}-\d{2})$/.exec(
    value,
  );
  if (datedMatch && validCalendarDate(datedMatch[2])) {
    const path = authReturnPath(datedMatch[1]);
    return path ? `${path}?date=${datedMatch[2]}` : null;
  }
  const shortComments = /^(\/(?:shorts|posts)\/[^/?#]+)\?comments=1$/.exec(
    value,
  );
  if (shortComments) {
    const path = authReturnPath(shortComments[1]);
    return path ? `${path}?comments=1` : null;
  }

  // Opening a thread is navigation only; sending still requires an explicit action.
  if (
    /^\/conversation\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    return value;

  if (value === "/referral?apply=1") return value;
  if (value.startsWith("/referral?apply=1&next=")) {
    try {
      const nested = decodeURIComponent(
        value.slice("/referral?apply=1&next=".length),
      );
      if (nested.startsWith("/referral")) return null;
      const destination = authReturnPath(nested);
      return destination
        ? `/referral?apply=1&next=${encodeURIComponent(destination)}`
        : null;
    } catch {
      return null;
    }
  }
  const invitation =
    /^\/(?:my-invitations|member\/invitations)\?teamInvite=([^&#]+)$/.exec(
      value,
    );
  if (invitation) {
    const code = normalizeTeamInvite(invitation[1]);
    return code ? `/member/invitations?teamInvite=${code}` : null;
  }
  const match =
    /^\/(talent|profile|club|posts|shorts|stories|opportunity|events|match|actu|groups|pages|pro-pages)\/([^/?#]+)(\/member)?$/.exec(
      value,
    );
  if (!match || (match[3] && match[1] !== "club")) return null;
  try {
    const slug = decodeURIComponent(match[2]);
    if (
      !slug.trim() ||
      slug === "." ||
      slug === ".." ||
      ["new", "create", "edit"].includes(slug) ||
      /[\\/\u0000-\u001f\u007f]/.test(slug)
    )
      return null;
    return `/${match[1]}/${encodeURIComponent(slug)}${match[3] || ""}`;
  } catch {
    return null;
  }
}

/** Preserve legacy coach links through password, Google and email confirmation. */
export function authEntryPath(params: {
  next?: unknown;
  teamInvite?: unknown;
}): string | null {
  const next = authReturnPath(params.next);
  if (next === "/suppression-compte") return next;
  const code = normalizeTeamInvite(params.teamInvite);
  return code ? `/member/invitations?teamInvite=${code}` : next;
}

export function authGateReturnPath(
  pathname: string,
  params: Record<string, unknown>,
): string | null {
  if (
    pathname.startsWith("/report/") &&
    (params.kind !== undefined || params.contentId !== undefined)
  ) {
    if (typeof params.kind !== "string" || typeof params.contentId !== "string")
      return null;
    return authReturnPath(
      `${pathname}?kind=${params.kind}&contentId=${params.contentId}`,
    );
  }
  if (pathname === "/referral" && params.apply === "1") {
    const next = authReturnPath(params.next);
    return `/referral?apply=1${next && !next.startsWith("/referral") ? `&next=${encodeURIComponent(next)}` : ""}`;
  }
  if (["/my-invitations", "/member/invitations"].includes(pathname)) {
    const code = normalizeTeamInvite(params.teamInvite);
    if (code) return `/member/invitations?teamInvite=${code}`;
  }
  if (
    pathname.startsWith("/match/") &&
    typeof params.date === "string" &&
    validCalendarDate(params.date)
  )
    return authReturnPath(`${pathname}?date=${params.date}`);
  if (
    (pathname.startsWith("/shorts/") || pathname.startsWith("/posts/")) &&
    params.comments === "1"
  )
    return authReturnPath(`${pathname}?comments=1`);
  return authReturnPath(pathname);
}

export function authCallbackPath(
  recovery: boolean,
  referral: boolean,
  value: unknown,
): string {
  const next = authReturnPath(value);
  if (recovery)
    return `/reset-password?recovery=1${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  if (next === "/suppression-compte") return next;
  if (referral)
    return `/referral?apply=1${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  return next || "/";
}
