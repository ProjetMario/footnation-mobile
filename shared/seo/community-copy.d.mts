export type CommunityCopy = Record<'community' | 'forum' | 'discussions' | 'join' | 'create' | 'empty' | 'about' | 'city' | 'country' | 'founded' | 'teams' | 'matches' | 'rankings' | 'sources' | 'checked' | 'independent' | 'language' | 'clubs' | 'website' | 'next' | 'previous' | 'reply' | 'original' | 'replies' | 'votes' | 'intro', string>;
export const COMMUNITY_LOCALES: readonly string[];
export const COPY_VERSION: number;
export const COPY_UPDATED_AT: string;
export function communityCopy(locale: string): CommunityCopy;
export function isCommunityLocale(locale: unknown): locale is string;
export function localeDirection(locale: string): 'ltr' | 'rtl';
export function nativeLanguageName(locale: string): string;
