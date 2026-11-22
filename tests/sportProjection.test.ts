import { describe, it, expect } from 'vitest';
import { projectClubSports, sportsTeamPath } from '../src/lib/sportProjection';
const club = '11111111-1111-4111-8111-111111111111';
const a = 'official:2026:1', b = 'official:2026:2';
const match = {id:'official:2026:10',source:'official',providerSeasonId:'2026',date:'2026-10-27',datePrecision:'day',status:'finished',played:true,home:{teamId:a,name:'A',score:0},away:{teamId:b,name:'B',score:null}};
const team = {id:a,source:'official',providerSeasonId:'2026',season:'2026',seasonLabel:'2026',name:'A',gender:'women',section:'seniors',matches:[match],matchesFetchedAt:'2026-10-27T00:00:00Z',matchesCoverage:{completeSeason:false}};
const payload = {version:2,source:'world',siteClubId:club,siteName:'Club A',seasonLabel:'2026',sourceLabel:'Ligue officielle',clubProfessional:true,status:'partial',teams:[team]};
describe('international sports projections',()=>{
 it('keeps calendar-year season, women identity, null scores and no logo',()=>{
  const result=projectClubSports(payload,club);
  expect(result.season).toBe('2026');expect(result.teams[0].genderCode).toBe('F');expect(result.teams[0].calendarComplete).toBe(false);
  expect(result.pastMatches[0]).toMatchObject({id:match.id,homeScore:0,awayScore:null,datePrecision:'day'});
  expect(result.pastMatches[0].homeTeam.logo).toBeUndefined();
 });
 it('rejects another club and filters provider/season mismatches without fuzzy names',()=>{
  expect(()=>projectClubSports(payload,'other')).toThrow();
  const invalid=[{...match,source:'other'},{...match,providerSeasonId:'2025'},{...match,home:{...match.home,teamId:'official:2026:3'}}];
  expect(projectClubSports({...payload,teams:[{...team,matches:invalid}]}).pastMatches).toEqual([]);
 });
 it('does not conflate providers with the same numeric IDs or duplicate shared fixtures',()=>{
  const other={...team,id:'second:2026:1',source:'second',matches:[]};
  const duplicate={...team,id:b};
  const result=projectClubSports({...payload,teams:[team,other,duplicate]});
  expect(result.teams).toHaveLength(3);expect(result.pastMatches).toHaveLength(1);
 });
 it('keeps external players separate from community profiles and requires source provenance',()=>{
  const roster={sourceUrl:'https://official.example/team',checkedAt:'2026-10-27',complete:false,players:[{id:'official:10',name:'Joueuse',position:'Gardienne',profile_id:club}]};
  const result=projectClubSports({...payload,teams:[{...team,roster}]}).teams[0];
  expect(result.roster?.complete).toBe(false);expect(result.roster?.players[0]).not.toHaveProperty('profile_id');
  expect(projectClubSports({...payload,teams:[{...team,roster:{...roster,sourceUrl:'javascript:alert(1)'}}]}).teams[0].roster).toBeNull();
 });
 it('preserves FFF team routes and creates a provider-neutral external route',()=>{
  expect(sportsTeamPath('2026_1_SEM_1')).toBe('/fff-team/2026_1_SEM_1');expect(sportsTeamPath(a)).toBe('/sports-team/official%3A2026%3A1');
 });
 it('retains FFF academy alongside separately verified professional squads and roster',()=>{
  const academy={id:'2026_9_U17_1',name:'U17',source:'fff',season:'2026',matches:[]};
  const result=projectClubSports({...payload,source:'mixed',teams:[academy,team]});
  expect(result.teams.map(t=>t.id)).toEqual([academy.id,team.id]);
  expect(result.teams[0].seasonLabel).toBe('2026–2027');expect(result.teams[1].genderCode).toBe('F');
  expect(result.pastMatches).toHaveLength(1);
 });
});
