import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";

/** SDK redirect URI for the current web mount, without changing native links. */
export function authRedirectUri(queryParams: Record<string, string> = {}) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const basePath = process.env.EXPO_PUBLIC_WEB_BASE_PATH || "";
    if (basePath !== "" && basePath !== "/app")
      throw new Error("Le chemin de l’application web est invalide.");
    const url = new URL(`${basePath}/auth/callback`, window.location.origin);
    for (const [key, value] of Object.entries(queryParams))
      url.searchParams.set(key, value);
    return url.toString();
  }
  return AuthSession.makeRedirectUri({
    scheme: "com.footnation.app",
    path: "auth/callback",
    queryParams,
  });
}
