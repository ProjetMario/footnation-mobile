import { normalizeStoryFilters, type StoryFilters } from "./storyFilters";

export const MAX_STORY_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_STORY_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_STORY_BYTES = MAX_STORY_VIDEO_BYTES;
export const STORY_LIFETIME = 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type StoryPublicationRecord = {
  id: string;
  user_id: string;
  media_url: string;
  caption: string;
  location: string | null;
  hashtags: string[];
  filters: StoryFilters;
  expires_at: string;
};
export type StoryPublicationDraft = {
  version: 1;
  record: StoryPublicationRecord;
  base64: string;
  mime: string;
  path: string;
  mediaKind?: "image" | "video";
  createdAt: number;
};
export type StoryPublicationJournal = {
  save(draft: StoryPublicationDraft): Promise<void>;
  remove(draft: StoryPublicationDraft): Promise<void>;
};
export type StoryPublicationServices = {
  assertCurrentAccount(): void;
  now(): number;
  find(id: string): Promise<StoryPublicationRecord | null>;
  upload(draft: StoryPublicationDraft): Promise<void>;
  insert(record: StoryPublicationRecord): Promise<void>;
};

function validateBase64Media(base64: unknown) {
  if (
    typeof base64 !== "string" ||
    !base64.length ||
    base64.length % 4 ||
    base64.length > Math.ceil(MAX_STORY_BYTES / 3) * 4 ||
    /[^A-Za-z0-9+/=]/.test(base64)
  )
    throw new Error("Choisissez une photo ou une vidéo valide de 50 Mo maximum.");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0,
    bytes = (base64.length / 4) * 3 - padding;
  if (base64.slice(0, base64.length - padding).includes("=") || bytes <= 0)
    throw new Error("Choisissez une photo ou une vidéo valide de 50 Mo maximum.");
  if (bytes > MAX_STORY_BYTES)
    throw new Error("Choisissez une photo ou une vidéo valide de 50 Mo maximum.");
  return { base64, bytes };
}

export function storyMedia(base64: unknown, hintedMime?: string | null) {
  const valid = validateBase64Media(base64);
  const prefix = atob(valid.base64.slice(0, 64));
  // ImagePicker may return JPEG base64 for a HEIC original. Use the encoded
  // bytes for Content-Type and extension, not the source asset's MIME label.
  const photo = prefix.startsWith("\xff\xd8\xff")
    ? { kind: "image" as const, mime: "image/jpeg", ext: "jpg" }
    : prefix.startsWith("\x89PNG\r\n\x1a\n")
      ? { kind: "image" as const, mime: "image/png", ext: "png" }
      : prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP"
        ? { kind: "image" as const, mime: "image/webp", ext: "webp" }
        : prefix.slice(4, 8) === "ftyp" &&
            /^(heic|heix|hevc|hevx)$/.test(prefix.slice(8, 12))
          ? { kind: "image" as const, mime: "image/heic", ext: "heic" }
          : prefix.slice(4, 8) === "ftyp" &&
              /^(mif1|msf1)$/.test(prefix.slice(8, 12))
            ? { kind: "image" as const, mime: "image/heif", ext: "heif" }
            : null;
  if (photo) {
    if (valid.bytes > MAX_STORY_IMAGE_BYTES)
      throw new Error("Choisissez une photo valide de 10 Mo maximum.");
    return photo;
  }
  const brand = prefix.slice(8, 16),
    hinted = (hintedMime || "").toLowerCase();
  const video =
    prefix.slice(4, 8) === "ftyp"
      ? brand.includes("qt") || hinted.includes("quicktime")
        ? { kind: "video" as const, mime: "video/quicktime", ext: "mov" }
        : { kind: "video" as const, mime: "video/mp4", ext: "mp4" }
      : prefix.startsWith("\x1aE\xdf\xa3")
        ? { kind: "video" as const, mime: "video/webm", ext: "webm" }
        : null;
  if (video) return video;
  throw new Error("Choisissez une photo JPEG, PNG, WebP ou HEIC, ou une vidéo MP4, MOV ou WebM.");
}

export function storyPhoto(base64: unknown) {
  const media = storyMedia(base64);
  if (media.kind !== "image")
    throw new Error("Choisissez une photo JPEG, PNG, WebP ou HEIC.");
  return media;
}

export function storyPublicationKey(userId: string) {
  if (!uuid.test(userId)) throw new Error("Compte invalide.");
  return `story-publication.${userId}`;
}

