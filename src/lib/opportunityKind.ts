export type OpportunityKind = "" | "offres" | "demandes";
export type OpportunityListingKind = "offer" | "request";

// A club looking for a player is offering a place, not requesting one.
const requestTypes = new Set([
  "recherche_club",
  "recherche_emploi",
  "recherche_stage",
  "job_request",
  "club_request",
]);
export function opportunityListingKind(
  type: string,
  explicit?: string | null,
): OpportunityListingKind {
  if (explicit === "request" || explicit === "offer") return explicit;
  return requestTypes.has(type) ? "request" : "offer";
}
export function opportunityKindFilter(
  kind: OpportunityKind,
): OpportunityListingKind | null {
  return kind === "offres" ? "offer" : kind === "demandes" ? "request" : null;
}
