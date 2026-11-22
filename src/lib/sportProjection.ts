import { projectFffClub, isFffTeamId, type FffTeam, type FffMatch, type FffRanking } from './fffSportProjection';

type Row = Record<string, unknown>;
const object = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {};
const rows = (v: unknown): Row[] => Array.isArray(v) ? v.map(object) : [];
const text = (v: unknown) => typeof v === 'string' ? v : '';
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null;
export const isPublicSportsTeamId = (id: string) => /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}:[A-Za-z0-9][A-Za-z0-9_.-]{0,79}:[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(id);
export const sportsTeamPath = (id: string) => `${isFffTeamId(id) ? '/fff-team/' : '/sports-team/'}${encodeURIComponent(id)}`;
export type ProfessionalRoster = { sourceUrl: string; checkedAt: string; complete: boolean; players: { id: string; name: string; position: string; shirtNumber: number | null }[] };
export type SportsTeam = FffTeam & { source?: string; seasonLabel?: string; sourceUrl?: string; roster?: ProfessionalRoster | null };
export type SportsProjection = {club:{id:string;name:string};season:string;sourceLabel:string;status:string;stale:boolean;checkedAt:string;clubProfessional:boolean;coverageIssues:string[];teams:SportsTeam[];upcomingMatches:FffMatch[];pastMatches:FffMatch[]};

export function sportsCoverageMessage(status: string, stale: boolean) {
  if (['no_teams','no_teams_published'].includes(status)) return 'Aucune équipe publiée pour cette saison dans les sources vérifiées.';
  if (['identity_unverified','unverified'].includes(status)) return 'Le rattachement de ce club à sa source sportive reste à vérifier.';
  if (status === 'pending') return 'Les équipes et rencontres seront affichées après vérification des sources officielles.';
  if (['unavailable','source_unavailable'].includes(status)) return 'Source indisponible. Les dernières données vérifiées sont conservées.';
  if (status === 'partial') return 'Couverture partielle : certaines équipes ou compétitions restent à vérifier.';
  return stale ? 'Actualisation en attente : les dernières données vérifiées sont affichées.' : null;
}

function publicSource(value: unknown): string {
  try { const url = new URL(text(value)); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}

export function projectClubSports(value: unknown, expectedClubId?: string): SportsProjection {
  const data = object(value);
  if (data.source === 'mixed') {
    const world = projectClubSports({...data,source:'world',teams:rows(data.teams).filter(team=>!isFffTeamId(text(team.id)))},expectedClubId);
    const fff = projectFffClub({...data,source:'fff',seasonStart:2026,teams:rows(data.teams).filter(team=>isFffTeamId(text(team.id)))},expectedClubId);
    return {...world,teams:[...fff.teams.map(team=>({...team,source:'fff',seasonLabel:'2026–2027'})),...world.teams],upcomingMatches:sort([...fff.upcomingMatches,...world.upcomingMatches]),pastMatches:sort([...fff.pastMatches,...world.pastMatches]).reverse()};
  }
  if (data.source !== 'world') {
    const fff = projectFffClub(value, expectedClubId);
    return { ...fff, teams: fff.teams.map(team=>({...team,source:'fff',seasonLabel:'2026–2027'})) as SportsTeam[], sourceLabel: 'FFF', clubProfessional: data.clubProfessional === true, coverageIssues: [] as string[] };
  }
  const clubId = text(data.siteClubId);
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(clubId) || expectedClubId && clubId !== expectedClubId) throw new Error('Données sportives du club indisponibles.');
  const teams: SportsTeam[] = [], seen = new Set<string>(), allMatches = new Map<string, FffMatch>();
  for (const raw of rows(data.teams)) {
    const id = text(raw.id), source = text(raw.source), providerSeason = text(raw.providerSeasonId), prefix = `${source}:${providerSeason}:`;
    if (!isPublicSportsTeamId(id) || !source || !providerSeason || !id.startsWith(prefix) || seen.has(id)) continue;
    seen.add(id);
    const matches = new Map<string, FffMatch>();
    for (const item of rows(raw.matches)) {
      const matchId = text(item.id), home = object(item.home), away = object(item.away);
      if (!isPublicSportsTeamId(matchId) || !matchId.startsWith(prefix) || item.source !== source || item.providerSeasonId !== providerSeason || ![home.teamId, away.teamId].includes(id)) continue;
      const played = item.played === true;
      const status = text(item.status);
      if (!['scheduled','live','finished','postponed','cancelled','abandoned'].includes(status) || (status === 'finished') !== played) continue;
      const side = (item: Row) => ({ id: text(item.teamId).startsWith(prefix) && isPublicSportsTeamId(text(item.teamId)) ? text(item.teamId) : '', name: text(item.name) || 'Adversaire à confirmer', shortName: '' });
      const converted: FffMatch = {
        id: matchId, date: text(item.date), time: text(item.kickoffLocalTime), datePrecision: item.datePrecision === 'instant' ? 'instant' : 'day', sourceStatus: status, status, competition: text(item.competition),
        homeTeam: side(home), awayTeam: side(away), homeScore: played ? number(home.score) : null, awayScore: played ? number(away.score) : null,
        homePenalties: played ? number(home.penalties) : null, awayPenalties: played ? number(away.penalties) : null,
      };
      matches.set(matchId, converted); allMatches.set(matchId, converted);
    }
    const rankings: FffRanking[] = rows(raw.standingsByCompetition).filter(item => item.source === source && item.providerSeasonId === providerSeason).map(item => ({
      key: [item.id,item.phase,item.pool].map(text).join(':'), name: text(item.name), phase: text(item.phase), pool: text(item.pool), status: text(item.status), fetchedAt: text(item.fetchedAt),
      rows: rows(item.rows).map(row => ({teamId: text(row.teamId),name: text(row.name),rank:number(row.rank),played:number(row.played),points:number(row.points),goalDifference:number(row.goalDifference),won:number(row.won),drawn:number(row.drawn),lost:number(row.lost),goalsFor:number(row.goalsFor),goalsAgainst:number(row.goalsAgainst)})),
    }));
    const ordered = sort([...matches.values()]), upcomingMatches = ordered.filter(match => match.status !== 'finished'), pastMatches = ordered.filter(match => match.status === 'finished').reverse();
    const rosterRaw = object(raw.roster), rosterSource = publicSource(rosterRaw.sourceUrl);
    const roster: ProfessionalRoster | null = rosterSource && text(rosterRaw.checkedAt) ? {
      sourceUrl: rosterSource, checkedAt: text(rosterRaw.checkedAt), complete: rosterRaw.complete === true,
      players: rows(rosterRaw.players).filter(player => text(player.id) && text(player.name)).map(player => ({id:text(player.id),name:text(player.name),position:text(player.position),shirtNumber:number(player.shirtNumber)})),
    } : null;
    const competitions = [...new Set(rankings.map(r => r.name).filter(Boolean))];
    const category = text(raw.categoryLabel) || (raw.section === 'seniors' ? 'Séniors' : 'Autres');
    teams.push({id,source,name:text(raw.name),category,shortName:category,displayNumber:number(raw.displayCode),genderCode:raw.gender==='women'?'F':raw.gender==='men'?'M':raw.gender==='mixed'?'X':'',discipline:'football',competitions,competition:{name:competitions.join(' · ')},sportsSummary:{results:pastMatches.length,upcoming:upcomingMatches.length,rankings:rankings.filter(r=>r.rows.length).length},calendarComplete:object(raw.matchesCoverage).completeSeason===true&&!!text(raw.matchesFetchedAt),matchesFetchedAt:text(raw.matchesFetchedAt),collectionIssues:[],clubId,clubName:text(data.siteName),rankings,upcomingMatches,pastMatches,seasonLabel:text(raw.seasonLabel),sourceUrl:publicSource(raw.sourceUrl),roster});
  }
  const all = sort([...allMatches.values()]);
  return {club:{id:clubId,name:text(data.siteName)},season:text(data.seasonLabel)||'Saison à vérifier',sourceLabel:text(data.sourceLabel)||'Sources officielles',status:text(data.status),stale:object(data.freshness).stale===true,checkedAt:text(object(data.freshness).lastSuccessAt),clubProfessional:data.clubProfessional===true,coverageIssues:Array.isArray(data.coverageIssues)?data.coverageIssues.filter((item):item is string=>typeof item==='string'):[],teams,upcomingMatches:all.filter(m=>m.status!=='finished'),pastMatches:all.filter(m=>m.status==='finished').reverse()};
}
function sort(matches: FffMatch[]) { return matches.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.time.localeCompare(b.time)||a.id.localeCompare(b.id)); }
