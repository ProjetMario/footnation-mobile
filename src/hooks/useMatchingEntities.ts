import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { supportsClubMatching } from "../lib/matchingSchema";
import { useAuth } from "../lib/auth";
import {
  MatchableItem,
  MatchingProfile,
  MatchFilters,
} from "../types/matching";
import { calculateCompatibilityScore } from "../lib/matchingAlgorithm";
import {
  filterMatchingCandidates,
  matchingDepartment,
  matchingRecruitingPositions,
} from "../lib/matchingFilters";
function matchingProfile(profile: any): MatchingProfile {
  return {
    ...profile,
    entity_type: "profile",
    name: profile.full_name || "Anonyme",
    location: {
      city: profile.city,
      department: profile.department,
      latitude: profile.latitude ?? null,
      longitude: profile.longitude ?? null,
    },
    compatibility_score: 0,
  };
}
export function useMatchingEntities(filters: MatchFilters = {}) {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useInfiniteQuery({
    queryKey: ["matching-entities", uid, filters],
    enabled: !!uid,
    initialPageParam: 0,
    staleTime: 60_000,
    queryFn: async ({ pageParam }) => {
      const typed = await supportsClubMatching();
      const own = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid!)
        .maybeSingle();
      if (own.error) throw new Error(`Profil : ${own.error.message}`);
      const currentUser = own.data ? matchingProfile(own.data) : null;
      const entities: MatchableItem[] = [];
      const department = matchingDepartment(filters.department);
      let hasMore = false;
      if (filters.entityType !== "club") {
        let query = supabase
          .from("profiles")
          .select(
            "id,full_name,avatar_url,primary_role,department,city,highest_level,bio,position,created_at,is_premium,birthdate,is_suspended,suspended_until",
          )
          .neq("id", uid!)
          .order("id");
        if (filters.profileGroup === "players")
          query = query.ilike("primary_role", "joueur%");
        if (filters.profileGroup === "agents")
          query = query.ilike("primary_role", "agent%");
        if (filters.role) query = query.eq("primary_role", filters.role);
        if (filters.level) query = query.eq("highest_level", filters.level);
        if (department)
          query = query.in("department", department.profileValues);
        if (filters.position) query = query.eq("position", filters.position);
        const { data, error } = await query.range(pageParam, pageParam + 29);
        if (error) throw new Error(`Suggestions : ${error.message}`);
        hasMore ||= data.length === 30;
        for (const profile of data) {
          if (
            profile.is_suspended &&
            (!profile.suspended_until ||
              Date.parse(profile.suspended_until) > Date.now())
          )
            continue;
          entities.push(matchingProfile(profile));
        }
      }
      if (filters.entityType !== "profile") {
        let query = supabase
          .from("fff_clubs")
          .select(
            "id,name,logo_url,city,department_name,latitude,longitude,metadata,followers_count,social_media_followers,is_verified",
          )
          .order("id");
        if (department) query = query.eq("department_code", department.code);
        const { data, error } = await query.range(pageParam, pageParam + 29);
        if (error) throw new Error(`Suggestions : ${error.message}`);
        hasMore ||= data.length === 30;
        for (const club of data) {
          const metadata = club.metadata || {};
          entities.push({
            ...metadata,
            id: club.id,
            entity_type: "club",
            name: club.name,
            avatar_url: club.logo_url,
            logo_url: club.logo_url,
            location: {
              city: club.city,
              department: club.department_name,
              latitude: club.latitude,
              longitude: club.longitude,
            },
            division: metadata.division || null,
            competition_level: metadata.competition_level || null,
            recruiting_status: !!metadata.recruiting_status,
            recruiting_positions: matchingRecruitingPositions(
              metadata.recruiting_positions,
            ),
            age_category: metadata.age_category || null,
            stadium_name: metadata.stadium_name || null,
            youth_academy: !!metadata.youth_academy,
            women_team: !!metadata.women_team,
            followers_count: club.followers_count,
            is_verified: club.is_verified,
            compatibility_score: 0,
          });
        }
      }
      if (!entities.length)
        return {
          entities,
          hasMore,
          supportsClubs: typed,
          hasProfile: !!currentUser,
        };
      const ids = entities.map((item) => item.id);
      const swipes = await supabase
        .from("swipes")
        .select(typed ? "target_id,target_type" : "target_id")
        .eq("swiper_id", uid!)
        .in("target_id", ids);
      if (swipes.error) throw new Error(`Choix : ${swipes.error.message}`);
      const blocks = await supabase
        .from("user_blocks")
        .select("blocker_id,blocked_id")
        .or(
          `and(blocker_id.eq.${uid},blocked_id.in.(${ids.join(",")})),and(blocked_id.eq.${uid},blocker_id.in.(${ids.join(",")}))`,
        );
      if (blocks.error) throw new Error(`Blocages : ${blocks.error.message}`);
      const blocked = new Set(
        blocks.data.map((b) =>
          b.blocker_id === uid ? b.blocked_id : b.blocker_id,
        ),
      );
      const handled = new Set(
        (swipes.data as any[]).map(
          (s) => `${s.target_type || "profile"}:${s.target_id}`,
        ),
      );
      const available = filterMatchingCandidates(entities, filters)
        .filter(
          (item) =>
            !handled.has(`${item.entity_type}:${item.id}`) &&
            (item.entity_type !== "profile" || !blocked.has(item.id)),
        )
        .map((item) => ({
          ...item,
          compatibility_score: currentUser
            ? Math.min(
                100,
                calculateCompatibilityScore(currentUser, item).score +
                  (item.entity_type === "profile" && item.is_premium ? 5 : 0),
              )
            : 0,
        }))
        .sort((a, b) => b.compatibility_score - a.compatibility_score);
      return {
        entities: available,
        hasMore,
        supportsClubs: typed,
        hasProfile: !!currentUser,
      };
    },
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length * 30 : undefined,
  });
}
