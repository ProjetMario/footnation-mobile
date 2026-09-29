import { notificationPath } from "./notificationPath";
const unavailable = "/link-unavailable";
/** Normalize links delivered by the OS, without touching Expo's development transport. */
export function incomingPath(path: string, development = false): string {
  if (!path || /[\\\u0000-\u0020\u007f]/.test(path)) return unavailable;
  if (path.startsWith("/")) return notificationPath(path) || unavailable;
  try {
    const url = new URL(path);
    if (url.username || url.password) return unavailable;
    if (
      development &&
      ["exp:", "exps:", "exp+footnation-native:"].includes(url.protocol)
    )
      return path;
    if (["footnation:", "com.footnation.app:"].includes(url.protocol)) {
      if (url.port) return unavailable;
      const route = url.hostname
        ? `/${url.hostname}${url.pathname}`
        : url.pathname || "/";
      return (
        notificationPath(`${route}${url.search}${url.hash}`) || unavailable
      );
    }
    return notificationPath(path) || unavailable;
  } catch {
    return unavailable;
  }
}
