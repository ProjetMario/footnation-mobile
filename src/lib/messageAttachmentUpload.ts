import type { MessageAttachment } from "./messageAttachment";

/** Storage info() camelizes its v2 response; older servers retain nested metadata. */
export function messageObjectMatches(
  value: unknown,
  attachment: MessageAttachment,
): boolean {
  if (!value || typeof value !== "object") return false;
  const info = value as Record<string, unknown>;
  const metadata =
    info.metadata && typeof info.metadata === "object"
      ? (info.metadata as Record<string, unknown>)
      : {};
  const size = info.size ?? metadata.size;
  const mime =
    info.contentType ??
    info.content_type ??
    metadata.mimetype ??
    metadata.mimeType;
  return Number(size) === attachment.size && mime === attachment.mime;
}
function isAbsent(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as Record<string, unknown>;
  return (
    Number(value.statusCode ?? value.status) === 404 ||
    ["NoSuchKey", "not_found", "object_not_found"].includes(String(value.code))
  );
}
export async function ensureMessageUpload(
  attachment: MessageAttachment,
  ports: {
    requireUser(): Promise<void>;
    info(): Promise<{ data: unknown; error: unknown }>;
    bytes(): Promise<ArrayBuffer>;
    upload(bytes: ArrayBuffer): Promise<{ error: unknown }>;
  },
) {
  await ports.requireUser();
  const present = await ports.info();
  await ports.requireUser();
  if (!present.error) {
    if (!messageObjectMatches(present.data, attachment))
      throw new Error(
        "Le fichier distant ne correspond pas à cette tentative.",
      );
    return;
  }
  if (!isAbsent(present.error))
    throw new Error(
      "Impossible de vérifier le fichier envoyé. Réessayez avec une connexion réseau.",
    );
  const bytes = await ports.bytes();
  if (bytes.byteLength !== attachment.size)
    throw new Error("Le fichier local a changé. Choisissez-le à nouveau.");
  await ports.requireUser();
  const result = await ports.upload(bytes);
  await ports.requireUser();
  if (result.error) {
    const confirmed = await ports.info();
    await ports.requireUser();
    if (confirmed.error || !messageObjectMatches(confirmed.data, attachment))
      throw new Error(
        "L’envoi du fichier n’est pas confirmé. Réessayez pour le vérifier.",
      );
  }
}

const filename =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf|m4a|mp3|webm|ogg|mp4)$/i;
export function isOwnedMessageDraft(directory: string, uri: string): boolean {
  const prefix = `${directory.replace(/\/$/, "")}/`;
  return uri.startsWith(prefix) && filename.test(uri.slice(prefix.length));
}
