import { randomUUID } from "expo-crypto";
import { supabase } from "./supabase";
import {
  MESSAGE_ATTACHMENT_BUCKET,
  attachmentTypes,
  MAX_MESSAGE_FILE_BYTES,
  normalizeAttachment,
  type LocalMessageFile,
  type MessageAttachment,
} from "./messageAttachment";
import { ensureMessageUpload } from "./messageAttachmentUpload";

const forgottenAccounts = new Set<string>();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let opening: Promise<IDBDatabase> | undefined;
function prefix(uid: string) {
  if (!uuid.test(uid)) throw new Error("Compte invalide.");
  return `footnation-message:${uid}/`;
}
function requireAccount(uid: string) {
  prefix(uid);
  if (forgottenAccounts.has(uid))
    throw new Error(
      "Ce compte a été supprimé. Aucun fichier ne sera conservé.",
    );
}
function owns(uid: string, uri: string) {
  const base = prefix(uid);
  return uri.startsWith(base) && uuid.test(uri.slice(base.length));
}
function database() {
  return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined")
      return reject(
        new Error(
          "Le stockage des pièces jointes est indisponible dans ce navigateur.",
        ),
      );
    const request = indexedDB.open("footnation-message-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onerror = request.onblocked = () =>
      reject(
        new Error(
          "Impossible de conserver la pièce jointe. Fermez les autres onglets puis réessayez.",
        ),
      );
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        opening = undefined;
      };
      resolve(request.result);
    };
  }).catch((error) => {
    opening = undefined;
    throw error;
  }));
}
async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, done: (value: T) => void) => void,
): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction("files", mode);
    let value: T;
    tx.oncomplete = () => resolve(value);
    tx.onabort = tx.onerror = () =>
      reject(
        new Error("La pièce jointe n’a pas pu être conservée. Réessayez."),
      );
    try {
      run(tx.objectStore("files"), (result) => {
        value = result;
      });
    } catch {
      tx.abort();
    }
  });
}
export async function retainMessageFile(
  uid: string,
  file: LocalMessageFile,
): Promise<LocalMessageFile> {
  requireAccount(uid);
  const ext = attachmentTypes[file.mime];
  if (!ext || !/^(blob:|data:)/.test(file.uri))
    throw new Error("Choisissez un fichier depuis cet appareil.");
  const response = await fetch(file.uri);
  if (!response.ok)
    throw new Error(
      "Ce fichier n’est plus disponible. Choisissez-le à nouveau.",
    );
  const blob = await response.blob();
  if (blob.size <= 0 || blob.size > MAX_MESSAGE_FILE_BYTES)
    throw new Error(
      "Choisissez une image, un PDF, une vidéo MP4 ou un fichier audio de 10 Mo maximum.",
    );
  requireAccount(uid);
  const uri = `${prefix(uid)}${randomUUID()}`;
  await transaction<void>("readwrite", (store, done) => {
    store.add(blob, uri);
    done(undefined);
  });
  try {
    requireAccount(uid);
  } catch (error) {
    await remove(uid, uri);
    throw error;
  }
  return {
    ...file,
    uri,
    size: blob.size,
    name:
      file.name
        .replace(/[\x00-\x1f\x7f/\\]/g, "_")
        .trim()
        .slice(0, 120) || `fichier.${ext}`,
  };
}
async function remove(uid: string, uri: string) {
  if (!owns(uid, uri)) return;
  await transaction<void>("readwrite", (store, done) => {
    store.delete(uri);
    done(undefined);
  });
}
export function discardMessageFile(uid: string, uri?: string) {
  if (uri) void remove(uid, uri).catch(() => {});
}
export function discardMessageCacheFile(uri?: string | null) {
  if (uri?.startsWith("blob:")) URL.revokeObjectURL(uri);
}
export async function forgetMessageAttachmentFiles(uid: string): Promise<void> {
  const base = prefix(uid);
  forgottenAccounts.add(uid);
  await transaction<void>("readwrite", (store, done) => {
    const cursor = store.openCursor(IDBKeyRange.bound(base, `${base}\uffff`));
    cursor.onsuccess = () => {
      if (cursor.result) {
        cursor.result.delete();
        cursor.result.continue();
      } else done(undefined);
    };
  });
}
export async function uploadMessageFile(
  uid: string,
  attachment: MessageAttachment,
  uri: string,
) {
  requireAccount(uid);
  if (!owns(uid, uri))
    throw new Error(
      "Le fichier ne correspond pas aux brouillons de ce compte.",
    );
  const parts = attachment.path.split("/");
  normalizeAttachment(attachment, uid, parts[1], parts[2]);
  const bucket = supabase.storage.from(MESSAGE_ATTACHMENT_BUCKET);
  await ensureMessageUpload(attachment, {
    requireUser: async () => {
      requireAccount(uid);
      const auth = await supabase.auth.getUser();
      requireAccount(uid);
      if (auth.error || auth.data.user?.id !== uid)
        throw new Error("Votre session a changé.");
    },
    info: () => bucket.info(attachment.path),
    bytes: async () => {
      const blob = await transaction<Blob | undefined>(
        "readonly",
        (store, done) => {
          const request = store.get(uri);
          request.onsuccess = () => done(request.result);
        },
      );
      if (!(blob instanceof Blob) || blob.size !== attachment.size)
        throw new Error(
          "Le fichier local n’est plus disponible. Abandonnez cette tentative puis choisissez-le à nouveau.",
        );
      return blob.arrayBuffer();
    },
    upload: (bytes) =>
      bucket.upload(attachment.path, bytes, {
        contentType: attachment.mime,
        upsert: false,
        cacheControl: "0",
      }),
  });
}
