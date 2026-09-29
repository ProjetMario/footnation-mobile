import { supabase } from "../supabase";
export async function clubImportRpc<T>(
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const snapshot = await supabase.auth.getSession();
  if (snapshot.error || snapshot.data.session?.user.id !== userId)
    throw new Error("La session a changé. Rouvrez l’administration du club.");
  const result = await supabase
    .rpc(name, { ...args, p_actor_id: userId })
    .setHeader("Authorization", `Bearer ${snapshot.data.session.access_token}`);
  if (result.error) {
    const code = result.error.code;
    if (code === "PGRST202" || code === "42883")
      throw new Error(
        "Cette opération nécessite l’activation du nouveau service du club.",
      );
    if (code === "40001" || code === "23505" || code === "40P01")
      throw new Error(
        "Les données ont changé ou une équipe identique existe. Actualisez l’aperçu avant de réessayer.",
      );
    if (code === "42501")
      throw new Error(
        "Votre autorisation d’administrateur a changé. Rouvrez cet espace.",
      );
    throw new Error(
      "L’opération n’a pas pu être confirmée. Actualisez l’aperçu pour vérifier le résultat avant de réessayer.",
    );
  }
  return result.data as T;
}
