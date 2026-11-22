import { describe, it, expect } from "vitest";
import { projectFffClub } from "../src/lib/fffSportProjection";
const club = "11111111-1111-4111-8111-111111111111";
const a = "2026_1_SEM_1", b = "2026_1_SEM_4";
const fixture = { id: "10", date: "2026-10-25", datePrecision: "day", played: true, home: {teamId:a,name:"A",score:0}, away:{teamId:b,name:"B",score:0} };
const team = (id: string) => ({id,name:"Senior 1",season:"2026",matches:[fixture],standingsByCompetition:[{id:"20",phaseId:"1",poolId:"1",name:"D1",rows:[{teamId:id,name:"A",rank:1,points:0,played:1,goalDifference:-2}]}]});
const payload = { siteClubId:club,seasonStart:2026,source:"FFF",status:"collected",teams:[team(a),team(b)] };
describe("FFF season projection",()=>{
 it("keeps display numbers, gender and futsal distinct even on older stored payloads",()=>{
  const data=projectFffClub({...payload,teams:[{...team(a),name:"Senior 2"},{...team("2026_1_SESM_6"),name:"Senior Futsal 1"},{...team("2026_1_SEF_12"),name:"Senior F 1"}]});
  expect(data.teams[0]).toMatchObject({displayNumber:2,genderCode:"M",discipline:"football"});
  expect(data.teams[1]).toMatchObject({displayNumber:1,discipline:"futsal"});
  expect(data.teams[2]).toMatchObject({displayNumber:1,genderCode:"F"});
 });
 it("rejects another club or season and never revives old teams",()=>{
  expect(()=>projectFffClub({...payload,seasonStart:2025})).toThrow();
  expect(()=>projectFffClub(payload,"other")).toThrow();
  expect(projectFffClub({...payload,teams:[{...team(a),season:"2025"}]}).teams).toEqual([]);
 });
 it("keeps namesake team identities and deduplicates shared matches with namespaced social IDs",()=>{
  const data=projectFffClub(payload,club);expect(data.teams).toHaveLength(2);expect(data.pastMatches).toHaveLength(1);expect(data.pastMatches[0].id).toBe("fff:2026:10");expect(data.pastMatches[0].homeScore).toBe(0);expect(data.pastMatches[0].time).toBe("");
 });
 it("does not fabricate unplayed scores and preserves unknown played scores",()=>{
  const data=projectFffClub({...payload,teams:[{...team(a),matches:[{...fixture,played:false},{...fixture,id:"11",home:{teamId:a,score:null},away:{teamId:b,score:0}}]}]});
  expect(data.upcomingMatches[0].homeScore).toBeNull();expect(data.pastMatches[0].homeScore).toBeNull();expect(data.pastMatches[0].awayScore).toBe(0);
 });
 it("keeps separate phases and pools, including official negative goal difference",()=>{
  const t=team(a);t.standingsByCompetition.push({...t.standingsByCompetition[0],poolId:"2"});
  const data=projectFffClub({...payload,teams:[t]});expect(data.teams[0].rankings).toHaveLength(2);expect(data.teams[0].rankings[0].rows[0].goalDifference).toBe(-2);
 });
 it("preserves every official ranking statistic and only certifies dated calendars",()=>{
  const t=team(a);Object.assign(t.standingsByCompetition[0].rows[0],{won:1,drawn:0,lost:0,goalsFor:2,goalsAgainst:4});
  const initial=projectFffClub({...payload,teams:[t]}).teams[0];
  expect(initial.rankings[0].rows[0]).toMatchObject({won:1,drawn:0,lost:0,goalsFor:2,goalsAgainst:4,goalDifference:-2});
  expect(initial.sportsSummary).toEqual({results:1,upcoming:0,rankings:1});
  expect(initial.calendarComplete).toBe(false);
  expect(projectFffClub({...payload,teams:[{...t,matchesCoverage:{completeSeason:true},matchesFetchedAt:"2026-10-26T12:00:00Z"}]}).teams[0].calendarComplete).toBe(true);
 });
 it("ignores a fixture from another season or unrelated team instead of name matching",()=>{
  const data=projectFffClub({...payload,teams:[{...team(a),matches:[{...fixture,season:"2025"},{...fixture,home:{teamId:"2026_3_SEM_1",name:"A"},away:{teamId:b,name:"B"}}]}]});expect(data.pastMatches).toHaveLength(0);
 });
});
