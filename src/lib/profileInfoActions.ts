import type { Profile } from "./models";
import { professionalContactUrl } from "./professionalContact";
import { websiteUrl } from "./websiteUrl";

export type ProfileInfoAction =
  { label: string; href: string } | { label: string; url: string };
export type ProfileInfo = {
  label: string;
  value: string | null;
  actions?: ProfileInfoAction[];
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function clubInfoAction(
  name: string,
  id?: string | null,
): ProfileInfoAction {
  return {
    label: "Voir le club",
    href:
      id && uuid.test(id)
        ? `/club/${id}`
        : `/search?type=clubs&q=${encodeURIComponent(name)}`,
  };
}

export const profileInfoSearchFields = {
  primary_role: "Rôle",
  secondary_roles: "Rôles secondaires",
  position: "Poste",
  secondary_positions: "Postes secondaires",
  highest_level: "Niveau",
  skills: "Compétence",
  city: "Ville",
  department: "Département",
  country: "Pays",
  nationality: "Nationalité",
} as const;
export type ProfileInfoSearchField = keyof typeof profileInfoSearchFields;
export function parseProfileInfoSearchField(
  value: unknown,
): ProfileInfoSearchField | undefined {
  return typeof value === "string" &&
    Object.hasOwn(profileInfoSearchFields, value)
    ? (value as ProfileInfoSearchField)
    : undefined;
}
export const profileInfoArrayFields: ProfileInfoSearchField[] = [
  "skills",
  "secondary_roles",
  "secondary_positions",
];

export function profileInfoActions(
  profile: Profile,
  section: string,
  label: string,
  value: string | null,
  own: boolean,
): ProfileInfoAction[] {
  const actions: ProfileInfoAction[] = [];
  if (own) {
    const unsupported = [
      "Rôles secondaires",
      "Postes secondaires",
      "Pied faible",
      "Temps de jeu moyen",
    ];
    if (section === "education")
      actions.push({ label: "Modifier mes formations", href: "/education" });
    else if (!unsupported.includes(label)) {
      const basic = [
        "Nom",
        "Nom d’utilisateur",
        "Rôle dans le football",
        "Poste principal",
        "Club / Structure",
        "Ville",
        "Département",
        "Pays de résidence",
        "Nationalité",
      ];
      const destination =
        basic.includes(label) ||
        ["club", "business", "institution"].includes(profile.account_type || "")
          ? "profile"
          : "content";
      actions.push({
        label: value
          ? "Modifier cette information"
          : "Compléter cette information",
        href: `/settings?section=${destination}`,
      });
    }
  }
  if (!value) return actions;
  if (
    [
      "Club / Structure",
      "Club professionnel",
      "Club amateur",
      "Nom officiel",
      "Club",
    ].includes(label)
  )
    actions.push(
      clubInfoAction(
        value,
        ["Club / Structure", "Nom officiel"].includes(label)
          ? profile.linked_club_id
          : null,
      ),
    );
  const fields: Record<string, ProfileInfoSearchField> = {
    "Rôle dans le football": "primary_role",
    "Rôles secondaires": "secondary_roles",
    "Poste principal": "position",
    "Postes secondaires": "secondary_positions",
    "Plus haut niveau": "highest_level",
    Compétences: "skills",
    Ville: "city",
    Département: "department",
    "Pays de résidence": "country",
    Nationalité: "nationality",
  };
  const field = fields[label];
  if (field) {
    const terms =
      profileInfoArrayFields.includes(field) && Array.isArray(profile[field])
        ? (profile[field] as string[])
        : [value];
    for (const term of terms.filter((term) => term.trim()))
      actions.push({
        label: `Profils · ${term}`,
        href: `/search?type=profiles&field=${field}&q=${encodeURIComponent(term)}`,
      });
  }
  if (["Ville", "Département", "Pays de résidence", "Adresse"].includes(label))
    actions.push({
      label: "Voir sur la carte",
      url: professionalContactUrl("address", value),
    });
  try {
    if (label.includes("mail"))
      actions.push({
        label: "Écrire un email",
        url: professionalContactUrl("email", value),
      });
    if (label === "Téléphone")
      actions.push({
        label: "Ouvrir le téléphone",
        url: professionalContactUrl("phone", value),
      });
    if (label === "Site internet")
      actions.push({
        label: "Visiter le site internet",
        url: websiteUrl(value),
      });
  } catch {
    /* The full value stays readable and copyable if a contact is invalid. */
  }
  return actions;
}
