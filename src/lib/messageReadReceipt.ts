import type { SupabaseClient } from "@supabase/supabase-js";

export async function confirmMessageReads(
  client: SupabaseClient,
  viewer: string,
  peer: string,
  ids: string[],
): Promise<string[]> {
  if (!ids.length) return [];
  const result = await client
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("receiver_id", viewer)
    .eq("sender_id", peer)
    .in("id", ids)
    .is("read_at", null)
    .or("is_blocked.is.null,is_blocked.eq.false")
    .select("id");
  if (result.error) throw result.error;
  if (!result.data?.length)
    throw new Error(
      "Aucune confirmation de lecture reçue. Actualisez la conversation avant de réessayer.",
    );
  // RLS or a concurrent update may exclude some IDs. Only acknowledge rows
  // actually returned by the server; never claim the entire batch succeeded.
  return (result.data || []).map((row: { id: string }) => row.id);
}
