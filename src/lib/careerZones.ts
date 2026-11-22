import { countries } from "../data/countries";
import { FRENCH_DEPARTMENTS } from "../data/french-departments";
import type { GoalValues } from "./careerGoals";

export type CareerZoneKind = "city" | "department" | "region" | "country";
// Complete the existing country catalogue locally, without changing other screens.
// Includes the 249 ISO 3166-1 countries and territories, with French display labels.
const additionalCountries = [
  { code: "AQ", name: "Antarctique" },
  { code: "AX", name: "Îles Åland" },
  { code: "BQ", name: "Bonaire, Saint-Eustache et Saba" },
  { code: "CW", name: "Curaçao" },
  { code: "FK", name: "Îles Malouines" },
  { code: "HK", name: "Hong Kong" },
  { code: "MO", name: "Macao" },
  { code: "MP", name: "Îles Mariannes du Nord" },
  { code: "NC", name: "Nouvelle-Calédonie" },
  { code: "PS", name: "Palestine" },
  { code: "RE", name: "La Réunion" },
  { code: "RU", name: "Russie" },
  { code: "SH", name: "Sainte-Hélène, Ascension et Tristan da Cunha" },
  { code: "SX", name: "Saint-Martin (partie néerlandaise)" },
];
export const careerCountryOptions = [
  ...new Map(
    [...countries, ...additionalCountries].map((country) => [
      country.code,
      country,
    ]),
  ).values(),
]
  .map(({ code, name }) => ({
    code,
    value: code === "GB" ? "Royaume-Uni" : name,
    label: code === "GB" ? "Royaume-Uni" : name,
  }))
  .sort((a, b) => a.label.localeCompare(b.label, "fr"));

export const careerDepartmentOptions = FRENCH_DEPARTMENTS.map(
  ({ code, name }) => ({
    value: `${code} - ${name}`,
    label: `${code} - ${name}`,
  }),
);
export const careerRegionOptions = [
  ...new Set(FRENCH_DEPARTMENTS.map((department) => department.region)),
]
  .sort((a, b) => a.localeCompare(b, "fr"))
  .map((name) => ({ value: name, label: name }));

export function inferCareerZoneKind(
  values: Pick<GoalValues, "zone" | "zoneCity">,
): CareerZoneKind {
  if (values.zoneCity) return "city";
  if (careerDepartmentOptions.some(({ value }) => value === values.zone))
    return "department";
  if (careerRegionOptions.some(({ value }) => value === values.zone))
    return "region";
  if (careerCountryOptions.some(({ value }) => value === values.zone))
    return "country";
  return "city";
}

export function selectCareerArea(
  zone: string,
): Pick<GoalValues, "zone" | "zoneCity" | "zoneDepartment"> {
  // A broad search area is never stored as a city; existing publication contracts remain intact.
  return { zone, zoneCity: "", zoneDepartment: "" };
}