export function validateStoryPublication(
  value: unknown,
  userId: string,
): StoryPublicationDraft {
  storyPublicationKey(userId);
  const draft = value as StoryPublicationDraft | null;
  if (
    !draft ||
    draft.version !== 1 ||
    !draft.record ||
    draft.record.user_id !== userId ||
    !uuid.test(draft.record.id)
  )
    throw new Error("La tentative conservée ne correspond pas à ce compte.");
  const media = storyMedia(draft.base64, draft.mime),
    record = draft.record;
  if (
    draft.mime !== media.mime ||
    draft.path !== `stories/${userId}-${record.id}.${media.ext}` ||
    (!!draft.mediaKind && draft.mediaKind !== media.kind) ||
    !Number.isFinite(draft.createdAt) ||
    draft.createdAt <= 0 ||
    Date.parse(record.expires_at) !== draft.createdAt + STORY_LIFETIME ||
    typeof record.media_url !== "string" ||
    !/^https?:\/\//.test(record.media_url) ||
    typeof record.caption !== "string" ||
    record.caption.length > 2000 ||
    (record.location !== null &&
      (typeof record.location !== "string" || record.location.length > 150)) ||
    !Array.isArray(record.hashtags) ||
    record.hashtags.some(
      (tag) => typeof tag !== "string" || !tag || /\s/.test(tag),
    ) ||
    record.hashtags.join(" ").length > 300 ||
    JSON.stringify(record.filters) !==
      JSON.stringify(normalizeStoryFilters(record.filters))
  )
    throw new Error(
      "La tentative conservée est invalide. Elle n’a pas été envoyée.",
    );
  return {
    version: 1,
    base64: draft.base64,
    mime: media.mime,
    path: draft.path,
    mediaKind: media.kind,
    createdAt: draft.createdAt,
    record: {
      id: record.id,
      user_id: userId,
      media_url: record.media_url,
      caption: record.caption,
      location: record.location,
      hashtags: [...record.hashtags],
      filters: normalizeStoryFilters(record.filters),
      expires_at: record.expires_at,
    },
  };
}

export function sameStoryPublication(
  a: StoryPublicationRecord,
  b: StoryPublicationRecord,
) {
  return (
    a.id === b.id &&
    a.user_id === b.user_id &&
    a.media_url === b.media_url &&
    a.caption === b.caption &&
    a.location === b.location &&
    Date.parse(a.expires_at) === Date.parse(b.expires_at) &&
    JSON.stringify(a.hashtags) === JSON.stringify(b.hashtags) &&
    JSON.stringify(a.filters) ===
      JSON.stringify(normalizeStoryFilters(b.filters))
  );
}

export function createStoryPublication(
  value: StoryPublicationDraft,
  journal: StoryPublicationJournal,
) {
  const draft = validateStoryPublication(value, value.record.user_id);
  Object.freeze(draft.record.filters);
  Object.freeze(draft.record.hashtags);
  Object.freeze(draft.record);
  Object.freeze(draft);
  let uploaded = false;
  let inFlight: Promise<string> | null = null;
  let discarding: Promise<{ published: boolean }> | null = null;
  const match = (row: StoryPublicationRecord | null) => {
    if (row && !sameStoryPublication(draft.record, row))
      throw new Error(
        "Cette tentative correspond à un autre contenu. Il n’a pas été remplacé.",
      );
    return !!row;
  };
  const assertNotExpired = (services: StoryPublicationServices) => {
    if (services.now() >= Date.parse(draft.record.expires_at))
      throw new Error(
        "Cette tentative a expiré. Abandonnez-la puis créez une nouvelle story.",
      );
  };
  return {
    draft,
    publish(services: StoryPublicationServices) {
      if (inFlight) return inFlight;
      if (discarding)
        return Promise.reject(
          new Error("La vérification de cette tentative est en cours."),
        );
      inFlight = (async () => {
        services.assertCurrentAccount();
        // Durable save must succeed before any publication request.
        await journal.save(draft);
        services.assertCurrentAccount();
        if (!match(await services.find(draft.record.id))) {
          // Existing expired stories are still recognized above. An absent
          // story keeps its original deadline; retry never silently renews it.
          assertNotExpired(services);
          if (!uploaded) {
            await services.upload(draft);
            uploaded = true;
          }
          services.assertCurrentAccount();
          assertNotExpired(services);
          try {
            await services.insert(draft.record);
          } catch (error) {
            services.assertCurrentAccount();
            if (!match(await services.find(draft.record.id))) throw error;
          }
        }
        await journal.remove(draft);
        return draft.record.id;
      })().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    discard(services: StoryPublicationServices) {
      if (inFlight)
        return Promise.reject(new Error("La publication est encore en cours."));
      if (discarding) return discarding;
      discarding = (async () => {
        services.assertCurrentAccount();
        // Explicit discard may abandon a local snapshot even when its own
        // published story was subsequently edited elsewhere. Never replace it.
        const existing = await services.find(draft.record.id);
        const published =
          !!existing && existing.user_id === draft.record.user_id;
        services.assertCurrentAccount();
        await journal.remove(draft);
        return { published };
      })().finally(() => {
        discarding = null;
      });
      return discarding;
    },
  };
}
