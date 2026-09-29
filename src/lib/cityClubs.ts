import { supabase } from "./supabase";
import { citySlug } from "./citySlug";
export type CityClub = {
  id: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  type: string | null;
};
export function groupCityClubs(clubs: CityClub[]) {
  const groups = new Map<
    string,
    { slug: string; name: string; clubs: CityClub[] }
  >();
  for (const club of clubs) {
    const slug = citySlug(club.city);
    if (!slug) continue;
    let group = groups.get(slug);
    if (!group) {
      group = { slug, name: club.city!, clubs: [] };
      groups.set(slug, group);
    }
    group.clubs.push(club);
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.clubs.length - a.clubs.length || a.name.localeCompare(b.name, "fr"),
  );
}
export async function loadDepartmentCityClubs(code: string) {
  const clubs: CityClub[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await supabase
      .from("fff_clubs")
      .select("id,name,city,logo_url,type")
      .eq("department_code", code)
      .order("name")
      .order("id")
      .range(offset, offset + 499);
    if (result.error) throw result.error;
    clubs.push(...result.data);
    if (result.data.length < 500) return groupCityClubs(clubs);
  }
}
