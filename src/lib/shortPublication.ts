import { storyPhoto } from "./storyPublication";
export const MAX_SHORT_BYTES = 50 * 1024 * 1024;
export type ShortPublicationRecord = Readonly<{
  id: string;
  user_id: string;
  video_url: string;
  description: string;
  thumbnail_url?: string | null;
  music?: string | null;
  artist?: string | null;
  music_url?: string | null;
  start_time?: number | null;
  duration?: number | null;
  goal_timestamps?: readonly number[];
}>;
export type ShortPublicationDraft = Readonly<{
  record: ShortPublicationRecord;
  uri: string;
  path: string;
  mime: string;
  thumbnail?: Readonly<{ base64: string; mime: string; path: string }>;
}>;
export type ShortVideoBytes = { bytes: ArrayBuffer; sha256: string };
export type ShortPublicationServices = {
  assertCurrentAccount(): void;
  find(id: string): Promise<ShortPublicationRecord | null>;
  read(uri: string): Promise<ShortVideoBytes>;
  upload(draft: ShortPublicationDraft, content: ShortVideoBytes): Promise<void>;
  uploadThumbnail?(draft: ShortPublicationDraft): Promise<void>;
  insert(record: ShortPublicationRecord): Promise<void>;
};

export function shortVideoExtension(mime: string): string {
  const extension = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  }[mime];
  if (!extension)
    throw new Error("Cette vidéo doit être au format MP4, MOV ou WebM.");
  return extension;
}

export function sameShortPublication(
  expected: ShortPublicationRecord,
  actual: ShortPublicationRecord,
): boolean {
  return (
    expected.id === actual.id &&
    expected.user_id === actual.user_id &&
    expected.video_url === actual.video_url &&
    expected.description === actual.description &&
    (expected.thumbnail_url ?? null) === (actual.thumbnail_url ?? null) &&
    (expected.music ?? null) === (actual.music ?? null) &&
    (expected.artist ?? null) === (actual.artist ?? null) &&
    (expected.music_url ?? null) === (actual.music_url ?? null) &&
    (expected.start_time ?? 0) === (actual.start_time ?? 0) &&
    (expected.duration ?? null) === (actual.duration ?? null) &&
    JSON.stringify(expected.goal_timestamps ?? []) ===
      JSON.stringify(actual.goal_timestamps ?? [])
  );
}

/** One user-confirmed attempt. A retry never invents another row or media path. */
export function createShortPublication(input: ShortPublicationDraft) {
  if (
    input.thumbnail &&
    storyPhoto(input.thumbnail.base64).mime !== input.thumbnail.mime
  )
    throw new Error(
      "La miniature doit être une photo valide de 10 Mo maximum.",
    );
  const draft = Object.freeze({
    ...input,
    thumbnail: input.thumbnail
      ? Object.freeze({ ...input.thumbnail })
      : undefined,
    record: Object.freeze({
      ...input.record,
      ...(input.record.goal_timestamps
        ? { goal_timestamps: Object.freeze([...input.record.goal_timestamps]) }
        : {}),
    }),
  });
  let content: ShortVideoBytes | undefined;
  let uploaded = false;
  let complete = false;
  let thumbnailUploaded = false;
  let inFlight: Promise<string> | null = null;
  const verify = (row: ShortPublicationRecord | null) => {
    if (!row) return false;
    if (!sameShortPublication(draft.record, row))
      throw new Error(
        "Cette tentative correspond déjà à un autre contenu. Elle n’a pas été remplacée.",
      );
    complete = true;
    return true;
  };
  return {
    draft,
    publish(services: ShortPublicationServices): Promise<string> {
      // This lock is synchronous, including two presses before React rerenders.
      if (inFlight) return inFlight;
      inFlight = (async () => {
        services.assertCurrentAccount();
        if (complete || verify(await services.find(draft.record.id)))
          return draft.record.id;
        if (!uploaded) {
          content ??= await services.read(draft.uri);
          services.assertCurrentAccount();
          await services.upload(draft, content);
          uploaded = true;
        }
        if (draft.thumbnail && !thumbnailUploaded) {
          services.assertCurrentAccount();
          if (!services.uploadThumbnail)
            throw new Error("L’envoi de la miniature est indisponible.");
          await services.uploadThumbnail(draft);
          thumbnailUploaded = true;
        }
        services.assertCurrentAccount();
        try {
          await services.insert(draft.record);
          complete = true;
        } catch (error) {
          // Even a rejected response may hide an already committed insertion.
          // Never remove its video. Read exactly this row before reporting failure.
          services.assertCurrentAccount();
          if (!verify(await services.find(draft.record.id))) throw error;
        }
        return draft.record.id;
      })().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}
