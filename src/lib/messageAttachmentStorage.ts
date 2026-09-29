import { Directory, File, Paths } from "expo-file-system";
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
import {
  ensureMessageUpload,
  isOwnedMessageDraft,
} from "./messageAttachmentUpload";

const forgottenAccounts = new Set<string>();
function requireRetainedAccount(uid: string) {
  if (forgottenAccounts.has(uid))
    throw new Error(
      "Ce compte a été supprimé. Aucun fichier ne sera conservé.",
    );
}

function draftDirectory(uid: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)
  )
    throw new Error("Compte invalide.");
  return new Directory(Paths.document, "message-drafts", uid);
}
export async function retainMessageFile(
  uid: string,
  file: LocalMessageFile,
): Promise<LocalMessageFile> {
  requireRetainedAccount(uid);
  const ext = attachmentTypes[file.mime];
  const source = new File(file.uri);
  if (
    !ext ||
    !source.exists ||
    source.size <= 0 ||
    source.size > MAX_MESSAGE_FILE_BYTES
  )
    throw new Error(
      "Choisissez une image, un PDF, une vidéo MP4 ou un fichier audio de 10 Mo maximum.",
    );
  const dir = draftDirectory(uid);
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `${randomUUID()}.${ext}`);
  const size = source.size;
  try {
    // Expo 57 copies asynchronously. Keep the source until the private copy is
    // complete, and reject any copy finishing after account deletion.
    await source.copy(target);
    requireRetainedAccount(uid);
    if (!target.exists || target.size !== size)
      throw new Error(
        "La copie du fichier est incomplète. Choisissez-le à nouveau.",
      );
    return {
      ...file,
      uri: target.uri,
      size: target.size,
      name:
        file.name
          .replace(/[\x00-\x1f\x7f/\\]/g, "_")
          .trim()
          .slice(0, 120) || `fichier.${ext}`,
    };
  } catch (error) {
    // This target was allocated by this call; never remove the selected source
    // or another account's existing draft after a failed/late copy.
    try {
      if (target.exists) target.delete();
    } catch {
      /* OS cleanup can follow. */
    }
    throw error;
  }
}
/** Only after a confirmed account deletion; excludes every other account directory. */
export async function forgetMessageAttachmentFiles(uid: string): Promise<void> {
  const dir = draftDirectory(uid);
  forgottenAccounts.add(uid);
  if (dir.exists) dir.delete();
}
export function discardMessageFile(uid: string, uri?: string) {
  if (!uri) return;
  try {
    if (!isOwnedMessageDraft(draftDirectory(uid).uri, uri)) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cleanup must never turn an acknowledged message into an apparent send failure.
  }
}
/** Only cache copies created by DocumentPicker/AudioRecorder may be removed here. */
export function discardMessageCacheFile(uri?: string | null) {
  if (!uri) return;
  const prefix = `${Paths.cache.uri.replace(/\/$/, "")}/`;
  try {
    const decoded = decodeURIComponent(uri);
    if (!uri.startsWith(prefix) || decoded.split("/").includes("..")) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* The OS can also evict temporary cache copies. */
  }
}
export async function uploadMessageFile(
  uid: string,
  attachment: MessageAttachment,
  uri: string,
) {
  requireRetainedAccount(uid);
  if (!isOwnedMessageDraft(draftDirectory(uid).uri, uri))
    throw new Error(
      "Le fichier ne correspond pas aux brouillons de ce compte.",
    );
  const parts = attachment.path.split("/");
  normalizeAttachment(attachment, uid, parts[1], parts[2]);
  const bucket = supabase.storage.from(MESSAGE_ATTACHMENT_BUCKET);
  await ensureMessageUpload(attachment, {
    requireUser: async () => {
      requireRetainedAccount(uid);
      const auth = await supabase.auth.getUser();
      requireRetainedAccount(uid);
      if (auth.error || auth.data.user?.id !== uid)
        throw new Error("Votre session a changé.");
    },
    info: () => bucket.info(attachment.path),
    bytes: async () => {
      const file = new File(uri);
      if (!file.exists || file.size !== attachment.size)
        throw new Error(
          "Le fichier local n’est plus disponible. Abandonnez cette tentative puis choisissez-le à nouveau.",
        );
      return file.arrayBuffer();
    },
    upload: (bytes) =>
      bucket.upload(attachment.path, bytes, {
        contentType: attachment.mime,
        upsert: false,
        cacheControl: "0",
      }),
  });
}
