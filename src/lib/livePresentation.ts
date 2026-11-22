/** Map known failures to actions without exposing SQL or server internals. */
export function liveNeedsProfile(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const failure = error as { code?: unknown; message?: unknown };
  return (
    failure.code === "PROFILE_REQUIRED" ||
    (failure.code === "23503" &&
      typeof failure.message === "string" &&
      failure.message.includes("live_streams_broadcaster_id_fkey")) ||
    (failure.code === "42501" &&
      failure.message === "Complétez votre profil pour lancer un live.")
  );
}
export function liveFailureMessage(error: unknown): string {
  if (liveNeedsProfile(error))
    return "Complétez votre profil pour lancer le live. Votre titre est conservé.";
  // The RTC adapter and controller already turn service errors into French copy.
  if (
    error instanceof Error &&
    /^(?:La connexion|Le relais|Ce live|Le live|Le service|Le serveur|Un live|Ce compte|Activez|Votre session|Connectez|Cette session)/.test(
      error.message,
    )
  )
    return error.message;
  return "Le live n’a pas pu démarrer. Vérifiez votre connexion puis réessayez.";
}
