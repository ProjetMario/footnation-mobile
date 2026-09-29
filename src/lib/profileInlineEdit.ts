import type { Profile } from "./models";
import { supabase } from "./supabase";
import { profileSnapshotRequest } from "./profileSave";
import { websiteUrl } from "./websiteUrl";
import { departmentOptions } from "./networkOptions";
import { validEmail } from "./validation";
import { latestAllowedBirthdate, validBirthdate } from "./calendarDate";
import { notifyClubChange } from "./notificationEvents";
import { displayName } from "./models";
export type EditableProfileField = {
  label: string;
  keys: string[];
  array?: boolean;
  multiline?: boolean;
};
const fields: Record<string, string> = {
  "Nom d’utilisateur": "username",
  "Rôle dans le football": "primary_role",
  "Rôles secondaires": "secondary_roles",
  Âge: "birthdate",
  "Date de naissance": "birthdate",
  Nationalité: "nationality",
  Genre: "gender",
  Présentation: "bio",
  Ville: "city",
  Département: "department",
  "Pays de résidence": "country",
  "Club / Structure": "club",
  "Plus haut niveau": "highest_level",
  "Poste principal": "position",
  "Postes secondaires": "secondary_positions",
  "Pied fort": "strong_foot",
  "Pied faible": "weak_foot",
  "Temps de jeu moyen": "average_playtime",
  Taille: "height",
  Poids: "weight",
  Compétences: "skills",
  "Qualités techniques": "technical_skills",
  "Points forts": "characteristics",
  "Club professionnel": "favorite_pro_club",
  "Club amateur": "favorite_amateur_club",
};
const arrays = new Set(["secondary_roles", "secondary_positions", "skills"]);
// These existing profile columns are not in the older snapshot RPC. They use
// the same owner RLS with a compare-and-set on the single edited field.
const directFields = new Set([
  "secondary_roles",
  "secondary_positions",
  "weak_foot",
  "average_playtime",
  "institution_phone",
]);
export function editableProfileField(
  profile: Profile,
  label: string,
): EditableProfileField | null {
  const organization = ["club", "business", "institution"].includes(
    profile.account_type || "",
  );
  if (label === "Nom")
    return {
      label,
      keys: organization
        ? [
            profile.account_type === "club"
              ? "club_official_name"
              : profile.account_type === "business"
                ? "business_name"
                : "institution_name",
          ]
        : ["first_name", "last_name"],
    };
  let key = Object.hasOwn(fields, label) ? fields[label] : undefined;
  if (organization) {
    const prefix = profile.account_type!;
    const names: Record<string, string> = {
      "Site internet": "website",
      Adresse: "address",
      Téléphone: "phone",
      Email: "email",
      "E-mail": "email",
      "Email professionnel": "email",
    };
    if (Object.hasOwn(names, label)) key = `${prefix}_${names[label]}`;
    if (label === "Secteur") key = "business_sector";
    if (label === "Type") key = "institution_type";
    if (label === "Niveau") key = "institution_level";
  }
  if (!key) return null;
  return {
    label,
    keys: [key],
    array: arrays.has(key),
    multiline: ["bio", "technical_skills", "characteristics"].includes(key),
  };
}
export function inlineProfileValues(
  profile: Profile,
  field: EditableProfileField,
) {
  const row = profile as unknown as Record<string, unknown>;
  return Object.fromEntries(
    field.keys.map((key) => [
      key,
      Array.isArray(row[key])
        ? (row[key] as string[]).join(", ")
        : String(row[key] ?? ""),
    ]),
  );
}
export function inlineProfilePayload(
  profile: Profile,
  field: EditableProfileField,
  values: Record<string, string>,
) {
  const expected = editableProfileField(profile, field.label);
  if (!expected || JSON.stringify(expected.keys) !== JSON.stringify(field.keys))
    throw new Error("Cette information ne peut pas être modifiée ici.");
  const payload: Record<string, unknown> = {};
  for (const key of expected.keys) {
    let value = (values[key] || "").trim();
    if (value.length > (expected.multiline ? 2000 : 200))
      throw new Error("Cette information est trop longue.");
    if (
      [
        "first_name",
        "last_name",
        "username",
        "club_official_name",
        "business_name",
        "institution_name",
      ].includes(key) &&
      !value
    )
      throw new Error("Renseignez cette information avant d’enregistrer.");
    if (key === "username") {
      value = value.replace(/^@+/, "");
      if (!/^[\p{L}\p{N}_.-]{2,40}$/u.test(value))
        throw new Error(
          "Le nom d’utilisateur doit contenir 2 à 40 lettres, chiffres, points, tirets ou tirets bas.",
        );
    }
    if (
      key === "height" &&
      value &&
      (!Number.isFinite(Number(value.replace(",", "."))) ||
        +value.replace(",", ".") < 50 ||
        +value.replace(",", ".") > 250)
    )
      throw new Error("Indiquez la taille en cm, entre 50 et 250.");
    if (
      key === "weight" &&
      value &&
      (!Number.isFinite(Number(value.replace(",", "."))) ||
        +value.replace(",", ".") < 10 ||
        +value.replace(",", ".") > 300)
    )
      throw new Error("Indiquez le poids en kg, entre 10 et 300.");
    if (key.endsWith("_website") && value) value = websiteUrl(value);
    if (key.endsWith("_email") && value && !validEmail(value))
      throw new Error("Vérifiez l’adresse e-mail.");
    if (
      key === "birthdate" &&
      value &&
      (!validBirthdate(value) || value > latestAllowedBirthdate(new Date(), 13))
    )
      throw new Error(
        "Choisissez une date de naissance valide. Le compte doit avoir au moins 13 ans.",
      );
    payload[key] = arrays.has(key)
      ? Array.from(
          new Set(
            value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          ),
        )
      : value || null;
  }
  if (field.label === "Ville" && values.department !== undefined) {
    if (!departmentOptions.some((option) => option.value === values.department))
      throw new Error("Choisissez un département valide.");
    payload.department = values.department;
  }
  if (field.label === "Nom")
    payload.full_name = expected.keys
      .map((k) => values[k]?.trim())
      .filter(Boolean)
      .join(" ");
  return payload;
}
export async function saveInlineProfile(
  profile: Profile,
  field: EditableProfileField,
  values: Record<string, string>,
) {
  const payload = inlineProfilePayload(profile, field, values);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || auth.user?.id !== profile.id)
    throw new Error(
      "Votre session a changé. Reconnectez-vous avant de modifier le profil.",
    );
  const row = profile as unknown as Record<string, unknown>;
  let result;
  if (Object.keys(payload).every((key) => directFields.has(key))) {
    let query = supabase
      .from("profiles")
      .update(payload)
      .eq("id", auth.user.id);
    for (const key of Object.keys(payload))
      query =
        row[key] == null
          ? query.is(key, null)
          : query.eq(
              key,
              Array.isArray(row[key])
                ? `{${(row[key] as string[]).map((v) => JSON.stringify(v)).join(",")}}`
                : row[key],
            );
    result = await query.select("*").maybeSingle();
  } else
    result = await supabase.rpc(
      "update_native_profile_snapshot",
      profileSnapshotRequest(payload, row),
    );
  if (result.error?.code === "23505")
    throw new Error("Ce nom d’utilisateur est déjà utilisé.");
  if (result.error?.code === "40001" || (!result.error && !result.data))
    throw new Error(
      "Cette information a changé entre-temps. Fermez puis rouvrez l’édition pour réessayer.",
    );
  if (result.error)
    throw new Error(
      "L’enregistrement a échoué. Votre saisie est conservée, vous pouvez réessayer.",
    );
  const saved = result.data as Profile;
  if (Object.hasOwn(payload, "club"))
    void notifyClubChange({
      profileId: profile.id,
      profileName: displayName(saved),
      previousClub: typeof profile.club === "string" ? profile.club : null,
      nextClub: typeof saved.club === "string" ? saved.club : null,
    });
  return saved;
}
