import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import type { ImagePickerAsset } from "expo-image-picker";
import type {
  CreationJob,
  CreationProject,
  CreationSource,
} from "./creationProject";
import { postMediaExtension } from "./postPublication";
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

const locks = new Map<string, Promise<unknown>>();
function serial<T>(key: string, task: () => Promise<T>) {
  const previous = locks.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  locks.set(key, next);
  void next
    .finally(() => {
      if (locks.get(key) === next) locks.delete(key);
    })
    .catch(() => {});
  return next;
}
function directory(ownerId: string, projectId: string) {
  creationKey(ownerId, projectId);
  return new Directory(Paths.document, "creation-studio", ownerId, projectId);
}
function versions(dir: Directory, kind: string) {
  return dir.exists
    ? dir
        .list()
        .filter(
          (file): file is File =>
            file instanceof File &&
            new RegExp(`^${kind}-[0-9]+\\.json$`).test(file.name),
        )
        .sort(
          (a, b) =>
            Number(b.name.split("-")[1].split(".")[0]) -
            Number(a.name.split("-")[1].split(".")[0]),
        )
    : [];
}
function read<T>(dir: Directory, kind: string): T | null {
  const file = versions(dir, kind)[0];
  return file ? (JSON.parse(file.textSync()) as T) : null;
}
async function write(dir: Directory, kind: string, value: unknown) {
  dir.create({ intermediates: true, idempotent: true });
  const previous = versions(dir, kind),
    sequence = previous.length
      ? Number(previous[0].name.split("-")[1].split(".")[0]) + 1
      : 1;
  const file = new File(dir, `${kind}-${sequence}.json`),
    temp = new File(dir, `${randomUUID()}.tmp`);
  try {
    temp.write(JSON.stringify(value));
    await temp.move(file);
  } finally {
    if (temp.exists && temp.uri !== file.uri) temp.delete();
  }
  for (const old of previous) {
    try {
      old.delete();
    } catch {
      /* Newest immutable manifest remains authoritative. */
    }
  }
}
export async function loadCreationProject(ownerId: string, id: string) {
  const project = read<CreationProject>(directory(ownerId, id), "project");
  return project ? checkCreationDraft(project, ownerId) : null;
}
export async function listCreationProjects(ownerId: string) {
  creationKey(ownerId, ownerId);
  const root = new Directory(Paths.document, "creation-studio", ownerId);
  const projects: CreationProject[] = [];
  if (root.exists)
    for (const child of root.list()) {
      if (child instanceof Directory && /^[0-9a-f-]{36}$/i.test(child.name)) {
        const project = await loadCreationProject(ownerId, child.name);
        if (project) projects.push(project);
      }
    }
  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function saveCreationProject(
  value: CreationProject,
  expectedRevision?: number,
) {
  const project = checkCreationDraft(value),
    key = creationKey(project.ownerId, project.id);
  return serial(key, async () => {
    const dir = directory(project.ownerId, project.id);
    checkCreationSave(
      project,
      read(dir, "project"),
      read(dir, "attempt"),
      expectedRevision,
    );
    await write(dir, "project", project);
  });
}
export async function removeCreationProject(ownerId: string, id: string) {
  return serial(creationKey(ownerId, id), async () => {
    const dir = directory(ownerId, id);
    if (dir.exists) dir.delete();
  });
}
function mediaFile(ownerId: string, projectId: string, source: CreationSource) {
  creationKey(ownerId, projectId, source.id);
  return new File(
    directory(ownerId, projectId),
    `${source.id}.${postMediaExtension(source)}`,
  );
}
export async function persistCreationMedia(
  ownerId: string,
  projectId: string,
  source: CreationSource,
  bytes: ArrayBuffer,
) {
  checkCreationMedia(source, bytes.byteLength);
  return serial(creationKey(ownerId, projectId), async () => {
    const file = mediaFile(ownerId, projectId, source);
    file.parentDirectory.create({ intermediates: true, idempotent: true });
    if (file.exists) throw new Error("Ce média est déjà conservé.");
    const temp = new File(file.parentDirectory, `${randomUUID()}.tmp`);
    try {
      temp.write(new Uint8Array(bytes));
      await temp.move(file);
    } finally {
      if (temp.exists && temp.uri !== file.uri) temp.delete();
    }
  });
}
export async function readCreationMedia(
  ownerId: string,
  projectId: string,
  source: CreationSource,
) {
  const file = mediaFile(ownerId, projectId, source);
  if (!file.exists)
    throw new Error(
      "Ce média n’est plus disponible sur cet appareil. Réimportez-le ou récupérez le brouillon synchronisé.",
    );
  checkCreationMedia(source, file.size);
  return file.arrayBuffer();
}
export async function creationMediaPreview(
  ownerId: string,
  projectId: string,
  source: CreationSource,
) {
  const file = mediaFile(ownerId, projectId, source);
  if (!file.exists)
    throw new Error("Ce média n’est plus disponible sur cet appareil.");
  checkCreationMedia(source, file.size);
  return { uri: file.uri, release: () => {} };
}
export async function persistPickedCreationMedia(
  ownerId: string,
  projectId: string,
  asset: ImagePickerAsset,
): Promise<CreationSource> {
  const type = asset.type === "video" ? "video" : "image";
  let selected = asset;
  if (
    type === "image" &&
    (/hei[cf]/i.test(asset.mimeType || asset.fileName || "") ||
      Math.max(asset.width, asset.height) > 4096)
  ) {
    const { ImageManipulator, SaveFormat } =
      await import("expo-image-manipulator");
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > 4096)
      context.resize(
        asset.width >= asset.height ? { width: 4096 } : { height: 4096 },
      );
    const image = await context.renderAsync();
    const portable = await image.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.95,
    });
    selected = {
      ...asset,
      uri: portable.uri,
      width: portable.width,
      height: portable.height,
      mimeType: "image/jpeg",
    };
  }
  const bytes = await readAsset(selected.uri, creationMediaLimit({ type }));
  const duration = type === "video" ? (asset.duration || 0) / 1000 : 0;
  if (
    type === "video" &&
    (!Number.isFinite(duration) || duration <= 0 || duration > 600)
  )
    throw new Error("Choisissez une vidéo lisible de 10 minutes maximum.");
  const source: CreationSource = {
    id: randomUUID(),
    type,
    name: asset.fileName || (type === "video" ? "Vidéo" : "Photo"),
    mime: creationMediaMime(bytes, type, selected.mimeType),
    size: bytes.byteLength,
    width: selected.width,
    height: selected.height,
    duration,
  };
  await persistCreationMedia(ownerId, projectId, source, bytes);
  return source;
}
export async function loadCreationAttempt(ownerId: string, id: string) {
  const attempt = read<CreationAttempt>(directory(ownerId, id), "attempt");
  return attempt ? checkCreationAttempt(attempt, ownerId, id) : null;
}
export async function saveCreationAttempt(attempt: CreationAttempt) {
  const { ownerId, id } = attempt.project;
  checkCreationAttempt(attempt, ownerId, id);
  return serial(creationKey(ownerId, id), async () => {
    const dir = directory(ownerId, id),
      previous = read<CreationAttempt>(dir, "attempt");
    if (
      JSON.stringify(read(dir, "project")) !== JSON.stringify(attempt.project)
    )
      throw new Error("Le brouillon a changé avant sa publication.");
    if (
      previous &&
      JSON.stringify({ ...previous, completed: false }) !==
        JSON.stringify({ ...attempt, completed: false })
    )
      throw new Error(
        "Une autre publication est déjà en cours de vérification.",
      );
    await write(dir, "attempt", {
      ...attempt,
      completed: attempt.completed || !!previous?.completed,
    });
  });
}
export async function saveCreationJob(ownerId: string, job: CreationJob) {
  const key = creationKey(ownerId, job.projectId);
  creationKey(ownerId, job.id);
  return serial(key, async () =>
    write(directory(ownerId, job.projectId), "job", {
      id: job.id,
      projectId: job.projectId,
      revision: job.revision,
      kind: job.kind,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
    }),
  );
}
export async function loadCreationJob(ownerId: string, projectId: string) {
  return read<CreationJob>(directory(ownerId, projectId), "job");
}
