import {
  storyPublicationKey,
  validateStoryPublication,
  type StoryPublicationDraft,
} from "./storyPublication";
export type StoryDraftStore = {
  read(key: string): Promise<string | null>;
  create(key: string, value: string): Promise<void>;
  remove(key: string, expected: string): Promise<void>;
};
export function createStoryPublicationJournal(store: StoryDraftStore) {
  const queues = new Map<string, Promise<unknown>>();
  const deletedAccounts = new Set<string>();
  const assertNotDeleted = (uid: string) => {
    if (deletedAccounts.has(uid))
      throw new Error(
        "Ce compte a été supprimé. Aucune tentative ne sera conservée.",
      );
  };
  function serial<T>(key: string, run: () => Promise<T>): Promise<T> {
    const next = (queues.get(key) || Promise.resolve())
      .catch(() => {})
      .then(run);
    queues.set(key, next);
    void next
      .finally(() => {
        if (queues.get(key) === next) queues.delete(key);
      })
      .catch(() => {});
    return next;
  }
  const decode = (raw: string, uid: string) => {
    try {
      return validateStoryPublication(JSON.parse(raw), uid);
    } catch {
      throw new Error(
        "Impossible de récupérer la tentative de story conservée sur cet appareil.",
      );
    }
  };
  return {
    load(userId: string) {
      const key = storyPublicationKey(userId);
      return serial(key, async () => {
        const raw = await store.read(key);
        return raw ? decode(raw, userId) : null;
      });
    },
    save(value: StoryPublicationDraft) {
      const draft = validateStoryPublication(value, value.record.user_id);
      assertNotDeleted(draft.record.user_id);
      const key = storyPublicationKey(draft.record.user_id),
        snapshot = JSON.stringify(draft);
      return serial(key, async () => {
        assertNotDeleted(draft.record.user_id);
        const existing = await store.read(key);
        assertNotDeleted(draft.record.user_id);
        if (existing) {
          if (
            JSON.stringify(decode(existing, draft.record.user_id)) === snapshot
          )
            return;
          throw new Error(
            "Une autre story attend déjà une vérification sur cet appareil. Rouvrez sa tentative.",
          );
        }
        try {
          await store.create(key, snapshot);
        } catch {
          // Another tab may have atomically created the same journal meanwhile.
          const current = await store.read(key);
          if (
            current &&
            JSON.stringify(decode(current, draft.record.user_id)) === snapshot
          )
            return;
          throw new Error(
            "Impossible de conserver cette tentative. Aucun envoi n’a été lancé.",
          );
        }
      });
    },
    remove(draft: StoryPublicationDraft) {
      const key = storyPublicationKey(draft.record.user_id),
        snapshot = JSON.stringify(
          validateStoryPublication(draft, draft.record.user_id),
        );
      return serial(key, async () => {
        const raw = await store.read(key);
        if (!raw) return;
        if (JSON.stringify(decode(raw, draft.record.user_id)) !== snapshot)
          throw new Error(
            "Une autre tentative est conservée. Elle n’a pas été effacée.",
          );
        await store.remove(key, raw);
      });
    },
    // Explicit discard of an unreadable journal; does not block a fresh attempt.
    discardUnreadableForAccount(userId: string) {
      const key = storyPublicationKey(userId);
      return serial(key, async () => {
        const raw = await store.read(key);
        if (raw) await store.remove(key, raw);
      });
    },
    // Verified deletion only. Fence synchronously, including saves already
    // queued or awaiting a read, then remove an in-progress committed write.
    forgetForAccount(userId: string) {
      const key = storyPublicationKey(userId);
      deletedAccounts.add(userId);
      return serial(key, async () => {
        const raw = await store.read(key);
        if (raw) await store.remove(key, raw);
      });
    },
  };
}
