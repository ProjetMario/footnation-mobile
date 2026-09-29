import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { createPostDraftJournal } from "./postDraftJournal";
import { assertPostId, postMediaExtension, type PostDraftMedia } from "./postPublication";

function directory(userId: string) {
  assertPostId(userId);
  return new Directory(Paths.document, "post-drafts", userId);
}
function manifests(userId: string) {
  const dir = directory(userId);
  return dir.exists
    ? dir
        .list()
        .filter(
          (file): file is File =>
            file instanceof File && /^\d+\.json$/.test(file.name),
        )
        .sort(
          (a, b) => Number(b.name.split(".")[0]) - Number(a.name.split(".")[0]),
        )
    : [];
}
function read(userId: string) {
  const file = manifests(userId)[0];
  return file ? (JSON.parse(file.textSync()) as string | null) : null;
}
function mediaFile(userId: string, media: PostDraftMedia) {
  assertPostId(media.id);
  return new File(directory(userId), `${media.id}.${postMediaExtension(media)}`);
}
export const postDraftJournal = createPostDraftJournal({
  read: async (userId) => read(userId),
  swap: async (userId, expected, next) => {
    if (read(userId) !== expected)
      throw new Error(
        "Le brouillon a changé. Rechargez-le avant de réessayer.",
      );
    const dir = directory(userId);
    dir.create({ intermediates: true, idempotent: true });
    const previous = manifests(userId);
    const sequence = previous[0]
      ? Number(previous[0].name.split(".")[0]) + 1
      : 1;
    const target = new File(dir, `${sequence}.json`);
    const temp = new File(dir, `${randomUUID()}.tmp`);
    try {
      temp.write(JSON.stringify(next));
      // Expo57's move is asynchronous. A new immutable manifest keeps the
      // previous complete revision recoverable until the move has finished.
      await temp.move(target);
    } finally {
      if (temp.exists && temp.uri !== target.uri) temp.delete();
    }
    for (const old of previous) {
      try {
        old.delete();
      } catch {
        /* The newest manifest is authoritative. */
      }
    }
  },
  removeAccountMedia: async (userId) => {
    const dir = directory(userId);
    if (dir.exists) dir.delete();
  },
});
export async function persistPostMedia(
  userId: string,
  media: PostDraftMedia,
  bytes: ArrayBuffer,
) {
  postDraftJournal.assertActive(userId);
  const file = mediaFile(userId, media);
  file.parentDirectory.create({ intermediates: true, idempotent: true });
  if (file.exists) throw new Error("Cette pièce jointe existe déjà.");
  const temp = new File(file.parentDirectory, `${randomUUID()}.tmp`);
  try {
    temp.write(new Uint8Array(bytes));
    await temp.move(file);
    postDraftJournal.assertActive(userId);
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  } finally {
    if (temp.exists && temp.uri !== file.uri) temp.delete();
  }
}
export async function postMediaPreview(userId: string, media: PostDraftMedia) {
  const file = mediaFile(userId, media);
  if (!file.exists)
    throw new Error(
      "La pièce jointe de ce brouillon est indisponible sur cet appareil.",
    );
  return { uri: file.uri, release: () => {} };
}
export async function removePostMedia(userId: string, media: PostDraftMedia) {
  const file = mediaFile(userId, media);
  if (file.exists) file.delete();
}
