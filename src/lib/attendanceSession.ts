import { clubFieldValue } from "./clubFieldValue";
export const attendanceTypes: Record<string, string> = {
  training: "Entraînement",
  match: "Match",
  meeting: "Réunion",
  other: "Autre séance",
};
export function attendanceSessionPayload(
  type: string,
  date: string,
  category: string,
  notes: string,
) {
  if (!Object.hasOwn(attendanceTypes, type))
    throw new Error("Choisissez un type de séance.");
  const session_date = clubFieldValue(
    {
      key: "session_date",
      label: "Date de la séance",
      type: "date",
      required: true,
    },
    date,
  );
  if (category.trim().length > 100)
    throw new Error("La catégorie est limitée à 100 caractères.");
  if (notes.trim().length > 3000)
    throw new Error("Les notes sont limitées à 3 000 caractères.");
  return {
    session_type: type,
    session_date,
    category: category.trim() || null,
    notes: notes.trim() || null,
  };
}
