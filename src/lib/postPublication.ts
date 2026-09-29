export type PostDraftMedia = Readonly<{
  id: string;
  type: "image" | "video";
  mime: string;
}>;
export type PostPublicationRecord = Readonly<{
  id: string;
  user_id: string;
  content: string;
  location: string | null;
  hashtags: readonly string[];
  image_url: string | null;
  video_url: string | null;
}>;
export type PostDraft = Readonly<{
  version: 1;
  id: string;
  userId: string;
  revision: number;
  content: string;
  location: string;
  hashtags: string;
  media: PostDraftMedia | null;
  attempt: Readonly<{
    record: PostPublicationRecord;
    path: string | null;
  }> | null;
}>;
export const POST_PHOTO_LIMIT = 10 * 1024 * 1024;
export const POST_VIDEO_LIMIT = 50 * 1024 * 1024;
export function assertPostId(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new Error("Ce brouillon ne correspond pas à un compte valide.");
}
export function postMediaExtension(
  media: Pick<PostDraftMedia, "type" | "mime">,
) {
  const formats: Record<string, string> =
    media.type === "video"
      ? { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" }
      : {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/heic": "heic",
          "image/heif": "heif",
        };
  const extension = formats[media.mime];
  if (!extension)
    throw new Error("Ce format de photo ou de vidéo n’est pas pris en charge.");
  return extension;
}
export function newPostDraft(userId: string, id: string): PostDraft {
  assertPostId(userId);
  assertPostId(id);
  return {
    version: 1,
    id,
    userId,
    revision: 0,
    content: "",
    location: "",
    hashtags: "",
    media: null,
    attempt: null,
  };
}
export function validatePostDraft(value: unknown, userId: string): PostDraft {
  const draft = value as PostDraft;
  assertPostId(userId);
  if (
    !draft ||
    draft.version !== 1 ||
    draft.userId !== userId ||
    !Number.isSafeInteger(draft.revision) ||
    draft.revision < 0 ||
    typeof draft.content !== "string" ||
    typeof draft.location !== "string" ||
    typeof draft.hashtags !== "string" ||
    draft.content.length > 10000 ||
    draft.location.length > 150 ||
    draft.hashtags.length > 300
  )
    throw new Error("Impossible de récupérer ce brouillon sur cet appareil.");
  assertPostId(draft.id);
  if (draft.media) {
    assertPostId(draft.media.id);
    if (!["image", "video"].includes(draft.media.type))
      throw new Error("Pièce jointe invalide.");
    postMediaExtension(draft.media);
  }
  if (draft.attempt) {
    const expected = freezePostDraft({ ...draft, attempt: null }, (path) => {
      const url =
        draft.media?.type === "video"
          ? draft.attempt!.record.video_url
          : draft.attempt!.record.image_url;
      if (
        path !== draft.attempt!.path ||
        typeof url !== "string" ||
        !url.startsWith("https://")
      )
        throw new Error("Pièce jointe invalide.");
      return url;
    });
    if (
      !samePostPublication(expected.attempt!.record, draft.attempt.record) ||
      expected.attempt!.path !== draft.attempt.path
    )
      throw new Error(
        "La tentative conservée ne correspond plus à son contenu.",
      );
  }
  return draft;
}
export function freezePostDraft(
  draft: PostDraft,
  publicUrl: (path: string) => string,
): PostDraft {
  if (draft.attempt) return draft;
  if (!draft.content.trim() && !draft.media)
    throw new Error("Ajoutez du texte, une photo ou une vidéo.");
  const hashtags = draft.hashtags
    .split(/\s+/)
    .filter((tag) => tag.startsWith("#") && tag.length > 1);
  if (hashtags.length > 10)
    throw new Error("Vous pouvez utiliser maximum 10 hashtags.");
  const path = draft.media
    ? `${draft.media.type === "video" ? "videos" : "images"}/${draft.id}.${postMediaExtension(draft.media)}`
    : null;
  const url = path ? publicUrl(path) : null;
  return {
    ...draft,
    revision: draft.revision + 1,
    attempt: {
      path,
      record: {
        id: draft.id,
        user_id: draft.userId,
        content: draft.content.trim(),
        location: draft.location.trim() || null,
        hashtags,
        image_url: draft.media?.type === "image" ? url : null,
        video_url: draft.media?.type === "video" ? url : null,
      },
    },
  };
}
export function samePostPublication(
  expected: PostPublicationRecord,
  actual: PostPublicationRecord,
) {
  return (
    expected.id === actual.id &&
    expected.user_id === actual.user_id &&
    expected.content === actual.content &&
    (expected.location ?? null) === (actual.location ?? null) &&
    (expected.image_url ?? null) === (actual.image_url ?? null) &&
    (expected.video_url ?? null) === (actual.video_url ?? null) &&
    JSON.stringify(expected.hashtags) === JSON.stringify(actual.hashtags ?? [])
  );
}
export type PostPublicationServices = {
  assertCurrentAccount(): void;
  find(id: string): Promise<PostPublicationRecord | null>;
  upload(draft: PostDraft): Promise<void>;
  insert(record: PostPublicationRecord): Promise<void>;
};
export function createPostPublication(input: PostDraft) {
  // Keep a detached snapshot even if the caller updates its editor later.
  const draft = validatePostDraft(
    JSON.parse(JSON.stringify(input)),
    input.userId,
  );
  if (!draft.attempt)
    throw new Error("Conservez la tentative avant de l’envoyer.");
  const record = draft.attempt.record;
  let inFlight: Promise<string> | null = null;
  const verify = (row: PostPublicationRecord | null) => {
    if (!row) return false;
    if (!samePostPublication(record, row))
      throw new Error(
        "Cette tentative correspond déjà à un autre contenu. Rien n’a été remplacé.",
      );
    return true;
  };
  return {
    publish(services: PostPublicationServices): Promise<string> {
      if (inFlight) return inFlight;
      inFlight = (async () => {
        services.assertCurrentAccount();
        if (verify(await services.find(record.id))) return record.id;
        services.assertCurrentAccount();
        if (draft.media) await services.upload(draft);
        services.assertCurrentAccount();
        let insertionError: unknown;
        try {
          await services.insert(record);
        } catch (error) {
          insertionError = error;
        }
        services.assertCurrentAccount();
        // Both a timeout and a successful insert need an authoritative row before
        // the local draft is removed. A retry always queries this same UUID.
        if (!verify(await services.find(record.id)))
          throw (
            insertionError ||
            new Error(
              "La publication n’a pas encore pu être confirmée. Réessayez pour la vérifier.",
            )
          );
        return record.id;
      })().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}
