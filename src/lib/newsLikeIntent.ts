type Like = { id: string };
export async function applyNewsLikeIntent(
  repository: {
    read: () => Promise<Like | null>;
    insert: () => Promise<void>;
    remove: (id: string) => Promise<boolean>;
  },
  likeed: boolean,
  expectedId: string | null,
) {
  const current = await repository.read();
  if (likeed) {
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
      "La mention J’aime a changé. Annulez et actualisez avant de confirmer à nouveau.",
    );
  if (!(await repository.remove(current.id)) && (await repository.read()))
    throw new Error(
      "La mention J’aime a changé ou n’a pas pu être retirée. Actualisez avant de réessayer.",
    );
}
