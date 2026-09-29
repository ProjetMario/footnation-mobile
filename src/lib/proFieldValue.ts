import type { ProField } from "./proContent";
import { validBirthdate } from "./calendarDate";
import { validEmail } from "./validation";
import { websiteUrl } from "./websiteUrl";
function timestamp(value: string) {
  const match =
    /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match) return null;
  const calendar = new Date(`${match[1]}T12:00:00Z`);
  const instant = new Date(value);
  if (
    !Number.isFinite(calendar.getTime()) ||
    calendar.toISOString().slice(0, 10) !== match[1] ||
    !Number.isFinite(instant.getTime())
  )
    return null;
  return instant.toISOString();
}
export function proFieldValue(field: ProField, value: unknown) {
  const link = (url: string) => {
    try {
      return websiteUrl(url);
    } catch {
      throw new Error(
        `${field.label} : indiquez un lien internet public valide.`,
      );
    }
  };
  if (field.kind === "boolean") {
    if (typeof value !== "boolean")
      throw new Error(`${field.label} : choisissez oui ou non.`);
    return value;
  }
  const raw = value == null ? "" : String(value);
  const clean = raw.trim();
  if ((field.required || field.options) && !clean)
    throw new Error(`${field.label} est obligatoire.`);
  if (field.options && !field.options.some(([key]) => key === clean))
    throw new Error(`${field.label} : choix invalide.`);
  if (field.kind === "urls")
    return clean
      ? clean
          .split(/\r?\n/)
          .map((url) => url.trim())
          .filter(Boolean)
          .map(link)
      : [];
  if (!clean) return null;
  if (field.kind === "number") {
    const number = Number(clean);
    if (
      !/^\d+$/.test(clean) ||
      !Number.isInteger(number) ||
      number > 2147483647
    )
      throw new Error(
        `${field.label} doit être un entier entre 0 et 2 147 483 647.`,
      );
    return number;
  }
  if (field.kind === "date") {
    const date = timestamp(clean);
    if (!date)
      throw new Error(
        `${field.label} : indiquez une date et une heure valides avec leur fuseau horaire.`,
      );
    return date;
  }
  if (field.key === "birthdate" && !validBirthdate(clean))
    throw new Error("Date de naissance invalide ou future.");
  if (field.key.endsWith("_email") && !validEmail(clean))
    throw new Error(`${field.label} : adresse e-mail invalide.`);
  if (field.key.endsWith("_url") || field.key === "url") return link(clean);
  return field.options ||
    field.key === "birthdate" ||
    field.key.endsWith("_email")
    ? clean
    : raw;
}
