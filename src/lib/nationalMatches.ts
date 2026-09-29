import type { MatchDTO } from "../types/matches";

// Explicit provider IDs avoid confusing the AFC club cups, club friendlies or
// national domestic leagues with national teams.
export const NATIONAL_LEAGUES = [
  "uefa.nations",
  "fifa.friendly",
  "concacaf.nations.league",
  "fifa.world",
  "fifa.worldq.uefa",
  "fifa.worldq.conmebol",
  "fifa.worldq.concacaf",
  "fifa.worldq.afc",
  "fifa.worldq.caf",
  "fifa.worldq.ofc",
  "uefa.euro",
  "uefa.euroq",
  "conmebol.america",
  "concacaf.gold",
  "caf.nations",
  "afc.asian.cup",
  "fifa.wwc",
  "fifa.friendly.w",
  "uefa.weuro",
] as const;

export function isNationalMatch(match: MatchDTO) {
  const league = match.external_match_id.startsWith("espn:")
    ? match.external_match_id.split(":")[1]
    : match.tournament.code || match.tournament.slug || "";
  if ((NATIONAL_LEAGUES as readonly string[]).includes(league)) return true;
  const name = match.tournament.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/\bclub\b|clubs|champions/.test(name)) return false;
  return /nations league|ligue des nations|world cup|coupe du monde|international friendly|international friendlies|amistos internacionales|european (?:under[ -]?\d+ )?championship|championnat d.europe|copa america|gold cup|africa cup of nations|coupe d.afrique des nations|afc asian cup|african nations championship/.test(
    name,
  );
}
