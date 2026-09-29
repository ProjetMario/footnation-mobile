type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseHiddenPosts(value: string | null): string[] {
  if (!value) return [];
  let ids: unknown;
  try {
    ids = JSON.parse(value);
  } catch {
    throw new Error("Impossible de récupérer les publications masquées.");
  }
  if (
    !Array.isArray(ids) ||
    ids.some((id) => typeof id !== "string" || !uuid.test(id))
  )
    throw new Error("Impossible de récupérer les publications masquées.");
  return [...new Set(ids as string[])];
}
export function createHiddenPostStore(storage: Storage) {
  const queues = new Map<string, Promise<unknown>>();
  const forgotten = new Set<string>();
  const keyFor = (uid: string) => {
    if (!uuid.test(uid)) throw new Error("Compte invalide.");
    return `footnation.hidden-posts.${uid}`;
  };
  function serial<T>(uid: string, task: () => Promise<T>): Promise<T> {
    keyFor(uid);
    const operation = (queues.get(uid) || Promise.resolve())
      .catch(() => {})
      .then(task);
    queues.set(uid, operation);
    void operation
      .finally(() => {
        if (queues.get(uid) === operation) queues.delete(uid);
      })
      .catch(() => {});
    return operation;
  }
  const read = async (uid: string) =>
    parseHiddenPosts(await storage.getItem(keyFor(uid)));
  return {
    list: (uid: string) =>
      serial(uid, () => (forgotten.has(uid) ? Promise.resolve([]) : read(uid))),
    hide: (uid: string, id: string) =>
      serial(uid, async () => {
        if (forgotten.has(uid)) throw new Error("Ce compte a été supprimé.");
        if (!uuid.test(id)) throw new Error("Publication invalide.");
        const ids = [...new Set([...(await read(uid)), id])];
        await storage.setItem(keyFor(uid), JSON.stringify(ids));
        return ids;
      }),
    forget: (uid: string) => {
      forgotten.add(uid);
      return serial(uid, () => storage.removeItem(keyFor(uid)));
    },
  };
}
