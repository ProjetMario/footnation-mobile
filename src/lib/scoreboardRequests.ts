// Public scoreboards only: share overlapping sections without sharing account
// data. Each reader can cancel independently; the last reader aborts the fetch.
export function createScoreboardRequests<T>(
  load: (key: string, signal: AbortSignal) => Promise<T>,
  { concurrency = 6, ttl = 30_000, capacity = 256 } = {},
) {
  const cached = new Map<string, { value: T; expires: number }>();
  type Pending = {
    controller: AbortController;
    readers: number;
    promise: Promise<T>;
  };
  const pending = new Map<string, Pending>();
  const queue: (() => void)[] = [];
  let running = 0;

  function pump() {
    while (running < concurrency && queue.length) queue.shift()!();
  }

  function aborted() {
    const error = new Error("Chargement des matchs annulé.");
    error.name = "AbortError";
    return error;
  }

  function get(key: string, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(aborted());
    const hit = cached.get(key);
    if (hit && hit.expires > Date.now()) {
      cached.delete(key);
      cached.set(key, hit);
      return Promise.resolve(hit.value);
    }
    cached.delete(key);
    let entry = pending.get(key);
    if (!entry) {
      const controller = new AbortController();
      let resolve!: (value: T) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      entry = { controller, readers: 0, promise };
      const current = entry;
      pending.set(key, current);
      queue.push(() => {
        if (controller.signal.aborted) {
          reject(aborted());
          return;
        }
        running++;
        void load(key, controller.signal)
          .then((value) => {
            if (controller.signal.aborted) throw aborted();
            cached.set(key, { value, expires: Date.now() + ttl });
            while (cached.size > capacity)
              cached.delete(cached.keys().next().value!);
            resolve(value);
          })
          .catch(reject)
          .finally(() => {
            if (pending.get(key) === current) pending.delete(key);
            running--;
            pump();
          });
      });
    }
    const current = entry;
    current.readers++;
    const result = new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (error: unknown, value?: T) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", cancel);
        current.readers--;
        if (!current.readers && pending.get(key) === current) {
          pending.delete(key);
          current.controller.abort();
        }
        if (error) reject(error);
        else resolve(value!);
      };
      const cancel = () => finish(aborted());
      signal?.addEventListener("abort", cancel, { once: true });
      current.promise.then(
        (value) => finish(null, value),
        (error) => finish(error),
      );
    });
    pump();
    return result;
  }

  return {
    get,
    clear() {
      cached.clear();
      for (const entry of pending.values()) entry.controller.abort();
      pending.clear();
      pump();
    },
  };
}
