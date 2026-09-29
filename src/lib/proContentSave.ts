type Row = Record<string, unknown>;
function sameField(key: string, left: unknown, right: unknown) {
  if (
    [
      "match_date",
      "event_date",
      "meeting_date",
      "published_at",
      "session_date",
    ].includes(key) &&
    typeof left === "string" &&
    typeof right === "string"
  )
    return Date.parse(left) === Date.parse(right);
  return JSON.stringify(left) === JSON.stringify(right);
}
export async function createProContent(
  repository: {
    read: (id: string) => Promise<Row | null>;
    insert: (row: Row) => Promise<void>;
  },
  row: Row & { id: string },
) {
  const existing = await repository.read(row.id);
  if (existing) {
    if (
      Object.entries(row).some(
        ([key, value]) => !sameField(key, existing[key], value),
      )
    )
      throw new Error(
        "Cet élément a déjà été enregistré avec un autre contenu. Revenez à la page avant de le modifier.",
      );
    return;
  }
  await repository.insert(row);
}
export function proContentIdentity(section: string, uid: string) {
  return section === "posts"
    ? { author_id: uid }
    : section === "media"
      ? { uploader_id: uid }
      : {};
}
