import { validBirthdate } from "./calendarDate";
import { websiteUrl } from "./websiteUrl";

export function clubInformationValue(
  key: string,
  input: string,
  today = new Date(),
): string | null {
  const value = input.trim();
  if (key === "name" && !value)
    throw new Error("Le nom du club est obligatoire.");
  if (!value) return null;
  if (key === "website" || key === "logo_url") return websiteUrl(value);
  if (key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new Error("Vérifiez l’adresse e-mail du club.");
  if (key === "phone" && !/^\+?\d{6,15}$/.test(value.replace(/[\s().-]/g, "")))
    throw new Error("Vérifiez le numéro de téléphone du club.");
  if (key === "founded_date" && !validBirthdate(value, today))
    throw new Error(
      "Indiquez une date de fondation valide, au format AAAA-MM-JJ, qui ne soit pas dans le futur.",
    );
  return value;
}
