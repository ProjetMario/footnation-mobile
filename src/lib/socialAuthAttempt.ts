import { randomUUID } from "expo-crypto";
import sessionStorage from "./sessionStorage";
import { supabase } from "./supabase";
import { createSocialAuthAttempts } from "./socialAuthAttemptState";

export const socialAuthAttempts = createSocialAuthAttempts({
  storage: sessionStorage,
  randomId: randomUUID,
  currentUser: async () => {
    const result = await supabase.auth.getSession();
    if (result.error) throw result.error;
    return result.data.session?.user.id ?? null;
  },
});
