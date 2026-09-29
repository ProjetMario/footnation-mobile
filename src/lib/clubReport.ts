export const clubReportStatuses: Record<string, string> = {
  pending: "En attente",
  reviewed: "Examiné",
  resolved: "Résolu",
  dismissed: "Classé sans suite",
};
export const clubReportReasons: Record<string, string> = {
  inappropriate: "Contenu inapproprié",
  harassment: "Harcèlement",
  spam: "Spam",
  other: "Autre",
};
export function clubReportPayload(reason: string, details: string) {
  if (!Object.hasOwn(clubReportReasons, reason))
    throw new Error("Choisissez un motif de signalement.");
  const text = details.trim();
  if (text.length > 3000)
    throw new Error("Les précisions sont limitées à 3 000 caractères.");
  return { reason, details: text || null };
}
