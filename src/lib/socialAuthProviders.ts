import { requireBackend } from "./supabase";

export async function getSocialAuthProviders() {
  requireBackend();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
      {
        headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "" },
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error("provider_settings_unavailable");
    const data = await response.json();
    if (!data.external || typeof data.external !== "object")
      throw new Error("provider_settings_invalid");
    return {
      google: data.external.google === true,
      apple: data.external.apple === true,
    };
  } finally {
    clearTimeout(timeout);
  }
}
