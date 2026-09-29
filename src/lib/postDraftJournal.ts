import { validatePostDraft, type PostDraft } from "./postPublication";
export type PostDraftAdapter = {
  read(userId: string): Promise<string | null>;
  swap(
    userId: string,
    expected: string | null,
    next: string | null,
  ): Promise<void>;
  removeAccountMedia(userId: string): Promise<void>;
};
export function createPostDraftJournal(adapter: PostDraftAdapter) {
  const queues = new Map<string, Promise<unknown>>();
  const deleted = new Set<string>();
  function serial<T>(userId: string, run: () => Promise<T>): Promise<T> {
    const next = (queues.get(userId) || Promise.resolve())
      .catch(() => {})
      .then(run);
    queues.set(userId, next);
    void next
      .finally(() => {
        if (queues.get(userId) === next) queues.delete(userId);
      })
      .catch(() => {});
    return next;
  }
  function assertActive(userId: string) {
    if (deleted.has(userId))
      throw new Error(
        "Ce compte a été supprimé. Le brouillon ne sera pas conservé.",
      );
  }
  return {
    assertActive,
    load(userId: string) {
      return serial(userId, async () => {
        assertActive(userId);
        const raw = await adapter.read(userId);
        return raw ? validatePostDraft(JSON.parse(raw), userId) : null;
      });
    },
    save(draft: PostDraft, previous: PostDraft | null) {
      if (
        previous &&
        (previous.userId !== draft.userId ||
          previous.id !== draft.id ||
          previous.revision + 1 !== draft.revision ||
          previous.attempt)
      )
        return Promise.reject(
          new Error(
            "Cette tentative est déjà figée. Réessayez sa publication.",
          ),
        );
      const next = JSON.stringify(validatePostDraft(draft, draft.userId));
      assertActive(draft.userId);
      return serial(draft.userId, async () => {
        assertActive(draft.userId);
        await adapter.swap(
          draft.userId,
          previous ? JSON.stringify(previous) : null,
          next,
        );
        assertActive(draft.userId);
      });
    },
    remove(draft: PostDraft) {
      return serial(draft.userId, async () => {
        if ((await adapter.read(draft.userId)) === null) return;
        await adapter.swap(draft.userId, JSON.stringify(draft), null);
      });
    },
    forgetForAccount(userId: string) {
      deleted.add(userId);
      return serial(userId, async () => {
        await adapter.swap(userId, await adapter.read(userId), null);
        await adapter.removeAccountMedia(userId);
      });
    },
  };
}
