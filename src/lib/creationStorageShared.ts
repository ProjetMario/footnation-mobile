import type { CreationProject, CreationSource } from "./creationProject";
import { CREATION_LIMITS } from "./creationProject";
import { assertPostId, postMediaExtension } from "./postPublication";

export type CreationAttempt = {
  version: 1;
  project: CreationProject;
  media: CreationSource;
  sha256: string;
  createdAt: number;
  completed: boolean;
  cover?: { media: CreationSource; sha256: string };
};
export function creationKey(
  ownerId: string,
  projectId: string,
  sourceId?: string,
) {
  [ownerId, projectId, ...(sourceId ? [sourceId] : [])].forEach(assertPostId);
  return [ownerId, projectId, sourceId].filter(Boolean).join("/");
}
export function creationMediaLimit(source: Pick<CreationSource, "type">) {
  return source.type === "image"
    ? CREATION_LIMITS.photoBytes
    : CREATION_LIMITS.videoBytes;
}
export function creationMediaMime(
  bytes: ArrayBuffer,
  type: "image" | "video",
  hint?: string | null,
) {
  const prefix = String.fromCharCode(...new Uint8Array(bytes.slice(0, 32)));
  if (type === "image") {
    if (prefix.startsWith("\xff\xd8\xff")) return "image/jpeg";
    if (prefix.startsWith("\x89PNG\r\n\x1a\n")) return "image/png";
    if (prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP")
      return "image/webp";
  }
  const mime = (
    hint || (type === "image" ? "image/jpeg" : "video/mp4")
  ).toLowerCase();
  return mime === "image/jpg" ? "image/jpeg" : mime;
}
export function checkCreationMedia(
  source: CreationSource,
  byteLength?: number,
) {
  assertPostId(source.id);
  postMediaExtension(source);
  if (
    !["image", "video"].includes(source.type) ||
    !Number.isSafeInteger(source.size) ||
    source.size <= 0 ||
    source.size > creationMediaLimit(source) ||
    (byteLength !== undefined && source.size !== byteLength)
  )
    throw new Error("Ce média est vide, trop volumineux ou incomplet.");
}
export function creationSourcePath(
  ownerId: string,
  projectId: string,
  source: CreationSource,
) {
  return `${creationKey(ownerId, projectId, source.id)}.${postMediaExtension(source)}`;
}
/** Strip ephemeral picker fields: a persisted project never retains blob: URLs. */
export function checkCreationDraft(
  value: CreationProject,
  ownerId = value.ownerId,
): CreationProject {
  creationKey(ownerId, value.id);
  if (
    value.ownerId !== ownerId ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    !["post", "story", "short"].includes(value.mode) ||
    !Array.isArray(value.sources) ||
    value.sources.length > CREATION_LIMITS.sources
  )
    throw new Error("Ce brouillon ne correspond pas à ce compte.");
  const project = JSON.parse(JSON.stringify(value)) as CreationProject;
  project.sources = project.sources.map((source) => {
    checkCreationMedia(source);
    if (
      source.path &&
      source.path !== creationSourcePath(ownerId, project.id, source)
    )
      throw new Error("Le média privé ne correspond pas à ce brouillon.");
    return {
      id: source.id,
      type: source.type,
      name: source.name,
      mime: source.mime,
      size: source.size,
      width: source.width,
      height: source.height,
      duration: source.duration,
      ...(source.path ? { path: source.path } : {}),
    };
  });
  return project;
}
export function checkCreationAttempt(
  attempt: CreationAttempt,
  ownerId: string,
  projectId: string,
) {
  checkCreationDraft(attempt.project, ownerId);
  checkCreationMedia(attempt.media);
  if (attempt.cover) {
    checkCreationMedia(attempt.cover.media);
    if (
      attempt.cover.media.type !== "image" ||
      !/^[a-f0-9]{64}$/.test(attempt.cover.sha256)
    )
      throw new Error("La couverture conservée est invalide.");
  }
  if (
    attempt.version !== 1 ||
    attempt.project.id !== projectId ||
    !/^[a-f0-9]{64}$/.test(attempt.sha256) ||
    !Number.isFinite(attempt.createdAt) ||
    attempt.createdAt <= 0
  )
    throw new Error("La tentative conservée est invalide.");
  return attempt;
}
export function checkCreationSave(
  project: CreationProject,
  previous: CreationProject | null,
  attempt: CreationAttempt | null,
  expectedRevision?: number,
) {
  if (attempt && JSON.stringify(attempt.project) !== JSON.stringify(project))
    throw new Error(
      "Une publication est en cours de vérification. Réessayez la même publication avant de la modifier.",
    );
  const content = (value: CreationProject) =>
    JSON.stringify({
      ...value,
      sources: value.sources.map(({ path: _path, ...source }) => source),
    });
  if (
    (expectedRevision !== undefined &&
      (previous?.revision ?? 0) !== expectedRevision) ||
    (previous && previous.revision > project.revision) ||
    (previous &&
      previous.revision === project.revision &&
      content(previous) !== content(project))
  )
    throw new Error("Le brouillon a changé. Rechargez-le avant de réessayer.");
}
