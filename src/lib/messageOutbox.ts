import {
  normalizeAttachment,
  type MessageAttachment,
} from "./messageAttachment";
export type MessageProposal = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  attachment?: MessageAttachment;
  localAttachmentUri?: string;
};
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createMessageOutbox(storage: Storage) {
  const pending = new Map<string, Promise<unknown>>();
  const forgottenAccounts = new Set<string>();
  const keyFor = (uid: string, peer: string) => {
    if (!uuid.test(uid) || !uuid.test(peer))
      throw new Error("Conversation invalide.");
    return `footnation.outbox.${uid}.${peer}`;
  };
  const validate = (row: MessageProposal, uid: string, peer: string) => {
    if (
      !row ||
      !uuid.test(row.id) ||
      row.sender_id !== uid ||
      row.receiver_id !== peer ||
      typeof row.content !== "string" ||
      !row.content.trim() ||
      row.content.length > 10000
    )
      throw new Error("La tentative conservée sur cet appareil est invalide.");
    let attachment: MessageAttachment | undefined;
    if (row.attachment !== undefined && row.attachment !== null) {
      attachment = normalizeAttachment(row.attachment, uid, peer, row.id);
      if (
        typeof row.localAttachmentUri !== "string" ||
        !row.localAttachmentUri.startsWith("file://")
      )
        throw new Error("Fichier local de la tentative invalide.");
    } else if (row.localAttachmentUri) throw new Error("Tentative incomplète.");
    // Snapshot only the transport contract; caller mutations and extra restored keys cannot change an in-flight save.
    return {
      id: row.id,
      sender_id: uid,
      receiver_id: peer,
      content: row.content,
      ...(attachment
        ? { attachment, localAttachmentUri: row.localAttachmentUri }
        : {}),
    };
  };
  async function read(key: string, uid: string, peer: string) {
    const raw = await storage.getItem(key);
    if (!raw) return null;
    try {
      return validate(JSON.parse(raw), uid, peer);
    } catch {
      throw new Error(
        "Impossible de récupérer la tentative conservée sur cet appareil.",
      );
    }
  }
  function serial<T>(key: string, task: () => Promise<T>): Promise<T> {
    const next = (pending.get(key) || Promise.resolve())
      .catch(() => {})
      .then(task);
    pending.set(key, next);
    void next
      .finally(() => {
        if (pending.get(key) === next) pending.delete(key);
      })
      .catch(() => {});
    return next;
  }
  const indexKey = (uid: string) => {
    if (!uuid.test(uid)) throw new Error("Compte invalide.");
    return `footnation.outbox-index.${uid}`;
  };
  async function peers(uid: string): Promise<string[]> {
    const raw = await storage.getItem(indexKey(uid));
    if (!raw) return [];
    try {
      const value = JSON.parse(raw);
      if (
        !Array.isArray(value) ||
        value.some((peer) => typeof peer !== "string" || !uuid.test(peer))
      )
        throw new Error();
      return [...new Set<string>(value)];
    } catch {
      throw new Error(
        "Impossible de lire la liste des envois en attente sur cet appareil.",
      );
    }
  }
  async function register(uid: string, peer: string) {
    const entries = await peers(uid);
    if (!entries.includes(peer))
      await storage.setItem(indexKey(uid), JSON.stringify([...entries, peer]));
  }
  return {
    list(uid: string) {
      return serial(indexKey(uid), async () => {
        if (forgottenAccounts.has(uid)) return [];
        const entries = await peers(uid);
        const rows = await Promise.all(
          entries.map((peer) => read(keyFor(uid, peer), uid, peer)),
        );
        return rows.filter((row): row is MessageProposal => row !== null);
      });
    },
    load(uid: string, peer: string) {
      const key = keyFor(uid, peer);
      return serial(indexKey(uid), async () => {
        if (forgottenAccounts.has(uid)) return null;
        const row = await read(key, uid, peer);
        if (row) await register(uid, peer);
        return row;
      });
    },
    save(row: MessageProposal) {
      const key = keyFor(row.sender_id, row.receiver_id);
      row = validate(row, row.sender_id, row.receiver_id);
      return serial(indexKey(row.sender_id), async () => {
        if (forgottenAccounts.has(row.sender_id))
          throw new Error(
            "Ce compte a été supprimé. Aucun brouillon ne sera conservé.",
          );
        const existing = await read(key, row.sender_id, row.receiver_id);
        if (
          existing &&
          (existing.id !== row.id ||
            existing.content !== row.content ||
            JSON.stringify(existing.attachment) !==
              JSON.stringify(row.attachment) ||
            existing.localAttachmentUri !== row.localAttachmentUri)
        )
          throw new Error(
            "Une autre tentative attend déjà une vérification dans cette conversation. Rouvrez-la.",
          );
        await register(row.sender_id, row.receiver_id);
        await storage.setItem(key, JSON.stringify(row));
      });
    },
    remove(row: MessageProposal) {
      const key = keyFor(row.sender_id, row.receiver_id);
      row = { ...row };
      return serial(indexKey(row.sender_id), async () => {
        if (forgottenAccounts.has(row.sender_id)) return;
        const existing = await read(key, row.sender_id, row.receiver_id);
        if (existing?.id === row.id) {
          await storage.removeItem(key);
          const entries = await peers(row.sender_id);
          await storage.setItem(
            indexKey(row.sender_id),
            JSON.stringify(entries.filter((peer) => peer !== row.receiver_id)),
          );
        }
      });
    },
    /** Only after a confirmed server deletion; never an ordinary sign-out. */
    forgetAccount(uid: string) {
      const index = indexKey(uid);
      forgottenAccounts.add(uid);
      // Existing writes finish before removal; queued/new writes see the fence.
      return serial(index, async () => {
        const entries = await peers(uid);
        for (const peer of entries) await storage.removeItem(keyFor(uid, peer));
        await storage.removeItem(index);
      });
    },
  };
}
