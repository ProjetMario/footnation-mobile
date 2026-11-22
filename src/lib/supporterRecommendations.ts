import { proClubGroups } from "../data/proClubGroups";
import { requireBackend, supabase } from "./supabase";
import { SUPPORTERS_ENABLED } from "./supportersConfig";
import type { SupporterClub } from "./supporterClubLinks";

const countryPriority: Record<string, string[]> = {
  FR: ["ligue1", "ligue2", "national", "world"],
  GB: ["premier-league", "world", "ligue1"],
  ES: ["liga", "world", "ligue1"],
  IT: ["serie-a", "world", "ligue1"],
  DE: ["bundesliga", "world", "ligue1"],
  PT: ["europe-other", "world", "ligue1"],
  BR: ["world", "ligue1", "premier-league"],
  AR: ["world", "ligue1", "liga"],
  US: ["world", "premier-league", "ligue1"],
};

export type SupporterRecommendation = SupporterClub & {
  competition: string;
  source: "priority" | "catalogue";
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

async function visitorCountry(): Promise<string> {
  if (typeof window === "undefined") return "FR";
  try {
    const endpoint = typeof location !== "undefined" && location.origin !== "null"
      ? `${location.origin}/api/visitor-region`
      : "https://www.foot-nation.com/api/visitor-region";
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) return "FR";
    const data = (await response.json()) as { country?: unknown };
    return typeof data.country === "string" ? data.country.toUpperCase() : "FR";
  } catch {
    return "FR";
  }
}

export async function loadSupporterRecommendations(): Promise<{
  country: string;
  clubs: SupporterRecommendation[];
}> {
  if (!SUPPORTERS_ENABLED) return { country: "FR", clubs: [] };
  requireBackend();
  const country = await visitorCountry();
  const order = countryPriority[country] ?? ["world", "europe-other", "ligue1"];
  const staticClubs = order.flatMap((groupId) => {
    const group = proClubGroups.find((item) => item.id === groupId);
    return group
      ? group.clubs.map((name) => ({
          id: `catalogue:${normalize(name)}`,
          name,
          short_name: null,
          city: null,
          logo_url: null,
          competition: group.label,
          source: "priority" as const,
        }))
      : [];
  });
  const known = new Set(staticClubs.map((club) => normalize(club.name)));
  const { data } = await supabase
    .from("fff_clubs")
    .select("id,name,short_name,city,logo_url")
    .order("followers_count", { ascending: false, nullsFirst: false })
    .limit(300);
  const local = ((data ?? []) as SupporterClub[])
    .filter((club) => club.name && !known.has(normalize(club.name)))
    .map((club) => ({ ...club, competition: "Clubs à découvrir", source: "catalogue" as const }));
  return { country, clubs: [...staticClubs, ...local].slice(0, 300) };
}
