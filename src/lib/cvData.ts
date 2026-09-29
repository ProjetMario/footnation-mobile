import { normalizeExperiences } from "./profileCareer";
import {
  profileAge,
  profileMeasure,
  profileQualifications,
} from "./profileAbout";
import { countryLabel } from "./profileSelectionOptions";
import { formatAchievement } from "./profileFormatting";
import type { Profile } from "./models";
export { formatAchievement } from "./profileFormatting";
export type CVProfile = Record<string, any>;
export type CVSection = { title: string; lines: string[] };
const text = (value: unknown): string =>
  Array.isArray(value)
    ? value.map(text).filter(Boolean).join(" · ")
    : typeof value === "string" || typeof value === "number"
      ? String(value).trim()
      : "";

export function cvIdentity(profile: CVProfile) {
  return {
    name:
      text(profile.full_name) ||
      [profile.first_name, profile.last_name]
        .map(text)
        .filter(Boolean)
        .join(" ") ||
      text(profile.username) ||
      "Mon CV football",
    role: text(profile.position || profile.primary_role),
    club: text(profile.club),
    location: [profile.city, profile.department]
      .map(text)
      .filter(Boolean)
      .join(" · "),
    age: profileAge(profile.birthdate),
  };
}
export function cvCharacteristics(profile: CVProfile) {
  return [
    ["Taille", profileMeasure(profile.height, "cm")],
    ["Poids", profileMeasure(profile.weight, "kg")],
    ["Nationalité", countryLabel(profile.nationality)],
    ["Pied fort", profile.strong_foot],
  ].flatMap(([label, value]) =>
    text(value) ? [{ label: label!, value: text(value) }] : [],
  );
}
export function cvExperiences(profile: CVProfile) {
  return normalizeExperiences(profile as Profile).filter(
    (e) => e.club || e.level || e.position,
  );
}
export function cvSections(profile: CVProfile): CVSection[] {
  const id = cvIdentity(profile);
  const experiences = cvExperiences(profile);
  const hasHistory =
    (Array.isArray(profile.experience_history) &&
      profile.experience_history.length) ||
    profile.experience;
  const skills = [
    ...new Set(
      [text(profile.technical_skills), text(profile.skills)].filter(Boolean),
    ),
  ];
  const sections: CVSection[] = [
    { title: "Présentation", lines: [text(profile.bio)] },
    {
      title: "Informations",
      lines: [
        id.role,
        id.club,
        id.location,
        id.age !== null ? `Âge : ${id.age} ans` : "",
        ...cvCharacteristics(profile).map((d) => `${d.label} : ${d.value}`),
        profile.email && `E-mail : ${text(profile.email)}`,
        profile.phone && `Téléphone : ${text(profile.phone)}`,
      ],
    },
    { title: "Compétences techniques", lines: skills },
    { title: "Points forts", lines: [text(profile.characteristics)] },
    {
      title: "Parcours",
      lines: hasHistory
        ? experiences.map((e) =>
            [
              e.position,
              e.club,
              e.startYear
                ? `${e.startYear} – ${e.endYear || "Présent"}`
                : e.endYear !== "Présent"
                  ? e.endYear
                  : "",
              e.ageCategory,
              e.level,
            ]
              .filter(Boolean)
              .join(" · "),
          )
        : profile.club
          ? [[id.role, id.club].filter(Boolean).join(" · ")]
          : [],
    },
    {
      title: "Distinctions",
      lines: profileQualifications(profile.achievements),
    },
    {
      title: "Distinctions individuelles",
      lines: profileQualifications(profile.individual_awards),
    },
    {
      title: "Autres rôles",
      lines: Array.isArray(profile.secondary_roles)
        ? profile.secondary_roles.map(text)
        : [],
    },
    { title: "Diplômes", lines: profileQualifications(profile.education) },
    {
      title: "Formation football",
      lines: profileQualifications(profile.training_history),
    },
    {
      title: "Certifications",
      lines: profileQualifications(profile.certifications),
    },
  ];
  return sections
    .map((s) => ({ ...s, lines: s.lines.filter(Boolean) }))
    .filter((s) => s.lines.length);
}
export function cvProfileUrl(profile: CVProfile) {
  return profile.id
    ? `https://www.foot-nation.com/profile/${encodeURIComponent(profile.id)}`
    : "";
}
export function cvFileName(profile: CVProfile, extension: "pdf" | "doc") {
  const name = cvIdentity(profile)
    .name.replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .slice(0, 80);
  return `CV_Football_${name || "FootNation"}.${extension}`;
}
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
