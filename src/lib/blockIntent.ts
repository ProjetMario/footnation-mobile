type Block = { id: string };
export async function applyBlockIntent(
  repository: {
    read: () => Promise<Block | null>;
    insert: () => Promise<void>;
    remove: (id: string) => Promise<boolean>;
  },
  blocked: boolean,
  expectedId: string | null,
) {
  const current = await repository.read();
  if (blocked) {
    if (current) return;
    try {
      await repository.insert();
    } catch (error) {
      if (await repository.read()) return;
      throw error;
    }
    return;
  }
  if (!current) return;
  if (current.id !== expectedId)
    throw new Error(
      "Le blocage a changé. Annulez et actualisez avant de confirmer à nouveau.",
    );
  if (!(await repository.remove(current.id)) && (await repository.read()))
    throw new Error(
      "Le blocage a changé ou n’a pas pu être retiré. Actualisez avant de réessayer.",
    );
}
