const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);
export function isTransientAuthFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: unknown; message?: unknown; name?: unknown };
  if (typeof value.status === "number") return transientStatuses.has(value.status);
  const status = typeof value.message === "string" ? value.message.match(/^HTTP\s+(\d{3})\b/i)?.[1] : undefined;
  return !!status && transientStatuses.has(Number(status));
}
export const authUnavailableMessage = "Le serveur de connexion met trop de temps à répondre. Réessayez dans un instant.";

/** Only for session/user reads. Never retry sign-in, token exchange or mutations
 * here. Each session read lets the SDK re-read the current stored credentials.
 */
export async function recoverAuthRead<T extends { error: unknown }>(
  read: () => Promise<T>,
  pause: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 750)),
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await read();
      if (!isTransientAuthFailure(result.error)) return result;
      if (attempt === 1) throw new Error(authUnavailableMessage);
    } catch (error) {
      if (!isTransientAuthFailure(error)) throw error;
      if (attempt === 1) throw new Error(authUnavailableMessage);
    }
    await pause();
  }
  throw new Error(authUnavailableMessage);
}
