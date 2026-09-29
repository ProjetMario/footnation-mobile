import type { KeyValueStore } from "./chunkedStorage";
import { stripProviderCredentials } from "./socialAuthPolicy";

export const authStorageKey = "footnation-native-auth";
const deletionFenceKey = (userId: string) =>
  `footnation-deleted-account.${userId}`;
export type StorageLock = <T>(
  key: string,
  operation: () => Promise<T>,
) => Promise<T>;
export function createAccountSessionStorage(
  store: KeyValueStore,
  options: {
    withLock?: StorageLock;
    canRemoveAccount?: () => boolean;
  } = {},
) {
  const queues = new Map<string, Promise<unknown>>();
  const removedAccounts = new Set<string>();
  function locked<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const next = (queues.get(key) || Promise.resolve())
      .catch(() => {})
      .then(() =>
        options.withLock ? options.withLock(key, operation) : operation(),
      );
    queues.set(key, next);
    void next
      .finally(() => {
        if (queues.get(key) === next) queues.delete(key);
      })
      .catch(() => {});
    return next;
  }
  return {
    runExclusive: <T>(name: string, operation: () => Promise<T>) =>
      locked(`operation:${name}`, operation),
    getItem: (key: string) =>
      locked(key, async () => {
        const raw = await store.getItem(key);
        if (key !== authStorageKey || !raw) return raw;
        const safe = stripProviderCredentials(raw);
        if (safe !== raw) await store.setItem(key, safe);
        return safe;
      }),
    setItem: (key: string, value: string) =>
      locked(key, async () => {
        if (key === authStorageKey) {
          const accountId = JSON.parse(value)?.user?.id;
          if (
            typeof accountId === "string" &&
            (removedAccounts.has(accountId) ||
              (await store.getItem(deletionFenceKey(accountId))) === "1")
          )
            throw new Error("Cette session appartient à un compte supprimé.");
        }
        await store.setItem(
          key,
          key === authStorageKey ? stripProviderCredentials(value) : value,
        );
      }),
    removeItem: (key: string) => locked(key, () => store.removeItem(key)),
    // Only called after a positive server deletion receipt. Compare + remove
    // share the exact queue used by every SDK write, including native chunks.
    removeAccountSession: (userId: string) =>
      locked(
        authStorageKey,
        async (): Promise<"removed" | "empty" | "other"> => {
          if (options.canRemoveAccount && !options.canRemoveAccount())
            throw new Error(
              "La fermeture sécurisée de la session doit être vérifiée sur cet appareil.",
            );
          removedAccounts.add(userId);
          // Survives reloads and is visible to every tab under the shared auth
          // lock. Otherwise another SDK instance could restore A over B later.
          await store.setItem(deletionFenceKey(userId), "1");
          const raw = await store.getItem(authStorageKey);
          if (!raw) return "empty";
          const currentId = JSON.parse(raw)?.user?.id;
          if (typeof currentId !== "string")
            throw new Error("Impossible de vérifier la session locale.");
          if (currentId !== userId) return "other";
          await store.removeItem(authStorageKey);
          return "removed";
        },
      ),
  };
}
