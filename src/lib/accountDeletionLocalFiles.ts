// Web message drafts contain text in the outbox; picked message files are a
// native capability. Stories use their own IndexedDB journal cleanup.
export async function forgetDeletedAccountFiles(userId: string): Promise<void> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      userId,
    )
  )
    throw new Error("Compte invalide.");
}
