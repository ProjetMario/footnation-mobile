/** Known source joins that attached another club's FFF records to this UUID. */
const contaminated = new Set(['a974ed68-80fc-4b1d-8960-a889df7b8247','84c668f3-ac26-4caf-91d7-eb1e30736278']);
export function hasUnresolvedClubIdentity(id: unknown): boolean { return typeof id === 'string' && contaminated.has(id); }
/** Keep the user's community and verified city, but do not expose cross-club facts. */
export function safeClubPublicInformation(club: Record<string, any>): Record<string, any> {
 if (!hasUnresolvedClubIdentity(club.id)) return club;
 return {...club, external_id:null, fff_affiliation_number:null, address:null, infrastructure:null, league:null, district:null, shirt_colors:null, colors:null, metadata:{}};
}
