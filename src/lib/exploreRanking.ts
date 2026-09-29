import type { Profile, Club } from "./models";
import { supabase } from "./supabase";
import { blockedSocialAuthors } from "./socialVisibility";
import { loadRelatedClubs, profileDepartment } from "./clubDiscovery";
import { distanceKm, validMapLocation, type MapLocation } from "./clubMap";
import {
  searchFootNation,
  type SearchCategory,
  type SearchResult,
} from "./globalSearch";
import { isSuspended } from "./validation";
export type ExploreContext = {
  profile: Profile;
  clubs: Club[];
  following: string[];
  blocked: string[];
  location: MapLocation | null;
};
const normalize = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const exact = (field: string, value: string) =>
  `${field}.ilike.${JSON.stringify(value.replace(/[%_\\]/g, "\\$&"))}`;
export async function loadExploreContext(
  profile: Profile,
  location: MapLocation | null,
  signal: AbortSignal,
): Promise<ExploreContext> {
  const [clubs, blocked, follows] = await Promise.all([
    loadRelatedClubs(profile, signal),
    blockedSocialAuthors(profile.id),
    supabase
      .from("profile_followers")
      .select("followed_id")
      .eq("follower_id", profile.id)
      .abortSignal(signal),
  ]);
  if (follows.error) throw follows.error;
  return {
    profile,
    clubs,
    blocked,
    following: (follows.data || []).map((row) => row.followed_id),
    location,
  };
}
type Candidate = {
  id: string;
  name?: string;
  full_name?: string;
  username?: string;
  city?: string;
  department_code?: string;
  department?: string;
  club?: string;
  position?: string;
  highest_level?: string;
  favorite_pro_club?: string;
  favorite_amateur_club?: string;
  latitude?: number;
  longitude?: number;
  created_at?: string;
};
export function exploreAffinity(
  row: Candidate,
  kind: "clubs" | "profiles",
  context: ExploreContext,
) {
  const me = context.profile;
  let score = 0;
  let reason = "";
  const award = (value: number, label: string) => {
    score += value;
    if (!reason) reason = label;
  };
  if (kind === "clubs" && context.clubs.some((club) => club.id === row.id))
    award(1000, "Club lié à votre profil");
  if (
    kind === "profiles" &&
    row.club &&
    context.clubs.some(
      (club) =>
        normalize(club.name) === normalize(row.club) ||
        normalize(club.short_name) === normalize(row.club),
    )
  )
    award(600, "Un club en commun");
  if (
    kind === "clubs" &&
    context.location &&
    row.latitude != null &&
    row.longitude != null &&
    validMapLocation({
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    })
  ) {
    const km = distanceKm(context.location, {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    });
    if (km <= 100)
      award(
        500 - km * 3,
        `${km < 1 ? "Moins de 1" : Math.round(km)} km de vous`,
      );
  }
  if (me.city && normalize(row.city) === normalize(me.city))
    award(300, "Dans votre ville");
  const dept = profileDepartment(me.department);
  if (
    dept &&
    (row.department_code === dept || profileDepartment(row.department) === dept)
  )
    award(100, "Dans votre département");
  if (kind === "profiles") {
    if (
      me.favorite_pro_club &&
      normalize(row.favorite_pro_club) === normalize(me.favorite_pro_club)
    )
      award(80, "Un club favori en commun");
    if (
      me.favorite_amateur_club &&
      normalize(row.favorite_amateur_club) ===
        normalize(me.favorite_amateur_club)
    )
      award(80, "Un club favori en commun");
    if (me.highest_level && row.highest_level === me.highest_level)
      award(30, "Même niveau de jeu");
    if (me.position && row.position === me.position) award(20, "Même poste");
  }
  return { score, reason };
}
export async function loadExplorePriority(
  context: ExploreContext,
  kind: SearchCategory,
  term: string,
  signal: AbortSignal,
): Promise<SearchResult[]> {
  if (kind !== "clubs" && kind !== "profiles") return [];
  const me = context.profile;
  const filters: string[] = [];
  const dept = profileDepartment(me.department);
  if (me.city) filters.push(exact("city", me.city));
  if (dept)
    filters.push(
      kind === "clubs"
        ? `department_code.eq.${dept}`
        : `department.ilike.${JSON.stringify(`${dept}%`)}`,
    );
  if (kind === "clubs") {
    if (context.clubs.length)
      filters.push(`id.in.(${context.clubs.map((row) => row.id).join(",")})`);
    if (context.location) {
      const { latitude, longitude } = context.location;
      const dy = 100 / 111;
      const dx = Math.min(
        180,
        dy / Math.max(0.05, Math.cos((latitude * Math.PI) / 180)),
      );
      filters.push(
        `and(latitude.gte.${latitude - dy},latitude.lte.${latitude + dy},longitude.gte.${longitude - dx},longitude.lte.${longitude + dx})`,
      );
    }
  } else {
    for (const key of [
      "club",
      "favorite_pro_club",
      "favorite_amateur_club",
      "position",
      "highest_level",
    ] as const)
      if (me[key]) filters.push(exact(key, me[key]!));
    for (const club of context.clubs) filters.push(exact("club", club.name));
  }
  if (!filters.length) return [];
  const candidates: any[] = [];
  // Rank the complete matching sector, not just the first alphabetical page.
  for (let offset = 0; ; offset += 500) {
    let q = supabase
      .from(kind === "clubs" ? "fff_clubs" : "profiles")
      .select(
        kind === "clubs"
          ? "id,name,short_name,city,department_code,logo_url,latitude,longitude"
          : "id,full_name,username,avatar_url,city,department,club,position,highest_level,favorite_pro_club,favorite_amateur_club,is_suspended,suspended_until",
      )
      .or(filters.join(","))
      .order("id")
      .range(offset, offset + 499)
      .abortSignal(signal);
    if (term.trim())
      q = q.or(
        (kind === "clubs"
          ? ["name", "short_name", "city"]
          : ["full_name", "username", "club", "city", "position"]
        )
          .map(
            (field) =>
              `${field}.ilike.${JSON.stringify(`%${term.trim().replace(/[%_\\]/g, "\\$&")}%`)}`,
          )
          .join(","),
      );
    if (kind === "profiles") {
      q = q
        .neq("id", me.id)
        .or("account_type.is.null,account_type.eq.personal")
        .or("primary_role.ilike.joueu%,position.not.is.null");
      if (context.blocked.length)
        q = q.not("id", "in", `(${context.blocked.join(",")})`);
    }
    const { data, error } = await q;
    if (error) throw error;
    candidates.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return candidates
    .filter((row) => kind !== "profiles" || !isSuspended(row))
    .map((row) => ({ row, ...exploreAffinity(row, kind, context) }))
    .filter((row) => row.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.row.name || a.row.full_name || "").localeCompare(
          b.row.name || b.row.full_name || "",
          "fr",
        ) ||
        a.row.id.localeCompare(b.row.id),
    )
    .slice(0, 120)
    .map(({ row, reason }) => ({
      id: `${kind}:${row.id}`,
      kind,
      title: row.name || row.full_name || row.username || "Membre FootNation",
      subtitle: [row.club, row.city, row.department_code]
        .filter(Boolean)
        .join(" · "),
      reason,
      image: row.logo_url || row.avatar_url || null,
      link: `/${kind === "clubs" ? "club" : "profile"}/${row.id}`,
    }));
}
export async function searchWithPriorities(
  uid: string,
  term: string,
  kind: SearchCategory,
  offset: number,
  priority: SearchResult[],
) {
  const first = priority.slice(offset, offset + 20);
  if (first.length === 20) return { rows: first, hasMore: true };
  const rest = await searchFootNation(
    uid,
    term,
    kind,
    Math.max(0, offset - priority.length),
    undefined,
    !term,
    priority.map((row) => row.id.slice(row.id.indexOf(":") + 1)),
  );
  return {
    rows: [...first, ...rest.rows.slice(0, 20 - first.length)],
    hasMore: rest.hasMore || rest.rows.length > 20 - first.length,
  };
}
