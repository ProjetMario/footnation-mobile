export const proVerificationLabels: Record<string, string> = {
  draft: "Non certifiée",
  pending_review: "Demande en cours d’examen",
  approved: "Page certifiée officielle",
  rejected: "Demande refusée",
};
export function needsProVerificationRequest(page: {
  page_type: string;
  club_id: string | null;
  verification_status: string;
}) {
  if (page.page_type !== "club_officiel" || !page.club_id)
    throw new Error("La page doit être un club officiel lié à une fiche club.");
  if (
    page.verification_status === "pending_review" ||
    page.verification_status === "approved"
  )
    return false;
  if (!["draft", "rejected"].includes(page.verification_status))
    throw new Error("Statut de validation inconnu. Actualisez la page.");
  return true;
}
