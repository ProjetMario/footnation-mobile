// One display policy for native, web and generated public pages. Names, country,
// league labels and badge URLs never establish a club's professional identity.
export function isProfessionalClub(club) {
  if (!club || typeof club !== "object") return false;
  if (club.is_pro === true || club.clubProfessional === true || club.professional_status === "verified") return true;
  if (club.metadata && typeof club.metadata === "object" && !Array.isArray(club.metadata) && club.metadata.professional_status === "verified") return true;
  if (club.clubKind === "national" || club.providerContext === "national") return false;
  if (club.clubKind === "professional" || club.providerContext === "professional") return true;
  const canonical = club.canonicalClub;
  return !!canonical && typeof canonical.id === "string" &&
    canonical.id === (club.club_id || club.id) &&
    (canonical.is_pro === true || canonical.professional_status === "verified");
}

export function effectiveClubLogo(club, candidate) {
  if (isProfessionalClub(club)) return null;
  const value = candidate === undefined ? club?.logo_url ?? club?.logo ?? club?.metadata?.logo : candidate;
  return typeof value === "string" && value.trim() ? value : null;
}

// A copy: suppress the public projection, never delete or rewrite stored media.
export function projectClubLogos(club) {
  if (!club || !isProfessionalClub(club)) return club;
  const result = { ...club, logo_url: null };
  if ("logo" in club) result.logo = null;
  if (club.metadata && typeof club.metadata === "object" && !Array.isArray(club.metadata)) {
    result.metadata = { ...club.metadata };
    for (const key of ["logo", "logo_url"]) if (key in result.metadata) result.metadata[key] = null;
  }
  return result;
}

// Exact identity only. A fuzzy badge lookup can assign a professional club's
// badge to an amateur namesake even after its own logo has been suppressed.
export function normalizedClubIdentity(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function exactAmateurClubLogo(name, clubs) {
  const identity = normalizedClubIdentity(name);
  if (!identity) return null;
  const matches = clubs.filter(club => normalizedClubIdentity(club.name) === identity);
  // Unknown and ambiguous identities cannot authorize a fallback image.
  if (matches.length !== 1 || matches[0].is_pro !== false || isProfessionalClub(matches[0])) return null;
  return effectiveClubLogo(matches[0]);
}

// Match feeds have their own display scope. Club profiles still use
// effectiveClubLogo; only match feeds may show provider-supplied club badges.
export function matchTeamLogo(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

export function projectProviderMatchLogos(match, national = false) {
  const side = team => team && ({
    ...team,
    logo: matchTeamLogo(team.logo),
  });
  return { ...match, home: side(match.home), away: side(match.away) };
}

export function projectProviderScoreboardLogos(data, isNational) {
  const matches = (data.matches || []).map(match => projectProviderMatchLogos(match, isNational(match)));
  const known = new Map(matches.flatMap(match => [match.home, match.away]).filter(Boolean).filter(team => team.id).map(team => [team.id, team]));
  return { ...data, matches, teams: (data.teams || []).map(team => ({
    ...team,
    logo: known.has(team.id) ? known.get(team.id).logo : matchTeamLogo(team.logo),
  })) };
}
