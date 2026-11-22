import { countries } from "../data/countries";

type ClubLocation = {
  city?: string | null;
  department_code?: string | null;
  department_name?: string | null;
  country?: string | null;
  country_code?: string | null;
  metadata?: unknown;
};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const metadata = (club: ClubLocation): Record<string, unknown> =>
  club.metadata && typeof club.metadata === "object" && !Array.isArray(club.metadata)
    ? club.metadata as Record<string, unknown>
    : {};

export function clubCountryCode(club: ClubLocation) {
  return (text(metadata(club).country_code) || text(club.country_code)).toUpperCase();
}

export function clubCountryLabel(club: ClubLocation) {
  const code = clubCountryCode(club);
  return text(metadata(club).country) || text(club.country) ||
    countries.find((country) => country.code === code)?.name || code;
}

// INT is an import marker, not a location. Keep existing French department
// labels while showing the reviewed country for international club records.
export function clubLocationLabel(club: ClubLocation, departmentName = false) {
  const country = clubCountryLabel(club);
  const code = clubCountryCode(club);
  const department = text(club.department_code);
  const international = department.toUpperCase() === "INT" ||
    (code ? code !== "FR" : !!country && country.toLowerCase() !== "france");
  const region = international ? country :
    (departmentName && text(club.department_name)) || department || country;
  return [...new Set([text(club.city), region].filter(Boolean))].join(" · ");
}
