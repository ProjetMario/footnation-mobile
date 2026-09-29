import type { Club, Profile } from "./models";
import type { ClubSearchType } from "./clubSearch";
import { supabase } from "./supabase";

export const clubDirectoryColumns =
  "id,name,short_name,city,department_code,department_name,logo_url,type,latitude,longitude";
const normalize = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function matchesDirectoryClub(
  club: Club,
  search: string,
  department: string,
  type: ClubSearchType,
) {
  const indoor =
    club.type === "five_center" ||
    /five|soccer|urban|foot indoor|futsal/i.test(club.name);
  return (
    (!department || club.department_code === department) &&
    (type === "all" || (type === "five_center" ? indoor : !indoor)) &&
    (!search.trim() ||
      normalize([club.name, club.short_name, club.city].join(" ")).includes(
        normalize(search),
      ))
  );
}
export function profileDepartment(value?: string | null) {
  return (
    value
      ?.trim()
      .toUpperCase()
      .match(/^(97[1-6]|98[4-8]|2A|2B|\d{2})(?:\s|$|-)/)?.[1] || ""
  );
}
export function uniqueDirectoryClubs(...groups: Club[][]) {
  return [...new Map(groups.flat().map((club) => [club.id, club])).values()];
}
export async function loadRelatedClubs(profile: Profile, signal?: AbortSignal) {
  const [following, memberships] = await Promise.all([
    supabase
      .from("club_followers")
      .select("club_id")
      .eq("profile_id", profile.id)
      .abortSignal(signal!),
    supabase
      .from("team_members")
      .select("team:teams!inner(club_id)")
      .eq("profile_id", profile.id)
      .eq("is_active", true)
      .eq("status", "approved")
      .abortSignal(signal!),
  ]);
  if (following.error) throw following.error;
  if (memberships.error) throw memberships.error;
  const ids = [
    ...new Set(
      [
        profile.linked_club_id,
        ...(following.data || []).map((row) => row.club_id),
        ...(memberships.data || []).flatMap((row) => {
          const teams = row.team as unknown as
            { club_id: string } | { club_id: string }[] | null;
          return (Array.isArray(teams) ? teams : teams ? [teams] : []).map(
            (team) => team.club_id,
          );
        }),
      ].filter((id): id is string => !!id),
    ),
  ];
  const names = [
    profile.club,
    profile.favorite_pro_club,
    profile.favorite_amateur_club,
  ].filter((name): name is string => !!name?.trim());
  const [byId, byName] = await Promise.all([
    ids.length
      ? supabase
          .from("fff_clubs")
          .select(clubDirectoryColumns)
          .in("id", ids)
          .abortSignal(signal!)
      : { data: [], error: null },
    names.length
      ? supabase
          .from("fff_clubs")
          .select(clubDirectoryColumns)
          .or(
            names
              .flatMap((name) =>
                ["name", "short_name"].map(
                  (key) =>
                    `${key}.ilike.${JSON.stringify(name.replace(/[%_\\]/g, "\\$&"))}`,
                ),
              )
              .join(","),
          )
          .abortSignal(signal!)
      : { data: [], error: null },
  ]);
  if (byId.error) throw byId.error;
  if (byName.error) throw byName.error;
  return uniqueDirectoryClubs(
    (byId.data || []) as Club[],
    (byName.data || []) as Club[],
  ).sort(
    (a, b) =>
      Number(b.id === profile.linked_club_id) -
        Number(a.id === profile.linked_club_id) ||
      a.name.localeCompare(b.name, "fr"),
  );
}
