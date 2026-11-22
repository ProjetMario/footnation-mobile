import type { Profile } from "./models";

export type SupporterClubSeed = {
  clubId?: string;
  club?: string;
  city?: string;
};
export type ClubAffinity = "heart" | "current" | "followed";
export type SupporterClub = {
  id: string;
  name: string;
  short_name?: string | null;
  city?: string | null;
  logo_url?: string | null;
};
export type RelatedSupporterClub = SupporterClub & { reasons: ClubAffinity[] };
export type ClubAffinityProfile = Pick<
  Profile,
  | "id"
  | "club"
  | "linked_club_id"
  | "favorite_pro_club"
  | "favorite_amateur_club"
  | "city"
>;
export const affinityLabels: Record<ClubAffinity, string> = {
  heart: "Club de cœur",
  current: "Club actuel",
  followed: "Club suivi",
};
export const supporterClubId = (value: unknown): string | undefined =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : undefined;
function term(value: unknown) {
  return typeof value === "string" &&
    value.length <= 200 &&
    !/[\x00-\x1f\x7f]/.test(value)
    ? value.trim()
    : "";
}
export function supporterClubSeed(
  params: Record<string, unknown>,
): SupporterClubSeed {
  return {
    clubId: supporterClubId(params.clubId),
    club: term(params.club),
    city: term(params.city),
  };
}
export function supporterDiscoveryPath(
  input: SupporterClubSeed = {},
  create = false,
) {
  const seed = supporterClubSeed(input);
  const params = new URLSearchParams();
  if (seed.clubId) params.set("clubId", seed.clubId);
  else if (seed.club) params.set("club", seed.club);
  if (seed.city) params.set("city", seed.city);
  const suffix = params.toString();
  return `/supporters${create ? "/new" : ""}${suffix ? `?${suffix}` : ""}`;
}
export function supporterReturnPath(path: string): string | null {
  const [base, query, extra] = path.split("?");
  if (
    !["/supporters", "/supporters/new"].includes(base) ||
    !query ||
    extra ||
    path.includes("#")
  )
    return null;
  const params = new URLSearchParams(query);
  const keys = [...params.keys()];
  if (
    keys.some((key) => !["clubId", "club", "city"].includes(key)) ||
    new Set(keys).size !== keys.length
  )
    return null;
  const raw = Object.fromEntries(params);
  const seed = supporterClubSeed(raw);
  if (
    (raw.clubId && !seed.clubId) ||
    (raw.club && !seed.club) ||
    (raw.city && !seed.city)
  )
    return null;
  return supporterDiscoveryPath(seed, base.endsWith("/new"));
}
export const normalizeSupporterClubName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/** Name-only profile values are resolved only when unambiguous. No rights or membership are inferred. */
export function resolveSupporterClubAffinities(
  profile: ClubAffinityProfile,
  followed: SupporterClub[],
  candidates: SupporterClub[],
) {
  const related = new Map<string, RelatedSupporterClub>();
  const unresolved: { name: string; reason: ClubAffinity }[] = [];
  const add = (club: SupporterClub, reason: ClubAffinity) => {
    const prior = related.get(club.id);
    related.set(club.id, {
      ...club,
      reasons: [...new Set([...(prior?.reasons ?? []), reason])],
    });
  };
  const findName = (name: string | null | undefined, reason: ClubAffinity) => {
    if (!name?.trim()) return;
    const normalized = normalizeSupporterClubName(name);
    const matches = candidates.filter((c) =>
      [c.name, c.short_name].some(
        (n) => n && normalizeSupporterClubName(n) === normalized,
      ),
    );
    if (matches.length === 1) add(matches[0], reason);
    else if (
      !unresolved.some(
        (c) =>
          normalizeSupporterClubName(c.name) === normalized &&
          c.reason === reason,
      )
    )
      unresolved.push({ name: name.trim(), reason });
  };
  findName(profile.favorite_pro_club, "heart");
  findName(profile.favorite_amateur_club, "heart");
  if (profile.linked_club_id) {
    const current = candidates.find((c) => c.id === profile.linked_club_id);
    if (current) add(current, "current");
  } else findName(profile.club, "current");
  followed.forEach((club) => add(club, "followed"));
  return { clubs: [...related.values()], unresolved };
}
