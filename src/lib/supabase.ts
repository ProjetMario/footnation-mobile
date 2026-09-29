import sessionStorage from "./sessionStorage";
import { createClient } from "@supabase/supabase-js";

// Public client settings only. No service-role key belongs in a mobile bundle.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const backendConfigured = Boolean(url && key);
export const supabase = createClient(
  url || "https://configuration-required.supabase.co",
  key || "configuration-required",
  {
    auth: {
      storage: sessionStorage,
      storageKey: "footnation-native-auth",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);
export function requireBackend() {
  if (!backendConfigured)
    throw new Error(
      "La connexion FootNation doit être configurée avant de charger les données.",
    );
}
