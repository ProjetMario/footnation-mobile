import { randomUUID } from "expo-crypto";
import type { ImagePickerAsset } from "expo-image-picker";
import type {
  CreationJob,
  CreationProject,
  CreationSource,
} from "./creationProject";
import { readAsset } from "./readAsset";
import {
  creationKey,
  checkCreationDraft,
  checkCreationMedia,
  creationMediaLimit,
  creationMediaMime,
  checkCreationSave,
  checkCreationAttempt,
  type CreationAttempt,
} from "./creationStorageShared";
export type { CreationAttempt } from "./creationStorageShared";

let opening: Promise<IDBDatabase> | undefined;
function database() {
  return (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined")
      return reject(
        new Error(
          "Le stockage des brouillons est indisponible sur cet appareil.",
        ),
      );
    const request = indexedDB.open("footnation-creation-studio", 2);
    request.onupgradeneeded = () => {
      for (const name of ["projects", "media", "attempts", "jobs"])
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name);
    };
    request.onerror = request.onblocked = () =>
      reject(
        new Error(
          "Impossible d’ouvrir vos brouillons. Fermez les autres onglets puis réessayez.",
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
  names: string[],
  mode: IDBTransactionMode,
  run: (tx: IDBTransaction, done: (value: T) => void) => void,
) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(names, mode);
    let value: T;
    let failure: unknown;
    tx.oncomplete = () => resolve(value);
    tx.onabort = tx.onerror = () =>
      reject(
        failure ||
          new Error("Le brouillon n’a pas pu être conservé sur cet appareil."),
      );
    try {
      run(tx, (result) => {
        value = result;
      });
    } catch (error) {
      failure = error;
      tx.abort();
    }
  });
}
export async function loadCreationProject(ownerId: string, id: string) {
  const key = creationKey(ownerId, id);
  return transaction<CreationProject | null>(
    ["projects"],
    "readonly",
    (tx, done) => {
      const request = tx.objectStore("projects").get(key);
      request.onsuccess = () => {
        try {
          done(
            request.result ? checkCreationDraft(request.result, ownerId) : null,
          );
        } catch {
          tx.abort();
        }
      };
    },
  );
}
export async function listCreationProjects(ownerId: string) {
  creationKey(ownerId, ownerId);
  return transaction<CreationProject[]>(
    ["projects"],
    "readonly",
    (tx, done) => {
      const request = tx
        .objectStore("projects")
        .getAll(IDBKeyRange.bound(`${ownerId}/`, `${ownerId}/\uffff`));
      request.onsuccess = () => {
        try {
          done(
            request.result
              .map((item) => checkCreationDraft(item, ownerId))
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
          );
        } catch {
          tx.abort();
        }
      };
    },
  );
}
export async function saveCreationProject(
  value: CreationProject,
  expectedRevision?: number,
) {
  const project = checkCreationDraft(value),
    key = creationKey(project.ownerId, project.id);
  return transaction<void>(
    ["projects", "attempts"],
    "readwrite",
    (tx, done) => {
      const store = tx.objectStore("projects"),
        previous = store.get(key),
        attempt = tx.objectStore("attempts").get(key);
      attempt.onsuccess = () => {
        try {
          checkCreationSave(
            project,
            previous.result || null,
            attempt.result || null,
            expectedRevision,
          );
          store.put(project, key);
          done(undefined);
        } catch {
          tx.abort();
        }
      };
    },
  );
}
export async function removeCreationProject(ownerId: string, id: string) {
  const key = creationKey(ownerId, id);
  return transaction<void>(
    ["projects", "media", "attempts", "jobs"],
    "readwrite",
    (tx, done) => {
      tx.objectStore("projects").delete(key);
      tx.objectStore("attempts").delete(key);
      tx.objectStore("jobs").delete(key);
      const request = tx
        .objectStore("media")
        .openCursor(IDBKeyRange.bound(`${key}/`, `${key}/\uffff`));
      request.onsuccess = () => {
        if (request.result) {
          request.result.delete();
          request.result.continue();
        } else done(undefined);
      };
    },
  );
}
export async function persistCreationMedia(
  ownerId: string,
  projectId: string,
  source: CreationSource,
  bytes: ArrayBuffer,
) {
  const key = creationKey(ownerId, projectId, source.id);
  checkCreationMedia(source, bytes.byteLength);
  return transaction<void>(["media"], "readwrite", (tx, done) => {
    tx.objectStore("media").add(new Blob([bytes], { type: source.mime }), key);
    done(undefined);
  });
}
export async function readCreationMedia(
  ownerId: string,
  projectId: string,
  source: CreationSource,
) {
  const key = creationKey(ownerId, projectId, source.id);
  const blob = await transaction<Blob>(["media"], "readonly", (tx, done) => {
    const read = tx.objectStore("media").get(key);
    read.onsuccess = () => done(read.result);
  });
  if (!(blob instanceof Blob))
    throw new Error(
      "Ce média n’est plus disponible sur cet appareil. Réimportez-le ou récupérez le brouillon synchronisé.",
    );
  checkCreationMedia(source, blob.size);
  return blob.arrayBuffer();
}
export async function creationMediaPreview(
  ownerId: string,
  projectId: string,
  source: CreationSource,
) {
  const bytes = await readCreationMedia(ownerId, projectId, source);
  const uri = URL.createObjectURL(new Blob([bytes], { type: source.mime }));
  return { uri, release: () => URL.revokeObjectURL(uri) };
}
export async function persistPickedCreationMedia(
  ownerId: string,
  projectId: string,
  asset: ImagePickerAsset,
): Promise<CreationSource> {
  const type = asset.type === "video" ? "video" : "image";
  const bytes = await readAsset(asset.uri, creationMediaLimit({ type }));
  let duration = type === "video" ? (asset.duration || 0) / 1000 : 0;
  let width = asset.width,
    height = asset.height;
  if (
    type === "video" &&
    (!duration || !width || !height) &&
    typeof document !== "undefined"
  ) {
    const metadata = await new Promise<{
      duration: number;
      width: number;
      height: number;
    }>((resolve, reject) => {
      const video = document.createElement("video");
      const clear = () => {
        clearTimeout(timer);
        video.onloadedmetadata = null;
        video.onerror = null;
        video.removeAttribute("src");
        video.load();
      };
      const timer = setTimeout(() => {
        clear();
        reject(
          new Error(
            "La durée de cette vidéo est indisponible. Choisissez un fichier MP4 ou MOV lisible.",
          ),
        );
      }, 10000);
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const result = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        };
        clear();
        resolve(result);
      };
      video.onerror = () => {
        clear();
        reject(
          new Error(
            "Cette vidéo ne peut pas être ouverte. Essayez un autre fichier.",
          ),
        );
      };
      video.src = asset.uri;
    });
    duration = metadata.duration;
    width = metadata.width;
    height = metadata.height;
  }
  if (
    type === "video" &&
    (!Number.isFinite(duration) || duration <= 0 || duration > 600)
  )
    throw new Error("Choisissez une vidéo lisible de 10 minutes maximum.");
  const source: CreationSource = {
    id: randomUUID(),
    type,
    name: asset.fileName || (type === "video" ? "Vidéo" : "Photo"),
    mime: creationMediaMime(bytes, type, asset.mimeType),
    size: bytes.byteLength,
    width,
    height,
    duration,
  };
  await persistCreationMedia(ownerId, projectId, source, bytes);
  return source;
}
export async function loadCreationAttempt(ownerId: string, id: string) {
  const key = creationKey(ownerId, id);
  return transaction<CreationAttempt | null>(
    ["attempts"],
    "readonly",
    (tx, done) => {
      const request = tx.objectStore("attempts").get(key);
      request.onsuccess = () => {
        try {
          done(
            request.result
              ? checkCreationAttempt(request.result, ownerId, id)
              : null,
          );
        } catch {
          tx.abort();
        }
      };
    },
  );
}
export async function saveCreationAttempt(attempt: CreationAttempt) {
  const { ownerId, id } = attempt.project,
    key = creationKey(ownerId, id);
  checkCreationAttempt(attempt, ownerId, id);
  return transaction<void>(
    ["projects", "attempts"],
    "readwrite",
    (tx, done) => {
      const project = tx.objectStore("projects").get(key),
        store = tx.objectStore("attempts"),
        read = store.get(key);
      read.onsuccess = () => {
        if (
          JSON.stringify(project.result) !== JSON.stringify(attempt.project)
        ) {
          tx.abort();
          return;
        }
        if (
          read.result &&
          JSON.stringify({ ...read.result, completed: false }) !==
            JSON.stringify({ ...attempt, completed: false })
        ) {
          tx.abort();
          return;
        }
        store.put(
          {
            ...attempt,
            completed: attempt.completed || !!read.result?.completed,
          },
          key,
        );
        done(undefined);
      };
    },
  );
}
export async function saveCreationJob(ownerId: string, job: CreationJob) {
  const key = creationKey(ownerId, job.projectId);
  creationKey(ownerId, job.id);
  const retained = {
    id: job.id,
    projectId: job.projectId,
    revision: job.revision,
    kind: job.kind,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
  };
  return transaction<void>(["jobs"], "readwrite", (tx, done) => {
    tx.objectStore("jobs").put(retained, key);
    done(undefined);
  });
}
export async function loadCreationJob(ownerId: string, projectId: string) {
  const key = creationKey(ownerId, projectId);
  return transaction<CreationJob | null>(["jobs"], "readonly", (tx, done) => {
    const read = tx.objectStore("jobs").get(key);
    read.onsuccess = () => done(read.result || null);
  });
}
