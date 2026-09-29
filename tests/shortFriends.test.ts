import { expect, it, vi } from 'vitest';
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
import { shortFriendIds } from '../src/lib/shortFriends';
it('includes followed profiles and accepted connections in either direction only', () => {
 expect(shortFriendIds('me', [{followed_id:'followed'}, {followed_id:'me'}], [
  {user_id:'me',connected_user_id:'outgoing',status:'accepted'},
  {user_id:'incoming',connected_user_id:'me',status:'accepted'},
  {user_id:'me',connected_user_id:'pending',status:'pending'},
  {user_id:'stranger',connected_user_id:'other',status:'accepted'},
  {user_id:'me',connected_user_id:'followed',status:'accepted'},
 ])).toEqual(['followed','outgoing','incoming']);
});
it('returns an empty audience when the user has no followed or connected profiles', () => {
 expect(shortFriendIds('me', [], [])).toEqual([]);
});
