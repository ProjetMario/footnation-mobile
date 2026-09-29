import { countries } from "../data/countries";
import { proClubGroups } from "../data/proClubGroups";
export const countryOptions = countries.map((country) => ({
  value: country.code,
  label: `${country.flag} ${country.name}`,
}));
export const countryLabel = (value?: string | null) =>
  countries.find((country) => country.code === value)?.name || value;
export const normalizeSuggestion = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const proClubOptions = proClubGroups.flatMap((group) =>
  group.clubs.map((name) => ({
    value: name,
    label: `${name} · ${group.label}`,
  })),
);
