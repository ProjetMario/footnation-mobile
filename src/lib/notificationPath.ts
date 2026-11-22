const origins = new Set([
  "https://www.foot-nation.com",
  "https://foot-nation.com",
]);
const recordId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve notification links from the site without opening an external origin. */
export function notificationPath(
  value: string | null | undefined,
): string | null {
  if (!value || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
  if (!value.startsWith("/") && !value.startsWith("https://")) return null;
  if (value.startsWith("//")) return null;
  try {
    const url = new URL(value, "https://www.foot-nation.com");
    if (!origins.has(url.origin) || url.username || url.password) return null;
    // The production Expo Web app lives below /app. Installed native apps use
    // the same routes without this hosting prefix, including shared invitations.
    const pathname = url.pathname.replace(/^\/app(?=\/|$)/, "") || "/";
    const decodedPath = decodeURIComponent(pathname);
    if (
      decodedPath.startsWith("//") ||
      /[\\\u0000-\u001f\u007f]/.test(decodedPath)
    )
      return null;
    if (
      pathname === "/opportunities" &&
      recordId.test(url.searchParams.get("application") || "")
    ) {
      return url.searchParams.get("view") === "received"
        ? "/my-applications?mode=received"
        : "/my-applications";
    }
    // Both formats are produced by the web app (sharing and new-short notifications).
    const sharedShort = [
      url.searchParams.get("shortId"),
      url.searchParams.get("id"),
    ].find((id) => id && recordId.test(id));
    if (pathname === "/shorts" && sharedShort) return `/shorts/${sharedShort}`;
    // Web notifications and matching links select a recipient with a query;
    // the native inbox itself does not consume these parameters.
    const recipient = [
      url.searchParams.get("user"),
      url.searchParams.get("to"),
    ].find((id) => id && recordId.test(id));
    if (pathname === "/messages" && recipient)
      return `/conversation/${recipient}`;
    const path = pathname
      .replace(/^\/clubs?\/([0-9a-f-]{36})\/admin$/i, "/club-admin/$1")
      .replace(/^\/clubs-ville-([^/]+)$/, "/clubs-ville/$1")
      .replace(/^\/clubs-departement-([^/]+)$/, "/clubs-departement/$1")
      .replace(/^\/clubs\//, "/club/")
      .replace(/^\/matchs\//, "/match/")
      .replace(/^\/actus\//, "/actu/");
    return `${path}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
