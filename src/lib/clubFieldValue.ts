import type { ClubField } from "./clubSections";
import { proFieldValue } from "./proFieldValue";

export function clubFieldValue(field: ClubField, value: unknown) {
  const parsed = proFieldValue(
    {
      key: field.key,
      label: field.label,
      kind: field.type === "text" ? undefined : field.type,
      required: field.required,
      options: field.choices?.map((choice) => [choice, choice]),
    },
    value,
  );
  if (field.key === "year" && typeof parsed === "number" && parsed > 9999)
    throw new Error("Indiquez une année entre 0 et 9999.");
  if (
    field.key === "jersey_number" &&
    typeof parsed === "number" &&
    (parsed < 1 || parsed > 99)
  )
    throw new Error("Le numéro de maillot doit être compris entre 1 et 99.");
  return parsed;
}
