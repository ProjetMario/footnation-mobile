export type ClubTeam = {
  id: string;
  name: string;
  category?: string | null;
  shortName?: string | null;
  competition?: { name?: string | null } | null;
};

export type TeamSection = "seniors" | "academy" | "other";
export type TeamGender = "men" | "women" | "mixed" | "unknown";
export type PresentedClubTeam = {
  team: ClubTeam;
  section: TeamSection;
  gender: TeamGender;
  category: string;
  age: number;
  number: number | null;
  title: string;
};
export type ClubTeamFilters = {
  section: TeamSection | "all";
  gender: TeamGender | "all";
  category: string;
  search: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function genderFrom(value: string): TeamGender {
  if (/\bmixte?s?\b/.test(value)) return "mixed";
  if (/\bf\s*\d*\b|feminin|women|girls/.test(value)) return "women";
  if (/\bm\s*\d*\b|masculin|\bhommes?\b|\bmen\b|boys/.test(value)) return "men";
  return "unknown";
}

export function presentClubTeam(team: ClubTeam): PresentedClubTeam {
  const categoryText = normalize(
    team.category?.trim() || team.shortName?.trim() || "",
  );
  // Structured categories take priority over words in a club's display name.
  const nameText = normalize(team.name);
  const categoryGender = genderFrom(categoryText);
  const gender =
    categoryGender !== "unknown" ? categoryGender : genderFrom(nameText);
  const agesIn = (text: string) =>
    [...text.matchAll(/\bu\s*(\d{1,2})\b/g)]
      .map((match) => Number(match[1]))
      .filter((age) => age >= 5 && age <= 23);
  const categoryAges = agesIn(categoryText);
  const ages = [
    ...new Set(categoryAges.length ? categoryAges : agesIn(nameText)),
  ].sort((a, b) => a - b);
  const text = categoryText || nameText;
  const numberMatch = categoryText.match(/\b[fm]\s*(\d+)\b|\bequipe\s*(\d+)\b/);
  const number = numberMatch ? Number(numberMatch[1] || numberMatch[2]) : null;
  let section: TeamSection = "other";
  let category = team.category?.trim() || "Autres";
  let age = 0;
  if (ages.length) {
    section = "academy";
    age = Math.max(...ages);
    category = ages.map((value) => `U${value}`).join(" / ");
  } else if (/\bseniors?\b/.test(text)) {
    section = "seniors";
    category = "Séniors";
  } else {
    const legacy = [
      [/\bjuniors?\b/, "Juniors", 19],
      [/\bcadets?\b/, "Cadets", 17],
      [/\bminimes?\b/, "Minimes", 15],
      [/\bbenjamins?\b/, "Benjamins", 13],
      [/\bpoussins?\b/, "Poussins", 11],
      [/\bdebutants?\b/, "Débutants", 7],
    ] as const;
    const youth = legacy.find(([pattern]) => pattern.test(text));
    if (youth) {
      section = "academy";
      category = youth[1];
      age = youth[2];
    } else if (/\bveterans?\b/.test(text)) category = "Vétérans";
    else if (/\bloisirs?\b/.test(text)) category = "Loisirs";
  }
  const title =
    section === "seniors"
      ? `Séniors${number ? ` ${number}` : ""}`
      : section === "academy"
        ? `${category}${number ? ` · Équipe ${number}` : ""}`
        : team.name || category;
  return { team, section, gender, category, age, number, title };
}

export function sortClubTeams(teams: ClubTeam[]): PresentedClubTeam[] {
  const sections = { seniors: 0, academy: 1, other: 2 };
  const genders = { men: 0, women: 1, mixed: 2, unknown: 3 };
  return teams
    .map(presentClubTeam)
    .sort(
      (a, b) =>
        sections[a.section] - sections[b.section] ||
        b.age - a.age ||
        a.category.localeCompare(b.category, "fr", { numeric: true }) ||
        genders[a.gender] - genders[b.gender] ||
        (a.number ?? 99) - (b.number ?? 99) ||
        a.team.name.localeCompare(b.team.name, "fr", { numeric: true }) ||
        a.team.id.localeCompare(b.team.id),
    );
}

export function filterClubTeams(
  teams: PresentedClubTeam[],
  filters: ClubTeamFilters,
) {
  const words = normalize(filters.search).trim().split(/\s+/).filter(Boolean);
  return teams.filter((item) => {
    if (filters.section !== "all" && item.section !== filters.section)
      return false;
    if (filters.gender !== "all" && item.gender !== filters.gender)
      return false;
    if (filters.category !== "all" && item.category !== filters.category)
      return false;
    const text = normalize(
      [
        item.team.name,
        item.team.category,
        item.title,
        item.team.competition?.name,
        { men: "masculins", women: "féminines", mixed: "mixte", unknown: "" }[
          item.gender
        ],
      ].join(" "),
    );
    return words.every((word) => text.includes(word));
  });
}
