import { supabase } from "./supabase";
import { clubTeamBaseName, matchingClubLogo } from "./clubLogoIdentity";

export function clubLogoName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/football\s+club/g, "fc")
    .replace(/[^a-z0-9]/g, "");
}

export async function findClubLogo(name: string): Promise<string | null> {
  // Search a distinctive token, then require an exact normalized identity.
  const baseName = clubTeamBaseName(name);
  const token = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-zA-Z]{3,}/g)
    ?.sort((a, b) => b.length - a.length)
    .find((word) => !["football", "club"].includes(word.toLowerCase()));
  if (!token) return null;
  const result = await supabase
    .from("club_logos")
    .select("club_name,logo_url")
    .ilike("club_name", `%${token}%`)
    .limit(100);
  const exact = result.data?.find(
    (row) => clubLogoName(row.club_name) === clubLogoName(baseName),
  )?.logo_url;
  const logo =
    exact ||
    matchingClubLogo(
      baseName,
      (result.data || []).map((row) => ({
        name: row.club_name,
        logo: row.logo_url,
      })),
    );
  if (logo) return logo;
  const clubs = await supabase
    .from("fff_clubs")
    .select("name,logo_url")
    .ilike("name", `%${token}%`)
    .not("logo_url", "is", null)
    .limit(100);
  return matchingClubLogo(
    baseName,
    (clubs.data || []).map((row) => ({ name: row.name, logo: row.logo_url })),
  );
}
