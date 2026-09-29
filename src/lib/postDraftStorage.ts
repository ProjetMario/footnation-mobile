import { createPostDraftJournal } from "./postDraftJournal";
import { assertPostId, type PostDraftMedia } from "./postPublication";

let opening: Promise<IDBDatabase> | null = null;
function database() {
  return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(
        new Error(
          "Le stockage des brouillons est indisponible sur cet appareil.",
        ),
      );
      return;
    }
    const request = indexedDB.open("footnation-post-drafts", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("drafts");
      request.result.createObjectStore("media");
    };
    request.onerror = request.onblocked = () =>
      reject(
        new Error(
          "Impossible d’ouvrir vos brouillons. Fermez les autres onglets et réessayez.",
        ),
      );
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        opening = null;
      };
      resolve(request.result);
    };
  }).catch((error) => {
    opening = null;
    throw error;
  }));
}
async function transaction<T>(
  name: "drafts" | "media",
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, done: (value: T) => void) => void,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () =>
      reject(
        new Error(
          "Le brouillon n’a pas pu être conservé. Rechargez-le avant de réessayer.",
        ),
      );
    try {
      run(tx.objectStore(name), (value) => {
        result = value;
      });
    } catch {
      tx.abort();
    }
  });
}
function mediaKey(userId: string, id: string) {
  assertPostId(userId);
  assertPostId(id);
  return `${userId}/${id}`;
}
export const postDraftJournal = createPostDraftJournal({
  read(userId) {
    assertPostId(userId);
    return transaction("drafts", "readonly", (store, done) => {
      const read = store.get(userId);
      read.onsuccess = () =>
        done(typeof read.result === "string" ? read.result : null);
    });
  },
  swap(userId, expected, next) {
    assertPostId(userId);
    return transaction("drafts", "readwrite", (store, done) => {
      const read = store.get(userId);
      read.onsuccess = () => {
        if ((read.result ?? null) !== expected) {
          store.transaction.abort();
          return;
        }
        if (next === null) store.delete(userId);
        else store.put(next, userId);
        done(undefined);
      };
    });
  },
  removeAccountMedia(userId) {
    assertPostId(userId);
    return transaction("media", "readwrite", (store, done) => {
      const cursor = store.openCursor(
        IDBKeyRange.bound(`${userId}/`, `${userId}/\uffff`),
      );
      cursor.onsuccess = () => {
        if (cursor.result) {
          cursor.result.delete();
          cursor.result.continue();
        } else done(undefined);
      };
    });
  },
});
export async function persistPostMedia(
  userId: string,
  media: PostDraftMedia,
  bytes: ArrayBuffer,
) {
  postDraftJournal.assertActive(userId);
  await transaction<void>("media", "readwrite", (store, done) => {
    store.add(
      new Blob([bytes], { type: media.mime }),
      mediaKey(userId, media.id),
    );
    done(undefined);
  });
  try {
    postDraftJournal.assertActive(userId);
  } catch (error) {
    await removePostMedia(userId, media);
    throw error;
  }
}
export async function postMediaPreview(userId: string, media: PostDraftMedia) {
  const blob = await transaction<Blob>("media", "readonly", (store, done) => {
    const read = store.get(mediaKey(userId, media.id));
    read.onsuccess = () => done(read.result);
  });
  if (!(blob instanceof Blob))
    throw new Error(
      "La pièce jointe de ce brouillon est indisponible sur cet appareil.",
    );
  const uri = URL.createObjectURL(blob);
  return { uri, release: () => URL.revokeObjectURL(uri) };
}
export function removePostMedia(userId: string, media: PostDraftMedia) {
  return transaction<void>("media", "readwrite", (store, done) => {
    store.delete(mediaKey(userId, media.id));
    done(undefined);
  });
}
