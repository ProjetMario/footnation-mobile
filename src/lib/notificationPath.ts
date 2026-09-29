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
    const decodedPath = decodeURIComponent(url.pathname);
    if (
      decodedPath.startsWith("//") ||
      /[\\\u0000-\u001f\u007f]/.test(decodedPath)
    )
      return null;
    // Both formats are produced by the web app (sharing and new-short notifications).
    const sharedShort = [
      url.searchParams.get("shortId"),
      url.searchParams.get("id"),
    ].find((id) => id && recordId.test(id));
    if (url.pathname === "/shorts" && sharedShort)
      return `/shorts/${sharedShort}`;
    // Web notifications and matching links select a recipient with a query;
    // the native inbox itself does not consume these parameters.
    const recipient = [
      url.searchParams.get("user"),
      url.searchParams.get("to"),
    ].find((id) => id && recordId.test(id));
    if (url.pathname === "/messages" && recipient)
      return `/conversation/${recipient}`;
    const path = url.pathname
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
