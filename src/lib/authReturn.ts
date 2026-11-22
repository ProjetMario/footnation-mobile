import { validCalendarDate } from "./calendarDate";
import { liveLinkId } from "./liveLinkResolver";
import { supporterReturnPath, supporterDiscoveryPath, supporterClubSeed } from "./supporterClubLinks";
import { discussionLanguage, communityReturnLocale } from "./communityLanguage";
import { clubAdminGateReturnPath, clubAdminReturnPath } from "./clubAdminReturn";
/** A coach's invitation is an opaque code, never an automatically accepted action. */
export function normalizeTeamInvite(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(code) ? code : null;
}

const landingRoutes = new Set([
  "/",
  "/home",
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
  "/supporters",
  "/discussions",
  "/discussions/moderation",
  "/supporters/new",
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
const creationRoutes = new Set([
  "/compose",
  "/shorts/create",
  "/stories/create",
]);

/** Only known content/landing routes. No arbitrary URLs or automatic mutation parameters. */
export function authReturnPath(value: unknown): string | null {
  if (value === "/suppression-compte") return value;
  if (typeof value !== "string" || value.length > 1024) return null;
  // Shared website links may already include the Expo Web mount. Router
  // destinations remain mount-relative on web and native alike.
  if (value === "/app") return "/home";
  if (value.startsWith("/app/")) return authReturnPath(value.slice(4));
  const clubAdmin = clubAdminReturnPath(value);
  if (clubAdmin) return clubAdmin;
  if (landingRoutes.has(value)) return value;
  const community = value.match(/^(\/club\/[a-z0-9][a-z0-9-]{0,200}\/discussions(?:\/(?:new|[0-9a-f-]{36}))?)\?communityLocale=([^&?#]+)$/i);
  if (community && discussionLanguage(community[2]) && authReturnPath(community[1])) return communityReturnLocale(community[1], community[2]);
  if (/^\/club\/[a-z0-9][a-z0-9-]{0,200}\/discussions(?:\/(?:new|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))?$/i.test(value)) return value;
  // Return to the admin user's read-only detail after sign-in. No operation,
  // reason, confirmation, or mutation flag is carried across authentication.
  if (
    /^\/admin\/user\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\?tab=admin$/i.test(value)
  )
    return value;
  const supporterDestination = supporterReturnPath(value);
  if (supporterDestination) return supporterDestination;
  // Invitations open a public group. Joining or RSVP always requires another tap.
  if (
    /^\/supporters\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    return value;
  // Return to preparation only. Camera capture and going live require explicit taps.
  if (/^\/live\/create\?mode=(?:simple|match)$/.test(value)) return value;
  if (
    /^\/live\/create\?mode=match&clubId=[0-9a-f-]+$/i.test(value) &&
    liveLinkId(value.split("clubId=")[1])
  )
    return value;
  if (
    /^\/live\/(?:watch|legacy|replay|broadcast)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    return value;
  if (
    /^\/live\/(?:watch|legacy)\/[0-9a-f-]+\?stream=[0-9a-f-]+$/i.test(value)
  ) {
    const [pathname, query] = value.split("?");
    if (liveLinkId(pathname.split("/").at(-1)) && liveLinkId(query.slice(7)))
      return value;
  }
  // Resume only a saved draft. Publishing still needs an explicit editor action.
  if (
    /^\/(?:compose|shorts\/create|stories\/create)\?draft=[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      value,
    )
  )
    return value;
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
  redirect?: unknown;
  returnTo?: unknown;
  teamInvite?: unknown;
}): string | null {
  const next = authReturnPath(
    params.next ?? params.redirect ?? params.returnTo,
  );
  if (next === "/suppression-compte") return next;
  const code = normalizeTeamInvite(params.teamInvite);
  return code ? `/member/invitations?teamInvite=${code}` : next;
}

export function authGateReturnPath(
  pathname: string,
  params: Record<string, unknown>,
): string | null {
  if (clubAdminReturnPath(pathname)) {
    return clubAdminGateReturnPath(pathname, params);
  }
  if (/^\/club\/[^/]+\/discussions(?:\/[^/]+)?$/.test(pathname) && params.communityLocale !== undefined)
    return authReturnPath(communityReturnLocale(pathname, params.communityLocale));
  if (pathname === "/supporters" || pathname === "/supporters/new")
    return supporterDiscoveryPath(supporterClubSeed(params), pathname === "/supporters/new");
  if (pathname === "/live/create") {
    const club = liveLinkId(params.clubId);
    return typeof params.mode === "string"
      ? authReturnPath(
          `${pathname}?mode=${params.mode}${params.mode === "match" && club ? `&clubId=${club}` : ""}`,
        )
      : "/live";
  }
  if (
    /^\/live\/(?:watch|legacy)\//.test(pathname) &&
    params.stream !== undefined
  )
    return typeof params.stream === "string"
      ? authReturnPath(`${pathname}?stream=${params.stream}`)
      : null;
  if (creationRoutes.has(pathname))
    return typeof params.draft === "string"
      ? authReturnPath(`${pathname}?draft=${params.draft}`)
      : null;
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
