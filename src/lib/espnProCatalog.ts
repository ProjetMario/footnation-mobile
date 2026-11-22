import { calendarDate, validCalendarDate } from "./calendarDate";

/**
 * ESPN coverage is competition based.  Keep this registry explicit so that
 * adding a league never silently makes a fuzzy or incomplete world catalogue.
 */
export type EspnProfessionalCompetition = {
  slug: string;
  name: string;
  country: string;
  tier: 1 | 2;
  gender: "men" | "women";
};

export const ESPN_PROFESSIONAL_COMPETITIONS = [
  { slug: "fra.1", name: "Ligue 1", country: "FR", tier: 1, gender: "men" },
  { slug: "eng.1", name: "Premier League", country: "GB", tier: 1, gender: "men" },
  { slug: "esp.1", name: "La Liga", country: "ES", tier: 1, gender: "men" },
  { slug: "ita.1", name: "Serie A", country: "IT", tier: 1, gender: "men" },
  { slug: "ger.1", name: "Bundesliga", country: "DE", tier: 1, gender: "men" },
  { slug: "uefa.champions", name: "UEFA Champions League", country: "UE", tier: 1, gender: "men" },
] as const satisfies readonly EspnProfessionalCompetition[];

export function espnProfessionalCompetition(slug: string) {
  return ESPN_PROFESSIONAL_COMPETITIONS.find((item) => item.slug === slug);
}

function offsetDate(date: string, offset: number) {
  if (!validCalendarDate(date)) throw new Error("Date ESPN invalide.");
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return calendarDate(value);
}

/** Create bounded, deterministic scoreboard requests for a catalog sync. */
export function createEspnProfessionalScoreboardRequests({
  from,
  to,
  competitions = ESPN_PROFESSIONAL_COMPETITIONS,
}: {
  from: string;
  to: string;
  competitions?: readonly Pick<EspnProfessionalCompetition, "slug">[];
}) {
  if (!validCalendarDate(from) || !validCalendarDate(to) || from > to)
    throw new Error("Période ESPN invalide.");
  const requests: { slug: string; date: string; url: string }[] = [];
  for (const competition of competitions) {
    if (!espnProfessionalCompetition(competition.slug))
      throw new Error("Compétition ESPN non référencée.");
    for (let date = from; date <= to; date = offsetDate(date, 1)) {
      requests.push({
        slug: competition.slug,
        date,
        url: `https://site.api.espn.com/apis/site/v2/sports/soccer/${competition.slug}/scoreboard?dates=${date.replace(/-/g, "")}&limit=100`,
      });
    }
  }
  return requests;
}
