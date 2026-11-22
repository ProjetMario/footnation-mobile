export interface ClubLogoIdentity {
  id?: string | null;
  club_id?: string | null;
  name?: string | null;
  is_pro?: boolean | null;
  clubProfessional?: boolean;
  professional_status?: string | null;
  clubKind?: "professional" | "national" | "amateur";
  providerContext?: "professional" | "national";
  canonicalClub?: { id: string; is_pro?: boolean | null; professional_status?: string | null };
  logo_url?: string | null;
  logo?: string | null;
  metadata?: unknown;
}
export function isProfessionalClub(club: ClubLogoIdentity | null | undefined): boolean;
export function effectiveClubLogo(club: ClubLogoIdentity | null | undefined, candidate?: string | null): string | null;
export function matchTeamLogo(value: unknown): string | null;
export function projectClubLogos<T extends ClubLogoIdentity>(club: T): T;
export function normalizedClubIdentity(value: unknown): string;
export function exactAmateurClubLogo(name: string, clubs: ClubLogoIdentity[]): string | null;
export function projectProviderMatchLogos<T>(match: T, national?: boolean): T;
export function projectProviderScoreboardLogos<T extends { matches?: any[]; teams?: any[] }>(data: T, isNational: (match: any) => boolean): T;
