import { Platform } from 'react-native';
import { createClubIdResolver, readClubByRoute } from '../../shared/seo/club-route-index.mjs';
import { requireBackend, supabase } from './supabase';

const resolveId = createClubIdResolver({ baseUrl: Platform.OS === 'web' ? '' : 'https://www.foot-nation.com' });

export async function readClub(route: string, selection = '*') {
  requireBackend();
  const read = async (field: 'id' | 'slug', value: string) => {
    let query = supabase.from('fff_clubs').select(selection).eq(field, value);
    if (field === 'slug') query = query.order('id', { ascending: true }).limit(1);
    const result = await query.maybeSingle();
    if (result.error) throw result.error;
    return result.data as Record<string, any> | null;
  };
  return readClubByRoute(route, { resolveId, readById: id => read('id', id), readBySlug: slug => read('slug', slug) });
}
