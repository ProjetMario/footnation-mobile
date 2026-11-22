import { randomUUID } from "expo-crypto";
import type {
  CreationJob,
  CreationMode,
  CreationProject,
  CreationSource,
} from "./creationProject";
import {
  creationDuration,
  needsCreationRender,
  validateCreationProject,
} from "./creationProject";
import {
  createCreationApi,
  creationChecksum,
  frozenCreationClient,
  readCreationRemote,
  type CreationProgress,
} from "./creationApi";
import { checkCreationDraft } from "./creationStorageShared";
import {
  loadCreationAttempt,
  saveCreationAttempt,
  saveCreationProject,
  readCreationMedia,
  persistCreationMedia,
  type CreationAttempt,
} from "./creationStorage";
import {
  createPostPublication,
  freezePostDraft,
  newPostDraft,
} from "./postPublication";
import { postPublicationServices } from "./postPublicationServices";
import {
  createStoryPublication,
  storyMedia,
  STORY_LIFETIME,
} from "./storyPublication";
import { storyPublicationServices } from "./storyPublicationServices";
import {
  createShortPublication,
  shortVideoExtension,
} from "./shortPublication";
import { shortPublicationServices } from "./shortPublicationServices";
import { DEFAULT_STORY_FILTERS } from "./storyFilters";

const pending = new Map<string, Promise<{ id: string; mode: CreationMode }>>();

export function creationPublicationNeedsProfile(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const failure = error as { code?: unknown; message?: unknown };
  return (
    failure.code === "23503" &&
    typeof failure.message === "string" &&
    /(?:posts|shorts|stories)_user_id_fkey/.test(failure.message)
  );
}

/** PostgREST and Storage failures are often plain objects, not Error instances. */
export function creationPublicationErrorMessage(error: unknown): string {
  const failure =
    error && typeof error === "object"
      ? (error as { code?: unknown; message?: unknown; status?: unknown })
      : null;
  const code = typeof failure?.code === "string" ? failure.code : "";
  const message = typeof failure?.message === "string" ? failure.message : "";
  if (
    ["PGRST301", "PGRST302", "PGRST303"].includes(code) ||
    failure?.status === 401
  )
    return "Votre session a expiré. Reconnectez-vous puis vérifiez l’envoi : votre brouillon est conservé.";
  if (code === "23503")
    return creationPublicationNeedsProfile(error)
      ? "Complétez votre profil pour publier. Votre média et votre brouillon sont conservés."
      : "Un élément lié à cette publication n’est plus disponible. Réessayez l’envoi : votre brouillon est conservé.";
  if (
    /failed to fetch|network request failed|networkerror|timed? ?out/i.test(
      message,
    )
  )
    return "La connexion a été interrompue. Vérifiez votre connexion puis réessayez l’envoi : votre brouillon est conservé.";
  // Never put database constraint names, SQL or server internals in the editor.
  if (code || (typeof failure?.status === "number" && failure.status >= 400))
    return "La publication n’a pas pu être enregistrée. Réessayez l’envoi : votre brouillon est conservé.";
  return error instanceof Error && error.message
    ? error.message
    : "Cette opération n’a pas abouti. Réessayez, votre brouillon est conservé.";
}

