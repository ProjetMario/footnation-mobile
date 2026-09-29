import { createClient } from "@supabase/supabase-js";
import { requireBackend, supabase } from "./supabase";
import type { ExperienceSnapshot } from "./experienceSave";
export async function experienceRepository(
  uid: string,
  assertCurrentAccount: () => void,
) {
  requireBackend();
  assertCurrentAccount();
  const session = await supabase.auth.getSession();
  assertCurrentAccount();
  if (session.error || session.data.session?.user.id !== uid)
    throw new Error(
      "Votre session a changé. Retrouvez le compte de ce parcours.",
    );
  const token = session.data.session.access_token;
  const verified = await supabase.auth.getUser(token);
  assertCurrentAccount();
  if (verified.error || verified.data.user?.id !== uid)
    throw new Error(
      "Votre identité n’a pas pu être vérifiée. Reconnectez-vous.",
    );
  // Frozen bearer prevents a switch between an identity check and HTTP dispatch
  // from sending A's full profile payload using B's credentials.
  const client = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: async () => token,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  // The historical remote profiles table has no updated_at column. Compare
  // the complete JSONB history directly for the legacy atomic UPDATE guard.
  const columns = "id,experience_history";
  return {
    assertIdentity: async () => {
      assertCurrentAccount();
      const current = await supabase.auth.getSession();
      assertCurrentAccount();
      if (current.error || current.data.session?.user.id !== uid)
        throw new Error(
          "Votre session a changé. Retrouvez le compte de ce parcours.",
        );
    },
    read: async (): Promise<ExperienceSnapshot> => {
      const result = await client
        .from("profiles")
        .select(columns)
        .eq("id", uid)
        .maybeSingle();
      if (result.error) throw result.error;
      return {
        id: result.data?.id ?? uid,
        experience_history: result.data?.experience_history ?? null,
        updated_at: null,
      };
    },
    sync: async (
      expected: unknown,
      history: unknown[],
    ): Promise<ExperienceSnapshot> => {
      const result = await client.rpc("save_native_experience_history", {
        p_expected: expected,
        p_history: history,
      });
      if (result.error) throw result.error;
      return result.data;
    },
    update: async (
      history: unknown[],
      expectedHistory: unknown,
    ): Promise<ExperienceSnapshot | null> => {
      let request = client
        .from("profiles")
        .update({ experience_history: history })
        .eq("id", uid);
      request =
        expectedHistory == null
          ? request.or("experience_history.is.null,experience_history.eq.null")
          : request.eq("experience_history", JSON.stringify(expectedHistory));
      const result = await request.select(columns).maybeSingle();
      if (result.error) throw result.error;
      if (result.data) return { ...result.data, updated_at: null };
      if (expectedHistory != null) return null;
      const created = await client
        .from("profiles")
        .upsert({ id: uid, experience_history: history }, { onConflict: "id" })
        .select(columns)
        .single();
      if (created.error) throw created.error;
      return { ...created.data, updated_at: null };
    },
  };
}
