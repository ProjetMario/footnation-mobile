import { hasUnresolvedClubIdentity } from "./clubIdentitySafety";
import { projectFffClub, SPORT_SEASON, isFffTeamId } from "./fffSportProjection";
import { requireBackend } from "./supabase";
import { projectClubSports, isPublicSportsTeamId } from './sportProjection';

async function readProjection(key: "clubId" | "teamId", id: string) {
  if (key === "clubId" && hasUnresolvedClubIdentity(id)) throw new Error("Données sportives en cours de vérification.");
  requireBackend();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/club-sport-data?${key}=${encodeURIComponent(id)}&season=${SPORT_SEASON}`, {
      method: "GET", headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "", Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ""}` }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(response.status === 404 ? "Données 2026–2027 introuvables." : "Les données sportives sont momentanément indisponibles.");
    return projectFffClub(await response.json(), key === "clubId" ? id : undefined);
  } finally { clearTimeout(timer); }
}
export const fetchFffClub = (clubId: string) => readProjection("clubId", clubId);
export async function fetchFffTeam(teamId: string) {
  if (!isFffTeamId(teamId)) throw new Error("Cette équipe ne dispose pas d’un identifiant FFF 2026–2027 vérifié.");
  const data = await readProjection("teamId", teamId);
  const team = data.teams.find(value => value.id === teamId);
  if (!team) throw new Error("Équipe 2026–2027 introuvable.");
  return { ...data, team, rankings: team.rankings, upcomingMatches: team.upcomingMatches, pastMatches: team.pastMatches };
}

async function readSports(key: 'clubId' | 'teamId', id: string) {
  if (key === 'clubId' && hasUnresolvedClubIdentity(id)) throw new Error('Données sportives en cours de vérification.');
  requireBackend();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/club-sport-data?${key}=${encodeURIComponent(id)}&version=2`, {
      method: 'GET', headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '', Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''}` }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(response.status === 404 ? 'Données sportives vérifiées introuvables.' : 'Les données sportives sont momentanément indisponibles.');
    return projectClubSports(await response.json(), key === 'clubId' && !id.startsWith('intl-') ? id : undefined);
  } finally { clearTimeout(timer); }
}
export const fetchClubSports = (clubId: string) => readSports('clubId', clubId);
export async function fetchSportsTeam(teamId: string) {
  if (!isFffTeamId(teamId) && !isPublicSportsTeamId(teamId)) throw new Error('Identifiant d’équipe vérifié requis.');
  const data = await readSports('teamId', teamId);
  const team = data.teams.find(team => team.id === teamId);
  if (!team) throw new Error('Équipe introuvable dans les données vérifiées.');
  return {...data,team,rankings:team.rankings,upcomingMatches:team.upcomingMatches,pastMatches:team.pastMatches};
}
