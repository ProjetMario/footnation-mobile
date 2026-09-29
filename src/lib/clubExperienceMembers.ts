import type { Profile } from "./models";
import { isSuspended } from "./validation";
import { supabase } from "./supabase";
export type ClubMemberExperience = {
  start: string;
  end: string;
  category: string;
  position: string;
  current: boolean;
};
export type ClubExperienceMember = {
  profile: Profile;
  current: boolean;
  experiences: ClubMemberExperience[];
};
export type ClubProjection = {
  profile: Profile | null;
  start_year: number;
  end_year: number | null;
  age_category: string | null;
  position: string | null;
  is_current: boolean | null;
};
const record = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const normalize = (v: unknown) =>
  String(v || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function clubMemberFilter(id: string, name: string) {
  return [
    `linked_club_id.eq.${id}`,
    `club.eq.${JSON.stringify(name)}`,
    `experience_history.cs.${JSON.stringify(JSON.stringify([{ club_id: id }]))}`,
    `experience_history.cs.${JSON.stringify(JSON.stringify([{ club: name }]))}`,
  ].join(",");
}
export function mergeClubMembers(
  id: string,
  name: string,
  profiles: Profile[],
  projected: ClubProjection[],
): ClubExperienceMember[] {
  const members = new Map<string, ClubExperienceMember>();
  const knownProfiles = [
    ...new Map(
      [
        ...projected.flatMap((row) =>
          row.profile &&
          Array.isArray(row.profile.experience_history) &&
          row.profile.experience_history.length
            ? [row.profile]
            : [],
        ),
        ...profiles,
      ].map((profile) => [profile.id, profile]),
    ).values(),
  ];
  for (const profile of knownProfiles) {
    if (isSuspended(profile)) continue;
    const experiences = (
      Array.isArray(profile.experience_history)
        ? profile.experience_history
        : []
    ).flatMap((value) => {
      const row = record(value);
      if (
        !row ||
        (row.club_id
          ? row.club_id !== id
          : normalize(row.club) !== normalize(name))
      )
        return [];
      const end = String(row.endYear || "");
      return [
        {
          start: String(row.startYear || ""),
          end,
          category: String(row.ageCategory || ""),
          position: String(row.position || ""),
          current:
            !end ||
            normalize(end) === "present" ||
            (/^\d{4}$/.test(end) && Number(end) >= new Date().getFullYear()),
        },
      ];
    });
    if (
      experiences.length ||
      profile.linked_club_id === id ||
      normalize(profile.club) === normalize(name)
    )
      members.set(profile.id, {
        profile,
        current: experiences.length
          ? experiences.some((row) => row.current)
          : true,
        experiences,
      });
  }
  for (const row of projected) {
    if (!row.profile || isSuspended(row.profile)) continue;
    // Profile history is authoritative when present; old projections must not resurrect a removed experience.
    if (
      knownProfiles.some(
        (p) =>
          p.id === row.profile!.id &&
          Array.isArray(p.experience_history) &&
          p.experience_history.length,
      )
    )
      continue;
    const experience = {
      start: String(row.start_year || ""),
      end: String(row.end_year || ""),
      category: row.age_category || "",
      position: row.position || "",
      current: row.is_current ?? row.end_year == null,
    };
    const prior = members.get(row.profile.id);
    members.set(row.profile.id, {
      profile: row.profile,
      current: prior?.current || experience.current,
      experiences: [...(prior?.experiences || []), experience],
    });
  }
  return [...members.values()]
    .map((member) => ({
      ...member,
      experiences: member.experiences.sort(
        (a, b) =>
          Number(b.current) - Number(a.current) ||
          Number(b.start) - Number(a.start),
      ),
    }))
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        (a.profile.full_name || "").localeCompare(
          b.profile.full_name || "",
          "fr",
        ) ||
        a.profile.id.localeCompare(b.profile.id),
    );
}
const memberColumns =
  "id,full_name,first_name,last_name,username,avatar_url,club,linked_club_id,experience_history,is_suspended,suspended_until";
export async function loadClubExperienceMembers(
  id: string,
  name: string,
  uid: string,
  offset: number,
) {
  const blocks = uid
    ? await supabase
        .from("user_blocks")
        .select("blocker_id,blocked_id")
        .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`)
    : { data: [], error: null };
  if (blocks.error) throw blocks.error;
  const blocked = new Set(
    (blocks.data || []).map((row) =>
      row.blocker_id === uid ? row.blocked_id : row.blocker_id,
    ),
  );
  let q = supabase
    .from("profiles")
    .select(memberColumns)
    .or(clubMemberFilter(id, name));
  if (blocked.size) q = q.not("id", "in", `(${[...blocked].join(",")})`);
  const [people, history] = await Promise.all([
    q.order("id").range(offset, offset + 29),
    supabase
      .from("club_experience_members")
      .select(
        `start_year,end_year,age_category,position,is_current,profile:profiles!club_experience_members_profile_id_fkey(${memberColumns})`,
      )
      .eq("club_id", id)
      .order("id")
      .range(offset, offset + 29),
  ]);
  if (people.error) throw people.error;
  if (history.error) throw history.error;
  const projected = (history.data || []) as unknown as ClubProjection[];
  return {
    profiles: (people.data || []) as Profile[],
    projected: projected.filter(
      (row) => row.profile && !blocked.has(row.profile.id),
    ),
    more: people.data?.length === 30 || history.data?.length === 30,
  };
}
