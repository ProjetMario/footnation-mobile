import { validCalendarDate } from "./calendarDate";
import { websiteUrl } from "./websiteUrl";
export const competitionTypes: Record<string, string> = {
  championship: "Championnat",
  cup: "Coupe",
  friendly: "Amical",
  tournament: "Tournoi",
};
export const competitionFields = [
  "name",
  "type",
  "category",
  "season",
  "level",
  "start_date",
  "end_date",
  "external_url",
] as const;
export function competitionPayload(values: Record<string, string>) {
  const payload = Object.fromEntries(
    competitionFields.map((key) => [key, values[key]?.trim() || null]),
  );
  if (!payload.name)
    throw new Error("Le nom de la compétition est obligatoire.");
  if (!payload.type || !Object.hasOwn(competitionTypes, payload.type))
    throw new Error("Choisissez un type de compétition.");
  for (const key of ["start_date", "end_date"])
    if (payload[key] && !validCalendarDate(payload[key]))
      throw new Error("Indiquez des dates valides au format AAAA-MM-JJ.");
  if (
    payload.start_date &&
    payload.end_date &&
    payload.end_date < payload.start_date
  )
    throw new Error("La fin ne peut pas précéder le début de la compétition.");
  if (payload.external_url)
    payload.external_url = websiteUrl(payload.external_url);
  return payload;
}
