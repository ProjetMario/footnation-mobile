export const clubUuid = value => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value || '');
const slugPattern = /^[a-z0-9][a-z0-9-]{0,199}$/;
export function clubRouteShard(slug) {
  let hash = 0;
  for (const character of slug) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return (hash % 16).toString(16);
}

// This directory is a routing hint, never a substitute for live club data or RLS.
export function createClubIdResolver({ baseUrl = '', fetchImpl = globalThis.fetch, timeoutMs = 1500, now = Date.now } = {}) {
  const cache = new Map();
  return async slug => {
    if (!slugPattern.test(slug || '') || clubUuid(slug)) return null;
    const shard = clubRouteShard(slug);
    let cached = cache.get(shard);
    if (!cached || now() - cached.createdAt > 30 * 60 * 1000) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const promise = (async () => {
        try {
          const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/data/club-routes/${shard}.json`, { signal: controller.signal });
          if (!response.ok) return null;
          const data = await response.json();
          return data?.version === 1 && data.entries && typeof data.entries === 'object' && !Array.isArray(data.entries) ? data.entries : null;
        } catch { return null; }
        finally { clearTimeout(timer); }
      })();
      cached = { createdAt: now(), promise };
      cache.set(shard, cached);
      promise.then(entries => { if (!entries && cache.get(shard) === cached) cache.delete(shard); });
    }
    const entries = await cached.promise;
    const id = entries && Object.hasOwn(entries, slug) ? entries[slug] : null;
    return typeof id === 'string' && clubUuid(id) ? id : null;
  };
}

export async function readClubByRoute(route, { resolveId, readById, readBySlug }) {
  if (clubUuid(route)) return readById(route);
  const id = await resolveId(route);
  if (id) {
    const club = await readById(id);
    // Renamed/deleted clubs or an outdated directory cannot select the wrong club.
    if (club?.id === id && club.slug === route) return club;
  }
  return readBySlug(route);
}
