import { departmentOptions } from "./networkOptions";
import { clubSearchFilter } from "./clubSearch";
import { supabase } from "./supabase";
import { clubLocationLabel } from "./clubLocation";
export type ProfileSuggestion = {
  id: string;
  name: string;
  username?: string | null;
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
  kind: "city" | "club" | "profile",
  term: string,
  signal?: AbortSignal,
): Promise<ProfileSuggestion[]> {
  const text = term.trim();
  if (text.length < (kind === "club" || kind === "profile" ? 3 : 2)) return [];
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
  if (kind === "profile") {
    const pattern = `%${text.replace(/[%_\\]/g, "\\$&")}%`;
    const result = await supabase
      .from("profiles")
      .select("id,full_name,username,avatar_url")
      .or(`full_name.ilike.${pattern},username.ilike.${pattern}`)
      .order("full_name")
      .limit(8);
    if (result.error) throw result.error;
    return (result.data || []).map((profile) => ({
      id: profile.id,
      name: profile.full_name || profile.username || "Profil FootNation",
      username: profile.username,
      detail: profile.username ? `@${profile.username}` : "Profil FootNation",
      logo: profile.avatar_url,
    }));
  }
  const search = () =>
    supabase
      .from("fff_clubs")
      .select("id,name,city,department_code,metadata,logo_url")
      .order("name")
      .order("id")
      .limit(8);
  // Match the site's club selector first: search the official club name.
  // Only broaden to city, short name or country when that lookup has no matches.
  const pattern = `%${text.replace(/[%_\\]/g, "\\$&")}%`;
  const byName = search().ilike("name", pattern);
  const first = await (signal ? byName.abortSignal(signal) : byName);
  if (first.error) throw first.error;
  let data = first.data;
  if (!data?.length) {
    const broader = search().or(clubSearchFilter(text, "all")!);
    const fallback = await (signal ? broader.abortSignal(signal) : broader);
    if (fallback.error) throw fallback.error;
    data = fallback.data;
  }
  return (data || []).map((club) => ({
    id: club.id,
    name: club.name,
    detail: clubLocationLabel(club),
    logo: club.logo_url,
  }));
}
