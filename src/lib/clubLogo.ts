import { supabase } from "./supabase";
import { clubTeamBaseName } from "./clubLogoIdentity";
import { exactAmateurClubLogo } from "./clubLogoPolicy.mjs";

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
  const clubs = await supabase
    .from("fff_clubs")
    .select("id,name,is_pro,logo_url")
    .ilike("name", `%${token}%`)
    .limit(101);
  // A truncated lookup cannot prove that an identity is unique.
  if (clubs.error || !clubs.data || clubs.data.length > 100) return null;
  return exactAmateurClubLogo(baseName, clubs.data);
}
