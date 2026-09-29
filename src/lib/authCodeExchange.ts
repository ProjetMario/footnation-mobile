// OAuth can return through both the system browser and the router. A PKCE code
// must be exchanged once, including when React replays a mount effect.
export function createAuthCodeExchange<T>(
  exchange: (code: string) => Promise<T>,
) {
  const pending = new Map<string, { promise: Promise<T>; expires: number }>();
  return (code: string) => {
    const now = Date.now();
    for (const [key, entry] of pending)
      if (entry.expires <= now) pending.delete(key);
    const existing = pending.get(code);
    if (existing) return existing.promise;
    const promise = exchange(code).catch((error) => {
      pending.delete(code);
      throw error;
    });
    pending.set(code, { promise, expires: now + 120000 });
    if (pending.size > 10) pending.delete(pending.keys().next().value!);
    return promise;
  };
}

/** The system browser and route callback must not navigate twice for one code. */
export function createAuthNavigationClaims(now = Date.now) {
  const completed = new Map<string, number>();
  return (code: string, expectedUser: string, currentUser?: string) => {
    if (!code || !expectedUser || expectedUser !== currentUser) return false;
    for (const [key, until] of completed)
      if (until <= now()) completed.delete(key);
    if (completed.has(code)) return false;
    completed.set(code, now() + 120000);
    if (completed.size > 20) completed.delete(completed.keys().next().value!);
    return true;
  };
}
