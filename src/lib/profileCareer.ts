import type { Profile as ProfileModel } from "./models";
import { formatAchievement } from "./profileFormatting";

type ProfileExperience = {
  club: string;
  clubId?: string | null;
  position: string;
  level: string;
  ageCategory: string;
  startYear: string;
  endYear: string;
  isHighestLevel: boolean;
  highestYear?: string;
};

const levelOrder = [
  "Ligue 1",
  "Ligue 2",
  "National",
  "National 2",
  "National 3",
  "Régional 1",
  "Régional 2",
  "Régional 3",
  "Départemental 1",
  "Départemental 2",
  "Départemental 3",
  "Départemental 4",
  "Départemental 5",
  "Futsal / Loisirs",
];

function cleanValue(value: string | number | null | undefined) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}
function cleanUnknownValue(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? cleanValue(value)
    : null;
}
function normalizeExperienceValue(
  value: unknown,
  profile: ProfileModel | null | undefined,
): ProfileExperience | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!Object.values(value).some((item) => cleanUnknownValue(item)))
    return null;
  const item = value as Record<string, unknown>;
  return {
    clubId: typeof item.club_id === "string" ? item.club_id : null,
    club:
      cleanUnknownValue(item.club) ||
      cleanUnknownValue(item.club_name) ||
      profile?.club ||
      "",
    position:
      cleanUnknownValue(item.position) ||
      cleanUnknownValue(item.role) ||
      profile?.position ||
      "",
    level:
      cleanUnknownValue(item.level) ||
      cleanUnknownValue(item.competition) ||
      cleanUnknownValue(item.current_level) ||
      "",
    ageCategory:
      cleanUnknownValue(item.ageCategory) ||
      cleanUnknownValue(item.age_category) ||
      "",
    startYear:
      cleanUnknownValue(item.startYear) ||
      cleanUnknownValue(item.start_year) ||
      cleanUnknownValue(item.start) ||
      "",
    endYear:
      cleanUnknownValue(item.endYear) ||
      cleanUnknownValue(item.end_year) ||
      cleanUnknownValue(item.end) ||
      "Présent",
    isHighestLevel: item.is_highest_level === true,
    highestYear: cleanUnknownValue(item.highest_year) || undefined,
  };
}
export function normalizeExperiences(profile: ProfileModel | null | undefined) {
  let source: unknown[] = Array.isArray(profile?.experience_history)
    ? profile.experience_history
    : [];
  if (!source.length && Array.isArray(profile?.experience))
    source = profile.experience;
  if (
    !source.length &&
    typeof profile?.experience === "string" &&
    profile.experience.trim()
  ) {
    try {
      const legacy: unknown = JSON.parse(profile.experience);
      source = Array.isArray(legacy) ? legacy : [legacy];
    } catch {
      source = [
        {
          level: profile.experience,
          club: profile.club,
          position: profile.position,
        },
      ];
    }
  }
  const experiences = source
    .map((value) => normalizeExperienceValue(value, profile))
    .filter((value): value is ProfileExperience => !!value)
    .sort((a, b) => {
      const endA = experienceYearScore(a.endYear);
      const endB = experienceYearScore(b.endYear);
      if (endB !== endA) return endB - endA;
      return (
        experienceYearScore(b.startYear) - experienceYearScore(a.startYear)
      );
    });
  if (experiences.length > 0) return experiences;
  if (!profile?.club && !profile?.highest_level && !profile?.position)
    return [];
  return [
    {
      club: profile.club || "",
      clubId: profile.linked_club_id,
      position: profile.position || "",
      level: profile.highest_level || "",
      ageCategory: "",
      startYear: "",
      endYear: "Présent",
      isHighestLevel: true,
    },
  ];
}
function experienceYearScore(value: string) {
  if (value === "Présent" || value === "Aujourd’hui") return 9999;
  return Number.parseInt(value, 10) || 0;
}
function levelPriority(level: string | null | undefined) {
  if (!level) return levelOrder.length + 1;
  const index = levelOrder.findIndex((item) => item === level);
  return index >= 0 ? index : levelOrder.length;
}
export function getBestExperience(
  experiences: ProfileExperience[],
  profileHighestLevel?: string | null,
) {
  const manuallySelected = experiences.find((item) => item.isHighestLevel);
  if (manuallySelected?.level) return manuallySelected;
  const best = experiences.reduce<ProfileExperience | null>((current, item) => {
    if (!current) return item;
    const currentScore = levelPriority(current.level);
    const itemScore = levelPriority(item.level);
    if (itemScore < currentScore) return item;
    if (itemScore === currentScore) {
      return experienceYearScore(item.endYear) >
        experienceYearScore(current.endYear)
        ? item
        : current;
    }
    return current;
  }, null);
  if (best?.level) return best;
  return profileHighestLevel
    ? {
        club: "",
        position: "",
        level: profileHighestLevel,
        ageCategory: "",
        startYear: "",
        endYear: "",
        isHighestLevel: true,
      }
    : null;
}
export function formatExperienceYears(experience: ProfileExperience) {
  const years = [experience.startYear, experience.endYear]
    .map((item) => item.trim())
    .filter(Boolean);
  return years.length > 0 ? years.join(" - ") : "Dates à compléter";
}
export function normalizeAchievements(value: unknown[] | null | undefined) {
  if (!Array.isArray(value)) return [];
  return value
    .map(formatAchievement)
    .map((item) => item.trim())
    .filter(Boolean);
}
