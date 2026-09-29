import { websiteUrl } from "./websiteUrl";
import { getDepartmentByCode } from "../data/french-departments";
export const organizationTypes = {
  club: "Club",
  enterprise: "Entreprise",
  brand: "Marque",
} as const;
export type OrganizationForm = {
  name: string;
  type: string;
  description: string;
  website: string;
  department: string;
  address: string;
  contact_email: string;
};
export function organizationPayload(form: OrganizationForm) {
  const name = form.name.trim();
  if (!name) throw new Error("Indiquez le nom de l’organisation.");
  if (!Object.hasOwn(organizationTypes, form.type))
    throw new Error("Choisissez un type d’organisation.");
  const department = form.department.trim().toUpperCase();
  if (department && !getDepartmentByCode(department))
    throw new Error("Vérifiez le code du département.");
  const email = form.contact_email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Vérifiez l’adresse email de contact.");
  return {
    name,
    type: form.type,
    description: form.description.trim() || null,
    website: form.website.trim() ? websiteUrl(form.website) : null,
    department: department || null,
    address: form.address.trim() || null,
    contact_email: email || null,
  };
}
