import type { AdminRecord, Json } from "./contracts";
export type EditField = {
  key: string;
  label: string;
  kind?: "number" | "boolean" | "multiline" | "date" | "url" | "list";
  required?: boolean;
  max?: number;
  min?: number;
  integer?: boolean;
};
export const profileFieldGroups: { title: string; fields: EditField[] }[] = [
  {
    title: "Identité",
    fields: [
      { key: "full_name", label: "Nom complet", required: true },
      { key: "username", label: "Identifiant" },
      { key: "bio", label: "Biographie", kind: "multiline" },
      {
        key: "birthdate",
        label: "Date de naissance (AAAA-MM-JJ)",
        kind: "date",
      },
      { key: "gender", label: "Genre" },
      { key: "nationality", label: "Nationalité" },
      { key: "city", label: "Ville" },
      { key: "department", label: "Département" },
      { key: "avatar_url", label: "URL de la photo", kind: "url" },
    ],
  },
  {
    title: "Football",
    fields: [
      { key: "primary_role", label: "Rôle principal" },
      { key: "position", label: "Poste" },
      { key: "highest_level", label: "Plus haut niveau" },
      { key: "height", label: "Taille (cm)", kind: "number", max: 250 },
      { key: "weight", label: "Poids (kg)", kind: "number", max: 300 },
      { key: "strong_foot", label: "Pied fort" },
      { key: "weak_foot", label: "Pied faible" },
      {
        key: "technical_skills",
        label: "Qualités techniques",
        kind: "multiline",
      },
      { key: "characteristics", label: "Caractéristiques", kind: "multiline" },
    ],
  },
  {
    title: "Objectifs",
    fields: [
      { key: "target_competition_level", label: "Compétition recherchée" },
      { key: "target_position", label: "Poste recherché" },
      { key: "target_level", label: "Niveau recherché" },
      { key: "target_age_category", label: "Catégorie recherchée" },
      { key: "target_experience", label: "Expérience recherchée" },
      {
        key: "desired_salary",
        label: "Rémunération souhaitée",
        kind: "number",
        integer: true,
      },
      {
        key: "desired_benefits",
        label: "Avantages souhaités (un par ligne)",
        kind: "list",
      },
    ],
  },
  {
    title: "Visibilité",
    fields: [
      { key: "is_private", label: "Profil privé", kind: "boolean" },
      { key: "is_published", label: "Profil publié", kind: "boolean" },
    ],
  },
];
export const clubFields: EditField[] = [
  { key: "name", label: "Nom du club", required: true },
  { key: "short_name", label: "Nom court" },
  { key: "description", label: "Présentation", kind: "multiline" },
  { key: "history", label: "Histoire", kind: "multiline" },
  { key: "address", label: "Adresse" },
  { key: "city", label: "Ville" },
  { key: "postal_code", label: "Code postal" },
  { key: "department_code", label: "Département" },
  { key: "department_name", label: "Nom du département" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Téléphone" },
  { key: "website", label: "Site web", kind: "url" },
  { key: "logo_url", label: "Logo (URL)", kind: "url" },
  { key: "level", label: "Niveau" },
  { key: "founded_date", label: "Date de création (AAAA-MM-JJ)", kind: "date" },
  { key: "is_pro", label: "Club professionnel", kind: "boolean" },
  { key: "is_verified", label: "Club vérifié", kind: "boolean" },
];
export const ratingFields: EditField[] = [
  "pace",
  "shooting",
  "passing",
  "dribbling",
  "defending",
  "physical",
].map((key, i) => ({
  key,
  label: ["Vitesse", "Tir", "Passe", "Dribble", "Défense", "Physique"][i],
  kind: "number",
  min: 1,
  max: 99,
  integer: true,
}));
export function fieldValue(
  row: AdminRecord,
  field: EditField,
): string | boolean {
  const val = row[field.key];
  if (field.kind === "boolean") return val === true;
  if (Array.isArray(val)) return val.map(String).join("\n");
  return val == null ? "" : String(val);
}
export function fieldPatch(
  row: AdminRecord,
  fields: EditField[],
  draft: Record<string, string | boolean>,
): Record<string, Json> {
  const values: Record<string, Json> = {};
  for (const field of fields) {
    if (!(field.key in draft) || draft[field.key] === fieldValue(row, field))
      continue;
    const input = draft[field.key];
    const text = typeof input === "string" ? input.trim() : "";
    if (field.required && !text)
      throw new Error(`${field.label} est obligatoire.`);
    let value: Json = typeof input === "boolean" ? input : text || null;
    if (field.kind === "number" && text) {
      const n = Number(text.replace(",", "."));
      if (
        !Number.isFinite(n) ||
        n < (field.min ?? 0) ||
        (field.integer && !Number.isInteger(n)) ||
        (field.max !== undefined && n > field.max)
      )
        throw new Error(`${field.label} : valeur invalide.`);
      value = n;
    }
    if (
      field.kind === "date" &&
      text &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(text) ||
        !Number.isFinite(Date.parse(text)) ||
        new Date(text).toISOString().slice(0, 10) !== text)
    )
      throw new Error(`${field.label} : date invalide.`);
    if (field.kind === "url" && text && !/^https:\/\/[^\s]+$/i.test(text))
      throw new Error(`${field.label} doit commencer par https://.`);
    if (field.kind === "list")
      value = text
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);
    values[field.key] = value;
  }
  return values;
}