export function creationBase64(bytes: ArrayBuffer) {
  const array = new Uint8Array(bytes);
  let text = "";
  for (let index = 0; index < array.length; index += 8192)
    text += String.fromCharCode(...array.subarray(index, index + 8192));
  return btoa(text);
}
function hashtags(value: string) {
  const tags = [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, ""))
        .filter(Boolean)
        .map((tag) => `#${tag}`),
    ),
  ];
  if (tags.length > 10 || tags.join(" ").length > 300)
    throw new Error(
      "Vous pouvez ajouter 10 hashtags et 300 caractères maximum.",
    );
  return tags;
}
export function assertCreationRender(
  project: CreationProject,
  job?: CreationJob,
): asserts job is CreationJob {
  if (
    !job ||
    job.projectId !== project.id ||
    job.revision !== project.revision ||
    job.kind !== "render" ||
    job.status !== "succeeded" ||
    !job.result?.path
  )
    throw new Error("Finalisez le montage de cette version avant de publier.");
}
async function prepareAttempt(
  project: CreationProject,
  guard: () => void,
  renderJob?: CreationJob,
  progress?: CreationProgress,
): Promise<CreationAttempt> {
  const existing = await loadCreationAttempt(project.ownerId, project.id);
  guard();
  if (existing) {
    if (JSON.stringify(existing.project) !== JSON.stringify(project))
      throw new Error(
        "Une publication est en cours de vérification. Réessayez la même version avant de la modifier.",
      );
    return existing;
  }
  const validation = validateCreationProject(project);
  if (validation) throw new Error(validation);
  hashtags(project.hashtags);
  await saveCreationProject(project);
  guard();
  let media: CreationSource,
    bytes: ArrayBuffer,
    cover: CreationAttempt["cover"];
  if (needsCreationRender(project)) {
    assertCreationRender(project, renderJob);
    progress?.("Finalisation", 0);
    const api = await createCreationApi(project.ownerId, guard);
    // Fetch fresh authoritative job state; a caller cannot substitute another file.
    const fresh = await api.job(renderJob.id);
    assertCreationRender(project, fresh);
    const preview = await api.outputPreview(fresh);
    bytes = await readCreationRemote(preview.uri, 50 * 1024 * 1024);
    guard();
    media = {
      id: randomUUID(),
      type: "video",
      name: "Montage.mp4",
      mime: "video/mp4",
      size: bytes.byteLength,
      width: 0,
      height: 0,
      duration: creationDuration(project),
    };
    await persistCreationMedia(project.ownerId, project.id, media, bytes);
    if (project.mode === "short" && fresh.result?.coverPath) {
      const preview = await api.coverPreview(fresh),
        coverBytes = await readCreationRemote(preview.uri, 10 * 1024 * 1024);
      guard();
      const coverMedia: CreationSource = {
        id: randomUUID(),
        type: "image",
        name: "Couverture.jpg",
        mime: "image/jpeg",
        size: coverBytes.byteLength,
        width: 0,
        height: 0,
        duration: 0,
      };
      await persistCreationMedia(
        project.ownerId,
        project.id,
        coverMedia,
        coverBytes,
      );
      cover = { media: coverMedia, sha256: await creationChecksum(coverBytes) };
    }
  } else {
    media = project.sources.find(
      (source) => source.id === project.clips[0]?.sourceId,
    )!;
    try {
      bytes = await readCreationMedia(project.ownerId, project.id, media);
    } catch (error) {
      if (!media.path) throw error;
      const api = await createCreationApi(project.ownerId, guard),
        preview = await api.sourcePreview(project.id, media);
      preview.release();
      bytes = await readCreationMedia(project.ownerId, project.id, media);
    }
  }
  guard();
  const sha256 = await creationChecksum(bytes);
  guard();
  const attempt: CreationAttempt = {
    version: 1,
    project,
    media,
    sha256,
    createdAt: Date.now(),
    completed: false,
    ...(cover ? { cover } : {}),
  };
  // This immutable journal precedes the first public media/row write.
  await saveCreationAttempt(attempt);
  guard();
  return attempt;
}
export function publishCreationProject(
  value: CreationProject,
  guard: () => void,
  renderJob?: CreationJob,
  progress?: CreationProgress,
) {
  const project = checkCreationDraft(value),
    key = `${project.ownerId}/${project.id}`;
  guard();
  const running = pending.get(key);
  if (running) return running;
  const promise = (async () => {
    const attempt = await prepareAttempt(project, guard, renderJob, progress);
    guard();
    if (attempt.completed) return { id: project.id, mode: project.mode };
    const { client } = await frozenCreationClient(project.ownerId, guard);
    const bytes = await readCreationMedia(
      project.ownerId,
      project.id,
      attempt.media,
    );
    if ((await creationChecksum(bytes)) !== attempt.sha256)
      throw new Error(
        "Le média conservé a changé. Cette tentative n’a pas été envoyée.",
      );
    guard();
    progress?.("Publication", 0.25);
    if (project.mode === "post") {
      const bucket = client.storage.from("post-media");
      const draft = freezePostDraft(
        {
          ...newPostDraft(project.ownerId, project.id),
          content: project.caption,
          location: project.location,
          hashtags: hashtags(project.hashtags).join(" "),
          media: {
            id: attempt.media.id,
            type: attempt.media.type,
            mime: attempt.media.mime,
          },
        },
        (path) => bucket.getPublicUrl(path).data.publicUrl,
      );
      const services = await postPublicationServices(project.ownerId, guard);
      services.upload = async (snapshot) => {
        guard();
        if (!snapshot.attempt?.path) throw new Error("Média manquant.");
        const path = snapshot.attempt.path;
        const result = await bucket.upload(path, bytes, {
          contentType: attempt.media.mime,
          upsert: false,
          metadata: { postId: project.id, sha256: attempt.sha256 },
        });
        guard();
        if (!result.error) return;
        const existing = await bucket.info(path);
        guard();
        if (
          existing.error ||
          existing.data?.size !== bytes.byteLength ||
          existing.data?.metadata?.postId !== project.id ||
          existing.data?.metadata?.sha256 !== attempt.sha256
        )
          throw new Error(
            "L’envoi du média n’a pas pu être confirmé. Réessayez la même publication.",
          );
      };
      await createPostPublication(draft).publish(services);
    } else if (project.mode === "story") {
      const base64 = creationBase64(bytes),
        format = storyMedia(base64, attempt.media.mime);
      const path = `stories/${project.ownerId}-${project.id}.${format.ext}`;
      const draft = {
        version: 1 as const,
        base64,
        mime: format.mime,
        path,
        mediaKind: format.kind,
        createdAt: attempt.createdAt,
        record: {
          id: project.id,
          user_id: project.ownerId,
          media_url: client.storage.from("avatars").getPublicUrl(path).data
            .publicUrl,
          caption: project.caption.trim(),
          location: project.location.trim() || null,
          hashtags: hashtags(project.hashtags),
          filters: DEFAULT_STORY_FILTERS,
          expires_at: new Date(
            attempt.createdAt + STORY_LIFETIME,
          ).toISOString(),
        },
      };
      const services = await storyPublicationServices(project.ownerId, guard);
      await createStoryPublication(draft, {
        save: async () => {
          guard();
          await saveCreationAttempt(attempt);
        },
        remove: async () => {},
      }).publish(services);
    } else {
      if (attempt.media.type !== "video")
        throw new Error(
          "Un short doit être une vidéo. Utilisez Auto Cut pour monter vos photos.",
        );
      const path = `${project.ownerId}/${project.id}.${shortVideoExtension(attempt.media.mime)}`;
      const services = await shortPublicationServices(project.ownerId, guard);
      services.read = async () => {
        guard();
        return { bytes, sha256: attempt.sha256 };
      };
      let thumbnail: { base64: string; mime: string; path: string } | undefined;
      if (attempt.cover) {
        const coverBytes = await readCreationMedia(
          project.ownerId,
          project.id,
          attempt.cover.media,
        );
        if ((await creationChecksum(coverBytes)) !== attempt.cover.sha256)
          throw new Error("La couverture conservée a changé.");
        thumbnail = {
          base64: creationBase64(coverBytes),
          mime: attempt.cover.media.mime,
          path: `${project.ownerId}/${project.id}-cover.jpg`,
        };
      }
      // All edit decisions are baked in the rendered file. Playback receives no
      // extra music/trim effect, preventing duplicated audio and double cuts.
      await createShortPublication({
        uri: `creation:${project.id}`,
        path,
        mime: attempt.media.mime,
        ...(thumbnail ? { thumbnail } : {}),
        record: {
          id: project.id,
          user_id: project.ownerId,
          video_url: client.storage.from("shorts").getPublicUrl(path).data
            .publicUrl,
          ...(thumbnail
            ? {
                thumbnail_url: client.storage
                  .from("shorts")
                  .getPublicUrl(thumbnail.path).data.publicUrl,
              }
            : {}),
          description: [
            project.caption.trim(),
            hashtags(project.hashtags).join(" "),
          ]
            .filter(Boolean)
            .join("\n"),
          start_time: 0,
          duration: attempt.media.duration,
          music_url: null,
          goal_timestamps: [],
        },
      }).publish(services);
    }
    guard();
    await saveCreationAttempt({ ...attempt, completed: true });
    guard();
    progress?.("Publication", 1);
    return { id: project.id, mode: project.mode };
  })().finally(() => {
    pending.delete(key);
  });
  pending.set(key, promise);
  return promise;
}
