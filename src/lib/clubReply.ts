export type ReplyMessage = {
  id: string;
  content: string;
  media_url?: string | null;
  is_deleted?: boolean | null;
  is_blocked?: boolean;
};
export function clubReplyPreview(message: ReplyMessage | undefined) {
  if (!message || message.is_deleted || message.is_blocked)
    return "Message indisponible";
  return (
    message.content.trim() ||
    (message.media_url ? "Pièce jointe" : "Message sans texte")
  );
}
export async function loadClubReplies<T extends { id: string }>(
  ids: string[],
  fetchBatch: (ids: string[]) => Promise<T[]>,
) {
  const unique = [...new Set(ids)].sort();
  const rows: T[] = [];
  for (let offset = 0; offset < unique.length; offset += 50)
    rows.push(...(await fetchBatch(unique.slice(offset, offset + 50))));
  return rows;
}
