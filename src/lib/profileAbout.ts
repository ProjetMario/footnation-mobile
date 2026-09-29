import { countryLabel } from "./profileSelectionOptions";
import type { Profile } from "./models";
import { validBirthdate, frenchCalendarDate } from "./calendarDate";
import { formatAchievement } from "./profileFormatting";
import {
  businessSectorOptions,
  institutionLevelOptions,
  institutionTypeOptions,
} from "./profileOptions";

export type AboutSection = {
  id: string;
  title: string;
  fields: { label: string; value: string | null }[];
};

function text(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number")
    return String(value).trim() || null;
  if (Array.isArray(value))
    return value.map(text).filter(Boolean).join(", ") || null;
  return null;
}

export function isPlayerProfile(profile: Profile) {
  if (["club", "business", "institution"].includes(profile.account_type || ""))
    return false;
  const roles = [profile.primary_role, ...(profile.secondary_roles || [])];
  return (
    roles.some((role) => /^joueu(?:r|se)\b/i.test(role?.trim() || "")) ||
    !!(
      profile.position ||
      profile.secondary_positions?.length ||
      profile.strong_foot ||
      profile.weak_foot
    )
  );
}

export function profileAge(
  birthdate: string | null | undefined,
  today = new Date(),
) {
  if (!birthdate || !validBirthdate(birthdate, today)) return null;
  const [year, month, day] = birthdate.split("-").map(Number);
  const birthdayPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  const age = today.getFullYear() - year - (birthdayPassed ? 0 : 1);
  return age < 120 ? age : null;
}

export function profileMeasure(value: unknown, unit: string) {
  const valueText = text(value);
  if (!valueText) return null;
  return /[a-z]/i.test(valueText) ? valueText : `${valueText} ${unit}`;
}

export function profileQualifications(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? "title" in value || "name" in value
        ? [value]
        : Object.values(value)
      : [];
  return items.map(formatAchievement).filter((item) => item.trim());
}

// Only explicitly public profile fields are presented here, never authentication,
// moderation, billing or personal contact fields returned alongside the profile.
export function profileAboutSections(
  profile: Profile,
  ownProfile: boolean,
  today = new Date(),
): AboutSection[] {
  const organization = ["club", "business", "institution"].includes(
    profile.account_type || "",
  );
  const player = isPlayerProfile(profile);
  const age = profileAge(profile.birthdate, today);
  const label = (options: { value: string; label: string }[], value: unknown) =>
    options.find((option) => option.value === value)?.label || text(value);
  const sections: AboutSection[] = [];
  const add = (
    id: string,
    title: string,
    entries: [string, unknown][],
    placeholders = ownProfile,
  ) => {
    const fields = entries
      .map(([label, value]) => ({ label, value: text(value) }))
      .filter((field) => placeholders || field.value !== null);
    if (fields.length) sections.push({ id, title, fields });
  };
  const name =
    profile.full_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.username;
  if (organization) {
    add("identity", "Identité", [
      [
        "Nom",
        profile.club_official_name ||
          profile.business_name ||
          profile.institution_name ||
          name,
      ],
      [
        "Type de compte",
        profile.account_type === "club"
          ? "Club"
          : profile.account_type === "business"
            ? "Entreprise / Marque"
            : "Institution",
      ],
      ...(profile.account_type === "business"
        ? [
            [
              "Secteur",
              label(businessSectorOptions, profile.business_sector),
            ] as [string, unknown],
          ]
        : []),
      ...(profile.account_type === "institution"
        ? ([
            ["Type", label(institutionTypeOptions, profile.institution_type)],
            [
              "Niveau",
              label(institutionLevelOptions, profile.institution_level),
            ],
          ] as [string, unknown][])
        : []),
    ]);
  } else {
    add("identity", "Identité", [
      ["Nom", name],
      [
        "Nom d’utilisateur",
        profile.username ? `@${profile.username.replace(/^@/, "")}` : null,
      ],
      ["Rôle dans le football", profile.primary_role],
      ["Rôles secondaires", profile.secondary_roles],
      ["Âge", age !== null ? `${age} ans` : null],
      ...(ownProfile
        ? [
            [
              "Date de naissance",
              validBirthdate(profile.birthdate || "", today)
                ? frenchCalendarDate(profile.birthdate!)
                : null,
            ] as [string, unknown],
          ]
        : []),
      ["Nationalité", countryLabel(profile.nationality)],
      ["Genre", profile.gender],
    ]);
  }
  add("presentation", "À propos", [["Présentation", profile.bio]]);
  add("location", "Localisation", [
    ["Ville", profile.city],
    ["Département", profile.department],
    ["Pays de résidence", countryLabel(profile.country)],
  ]);
  if (!organization) {
    add("football", player ? "Profil football" : "Activité football", [
      ["Club / Structure", profile.club],
      ["Plus haut niveau", profile.highest_level],
      ...(player
        ? ([
            ["Poste principal", profile.position],
            ["Postes secondaires", profile.secondary_positions],
            ["Pied fort", profile.strong_foot],
            ["Pied faible", profile.weak_foot],
            ["Temps de jeu moyen", profile.average_playtime],
          ] as [string, unknown][])
        : []),
    ]);
    if (player || profile.height || profile.weight)
      add("physical", "Informations physiques", [
        ["Taille", profileMeasure(profile.height, "cm")],
        ["Poids", profileMeasure(profile.weight, "kg")],
      ]);
    add("skills", "Compétences et points forts", [
      ["Compétences", profile.skills],
      ["Qualités techniques", profile.technical_skills],
      ["Points forts", profile.characteristics],
    ]);
    add("favorites", "Clubs favoris", [
      ["Club professionnel", profile.favorite_pro_club],
      ["Club amateur", profile.favorite_amateur_club],
    ]);
    add(
      "education",
      "Formations et diplômes",
      [
        ["Formations", profileQualifications(profile.education).join("\n")],
        [
          "Diplômes et certifications",
          profileQualifications(profile.certifications).join("\n"),
        ],
        [
          "Formation football",
          profileQualifications(profile.training_history).join("\n"),
        ],
      ],
      false,
    );
  }
  return sections;
}
