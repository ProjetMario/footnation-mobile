import {
  createStoryPublicationJournal,
  type StoryDraftStore,
} from "./storyPublicationJournal";

let opening: Promise<IDBDatabase> | null = null;
function database() {
  if (!opening)
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("Le stockage local des stories est indisponible."));
        return;
      }
      const request = indexedDB.open("footnation-story-drafts", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("drafts");
      };
      request.onerror = () =>
        reject(new Error("Impossible d’ouvrir les tentatives de stories."));
      request.onblocked = () =>
        reject(
          new Error(
            "Fermez les autres onglets FootNation pour récupérer cette tentative.",
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
    });
  return opening;
}
async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, done: (value: T) => void) => void,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () =>
      reject(
        new Error("La tentative n’a pas pu être conservée sur cet appareil."),
      );
    try {
      run(tx.objectStore("drafts"), (value) => {
        result = value;
      });
    } catch {
      tx.abort();
    }
  });
}
const store: StoryDraftStore = {
  read: (key) =>
    transaction("readonly", (store, done) => {
      const read = store.get(key);
      read.onsuccess = () =>
        done(typeof read.result === "string" ? read.result : null);
    }),
  create: (key, value) =>
    transaction("readwrite", (store, done) => {
      store.add(value, key);
      done(undefined);
    }),
  remove: (key, expected) =>
    transaction("readwrite", (store, done) => {
      const read = store.get(key);
      read.onsuccess = () => {
        if (read.result !== undefined && read.result !== expected) {
          store.transaction.abort();
          return;
        }
        store.delete(key);
        done(undefined);
      };
    }),
};
export const storyPublicationJournal = createStoryPublicationJournal(store);
