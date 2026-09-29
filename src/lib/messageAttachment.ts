export const MESSAGE_ATTACHMENT_BUCKET = "message-attachments";
export const MAX_MESSAGE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_VOICE_SECONDS = 120;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const attachmentTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
};
export type MessageAttachment = {
  version: 1;
  path: string;
  name: string;
  mime: string;
  size: number;
  kind: "file" | "voice";
  duration: number | null;
};
export type LocalMessageFile = {
  uri: string;
  name: string;
  mime: string;
  size: number;
  kind: "file" | "voice";
  duration: number | null;
};
export function normalizeAttachment(
  value: unknown,
  sender: string,
  receiver: string,
  messageId: string,
): MessageAttachment {
  if (!value || typeof value !== "object")
    throw new Error("Pièce jointe invalide.");
  const a = value as MessageAttachment;
  const parts = typeof a.path === "string" ? a.path.split("/") : [];
  const ext = attachmentTypes[a.mime];
  if (
    !uuid.test(sender) ||
    !uuid.test(receiver) ||
    !uuid.test(messageId) ||
    a.version !== 1 ||
    parts.length !== 4 ||
    parts[0] !== sender ||
    parts[1] !== receiver ||
    parts[2] !== messageId ||
    !ext ||
    !uuid.test(parts[3]?.split(".")[0] || "") ||
    parts[3] !== `${parts[3]?.split(".")[0]}.${ext}` ||
    typeof a.name !== "string" ||
    !a.name.trim() ||
    a.name.length > 120 ||
    /[\x00-\x1f\x7f/\\]/.test(a.name) ||
    !Number.isInteger(a.size) ||
    a.size <= 0 ||
    a.size > MAX_MESSAGE_FILE_BYTES ||
    !["file", "voice"].includes(a.kind) ||
    (a.kind === "voice"
      ? !a.mime.startsWith("audio/") ||
        typeof a.duration !== "number" ||
        !Number.isFinite(a.duration) ||
        a.duration <= 0 ||
        a.duration > MAX_VOICE_SECONDS
      : a.duration !== null)
  )
    throw new Error(
      "La pièce jointe dépasse les limites ou ne correspond pas à cette conversation.",
    );
  // Stable field order for retries even when JSONB returns keys in another order.
  return {
    version: 1,
    path: a.path,
    name: a.name.trim(),
    mime: a.mime,
    size: a.size,
    kind: a.kind,
    duration: a.duration,
  };
}
export function makeAttachment(
  file: LocalMessageFile,
  sender: string,
  receiver: string,
  messageId: string,
  fileId: string,
) {
  return normalizeAttachment(
    {
      ...file,
      version: 1,
      path: `${sender}/${receiver}/${messageId}/${fileId}.${attachmentTypes[file.mime]}`,
    },
    sender,
    receiver,
    messageId,
  );
}
export function attachmentLabel(
  file: Pick<MessageAttachment, "name" | "kind">,
) {
  return file.kind === "voice"
    ? "Message vocal"
    : `Pièce jointe : ${file.name}`;
}
