import type { KeyValueStore } from "./chunkedStorage";
export type AccountDeletionReceipt = {
  userId: string;
  operationId: string;
  createdAt: number;
  completed: boolean;
  appleRevocationRequired?: boolean;
};
const key = "footnation-account-deletion-v1";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createAccountDeletionJournal(
  store: KeyValueStore,
  randomId: () => string,
  now = Date.now,
  exclusive?: <T>(operation: () => Promise<T>) => Promise<T>,
) {
  let pending: Promise<unknown> = Promise.resolve();
  function serial<T>(operation: () => Promise<T>) {
    const next = pending
      .catch(() => {})
      .then(() => (exclusive ? exclusive(operation) : operation()));
    pending = next;
    return next;
  }
  const read = async (): Promise<AccountDeletionReceipt[]> => {
    const raw = await store.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed))
      throw new Error("Le suivi de suppression doit être vérifié.");
    return parsed.filter(
      (value): value is AccountDeletionReceipt =>
        !!value &&
        typeof value === "object" &&
        typeof value.userId === "string" &&
        uuid.test(value.userId) &&
        typeof value.operationId === "string" &&
        uuid.test(value.operationId) &&
        typeof value.completed === "boolean" &&
        (value.appleRevocationRequired === undefined ||
          typeof value.appleRevocationRequired === "boolean") &&
        typeof value.createdAt === "number" &&
        Number.isFinite(value.createdAt) &&
        value.createdAt <= now() + 30_000 &&
        now() - value.createdAt <= 86_400_000,
    );
  };
  return {
    list: (userId?: string) =>
      serial(async () => {
        const entries = await read();
        await store.setItem(key, JSON.stringify(entries));
        return userId
          ? entries.filter((value) => value.userId === userId)
          : entries;
      }),
    prepare: (userId: string) =>
      serial(async () => {
        if (!uuid.test(userId)) throw new Error("Compte invalide.");
        const entries = await read();
        const existing = entries.find((value) => value.userId === userId);
        if (existing) return existing;
        if (entries.length >= 8)
          throw new Error(
            "Vérifiez les suppressions en attente sur cet appareil avant de continuer.",
          );
        const receipt: AccountDeletionReceipt = {
          userId,
          operationId: randomId(),
          createdAt: now(),
          completed: false,
        };
        await store.setItem(key, JSON.stringify([...entries, receipt]));
        return receipt;
      }),
    complete: (operationId: string, appleRevocationRequired = false) =>
      serial(async () => {
        const entries = await read();
        await store.setItem(
          key,
          JSON.stringify(
            entries.map((value) =>
              value.operationId === operationId
                ? {
                    ...value,
                    completed: true,
                    appleRevocationRequired:
                      value.appleRevocationRequired === true ||
                      appleRevocationRequired,
                  }
                : value,
            ),
          ),
        );
      }),
  };
}
