import type { KeyValueStore } from "./chunkedStorage";
import { experienceUuid, type ExperienceAttempt } from "./experienceSave";
export function createExperienceJournal(
  store: KeyValueStore & {
    runExclusive?: <T>(key: string, run: () => Promise<T>) => Promise<T>;
  },
) {
  const queues = new Map<string, Promise<unknown>>();
  const forgotten = new Set<string>();
  const key = (uid: string) => {
    if (!experienceUuid.test(uid))
      throw new Error("Identifiant du parcours invalide.");
    return `footnation-experience-save.${uid}`;
  };
  const fence = (uid: string) => `${key(uid)}.deleted`;
  const lock = <T>(uid: string, run: () => Promise<T>): Promise<T> => {
    const name = key(uid);
    const next = (queues.get(uid) || Promise.resolve())
      .catch(() => {})
      .then(() => (store.runExclusive ? store.runExclusive(name, run) : run()));
    queues.set(uid, next);
    void next
      .finally(() => {
        if (queues.get(uid) === next) queues.delete(uid);
      })
      .catch(() => {});
    return next;
  };
  const assertAvailable = async (uid: string) => {
    if (forgotten.has(uid) || (await store.getItem(fence(uid))) === "1")
      throw new Error("Ce compte a été supprimé.");
  };
  const parse = (raw: string | null, uid: string): ExperienceAttempt | null => {
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (
      raw.length > 96000 ||
      draft.version !== 1 ||
      draft.userId !== uid ||
      !experienceUuid.test(draft.attemptId) ||
      !["synced", "profile-only"].includes(draft.mode) ||
      !Array.isArray(draft.history) ||
      draft.history.length > 200 ||
      !(draft.expected === null || Array.isArray(draft.expected))
    )
      throw new Error(
        "La tentative conservée doit être vérifiée avant de modifier le parcours.",
      );
    return draft;
  };
  return {
    read: (uid: string) =>
      lock(uid, async () => {
        await assertAvailable(uid);
        return parse(await store.getItem(key(uid)), uid);
      }),
    save: (attempt: ExperienceAttempt) => {
      // Capture the entire proposal before the first await or UI edit.
      const raw = JSON.stringify(attempt);
      const uid = attempt.userId;
      parse(raw, uid);
      return lock(uid, async () => {
        await assertAvailable(uid);
        const existing = await store.getItem(key(uid));
        if (existing && existing !== raw)
          throw new Error(
            "Une autre tentative est en attente pour ce parcours. Reprenez-la avant une nouvelle modification.",
          );
        await store.setItem(key(uid), raw);
      });
    },
    clear: (attempt: ExperienceAttempt) => {
      const raw = JSON.stringify(attempt);
      return lock(attempt.userId, async () => {
        const existing = await store.getItem(key(attempt.userId));
        if (existing && existing !== raw)
          throw new Error(
            "Une autre tentative est en attente. Fermez puis rouvrez le parcours pour la récupérer.",
          );
        await store.removeItem(key(attempt.userId));
      });
    },
    forgetAccount: (uid: string) => {
      key(uid);
      forgotten.add(uid);
      return lock(uid, async () => {
        await store.setItem(fence(uid), "1");
        await store.removeItem(key(uid));
      });
    },
  };
}
