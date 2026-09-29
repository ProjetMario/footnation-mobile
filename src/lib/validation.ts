export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
export function strongPassword(value: string) {
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value)
  );
}
export function safeInternalPath(value: string | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return "/";
  return value;
}
export function isSuspended(
  profile: {
    is_suspended?: boolean | null;
    suspended_until?: string | null;
  } | null,
  now = Date.now(),
) {
  if (!profile?.is_suspended) return false;
  if (!profile.suspended_until) return true;
  const expiry = Date.parse(profile.suspended_until);
  return !Number.isFinite(expiry) || expiry > now;
}
export function ownConversationPeer(
  sender: string,
  receiver: string,
  viewer: string,
) {
  return sender === viewer ? receiver : receiver === viewer ? sender : null;
}
