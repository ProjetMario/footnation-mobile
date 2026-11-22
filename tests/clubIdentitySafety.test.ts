import {describe,it,expect} from 'vitest';
import {hasUnresolvedClubIdentity,safeClubPublicInformation} from '../src/lib/clubIdentitySafety';
import {findClubEnrichment,buildAddress} from '../src/lib/clubPublicInformation';
describe('misassigned FFF identities',()=>{
 for(const id of ['a974ed68-80fc-4b1d-8960-a889df7b8247','84c668f3-ac26-4caf-91d7-eb1e30736278']) it(`does not expose another club’s facts for ${id}`,()=>{
  const source={id,name:'Club',city:'Nay',postal_code:'64800',external_id:'549954',address:'Wrong street',infrastructure:['Wrong stadium'],colors:['Wrong colors'],metadata:{league:'Wrong league'},league:'Wrong league'};
  expect(hasUnresolvedClubIdentity(id)).toBe(true);expect(findClubEnrichment(source)).toBeNull();const safe=safeClubPublicInformation(source);expect(safe.external_id).toBeNull();expect(safe.infrastructure).toBeNull();expect(safe.colors).toBeNull();expect(safe.metadata).toEqual({});expect(buildAddress(safe)).not.toContain('Wrong street');expect(safe.id).toBe(id);expect(source.external_id).toBe('549954');
 });
 it('does not change ordinary club records',()=>{const club={id:'another',external_id:'123456'};expect(safeClubPublicInformation(club)).toBe(club)});
});
