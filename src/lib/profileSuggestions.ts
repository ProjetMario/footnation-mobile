import { departmentOptions } from "./networkOptions";
import { clubSearchFilter } from "./clubSearch";
import { supabase } from "./supabase";
export type ProfileSuggestion = {
  id: string;
  name: string;
  detail: string;
  department?: string;
  logo?: string | null;
};
export function parseCitySuggestions(data: {
  features?: { properties?: Record<string, unknown> }[];
}): ProfileSuggestion[] {
  const rows: ProfileSuggestion[] = [];
  for (const feature of data.features || []) {
    const p = feature.properties || {};
    const name = p.city || p.name || p.label;
    const id = p.citycode || p.id;
    if (typeof name !== "string" || typeof id !== "string" || !name.trim())
      continue;
    const code = /^(97|98)/.test(id) ? id.slice(0, 3) : id.slice(0, 2);
    const department = departmentOptions.find((option) =>
      option.value.startsWith(`${code} - `),
    )?.value;
    rows.push({
      id,
      name,
      department,
      detail: [typeof p.postcode === "string" ? p.postcode : null, department]
        .filter(Boolean)
        .join(" · "),
    });
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()].slice(0, 8);
}
export async function searchProfileSuggestions(
  kind: "city" | "club",
  term: string,
  signal?: AbortSignal,
): Promise<ProfileSuggestion[]> {
  const text = term.trim();
  if (text.length < 2) return [];
  if (kind === "city") {
    const params = new URLSearchParams({
      q: text,
      type: "municipality",
      limit: "8",
    });
    const response = await fetch(
      `https://data.geopf.fr/geocodage/search?${params}`,
      { signal },
    );
    if (!response.ok)
      throw new Error(
        "La recherche des villes est momentanément indisponible.",
      );
    return parseCitySuggestions(await response.json());
  }
  const { data, error } = await supabase
    .from("fff_clubs")
    .select("id,name,city,department_code,logo_url")
    .or(clubSearchFilter(text, "all")!)
    .order("name")
    .order("id")
    .limit(8)
    .abortSignal(signal!);
  if (error) throw error;
  return (data || []).map((club) => ({
    id: club.id,
    name: club.name,
    detail: [club.city, club.department_code].filter(Boolean).join(" · "),
    logo: club.logo_url,
  }));
}
