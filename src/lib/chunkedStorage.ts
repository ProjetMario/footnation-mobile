export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
type Manifest = { version: 1; generation: string; count: number };
function parse(value: string | null): Manifest | null {
  if (!value) return null;
  const m = JSON.parse(value) as Manifest;
  if (
    m.version !== 1 ||
    !/^[a-zA-Z0-9_-]+$/.test(m.generation) ||
    !Number.isInteger(m.count) ||
    m.count < 1 ||
    m.count > 256
  )
    throw new Error("Invalid session manifest");
  return m;
}
/** Atomic manifest swap: a failed write cannot corrupt the last usable session. */
export function createChunkedStorage(
  store: KeyValueStore,
  randomId: () => string,
): KeyValueStore {
  const pending = new Map<string, Promise<unknown>>();
  function lock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const next = (pending.get(key) || Promise.resolve())
      .catch(() => {})
      .then(operation);
    pending.set(key, next);
    void next
      .finally(() => {
        if (pending.get(key) === next) pending.delete(key);
      })
      .catch(() => {});
    return next;
  }
  const chunkKey = (key: string, m: Manifest, i: number) =>
    `${key}.${m.generation}.${i}`;
  const cleanup = async (key: string, m: Manifest | null) => {
    if (m)
      await Promise.allSettled(
        Array.from({ length: m.count }, (_, i) =>
          store.removeItem(chunkKey(key, m, i)),
        ),
      );
  };
  return {
    getItem: (key) =>
      lock(key, async () => {
        const m = parse(await store.getItem(key));
        if (!m) return null;
        const parts = await Promise.all(
          Array.from({ length: m.count }, (_, i) =>
            store.getItem(chunkKey(key, m, i)),
          ),
        );
        if (parts.some((p) => p === null))
          throw new Error("Session storage is incomplete");
        return parts.join("");
      }),
    setItem: (key, value) =>
      lock(key, async () => {
        const old = parse(await store.getItem(key));
        // SecureStore encodes each part separately. Never split a surrogate pair
        // at a boundary: a lone surrogate becomes a replacement character in UTF-8.
        const parts = value.match(/[\s\S]{1,400}/gu) || [""];
        if (parts.length > 256)
          throw new Error("Session exceeds secure storage limit");
        const next: Manifest = {
          version: 1,
          generation: randomId(),
          count: parts.length,
        };
        try {
          for (let i = 0; i < parts.length; i++)
            await store.setItem(chunkKey(key, next, i), parts[i]);
          await store.setItem(key, JSON.stringify(next));
        } catch (error) {
          await cleanup(key, next);
          throw error;
        }
        await cleanup(key, old);
      }),
    removeItem: (key) =>
      lock(key, async () => {
        const old = parse(await store.getItem(key));
        await store.removeItem(key);
        await cleanup(key, old);
      }),
  };
}
