export function clubLogoSelection(select?: string, rootClub?: boolean): {
  select: string; rootClub: boolean; hasClubs: boolean; children: any[];
};
export function projectSelectedClubLogos<T>(value: T, selection: ReturnType<typeof clubLogoSelection>): T;
export function clubLogoFetch(baseUrl: string, fetcher?: typeof fetch): typeof fetch;
