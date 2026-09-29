export type MemberCalendarPeriod = "future" | "past";
export type MemberCalendarScope = "teams" | "club";
export type MemberCalendarEvent = {
  id: string;
  kind: "match" | "training";
  sort_date: string;
  team_id: string | null;
  team_name: string | null;
  category: string | null;
  status?: string | null;
  session_type?: string | null;
  opponent_name?: string | null;
  venue?: string | null;
  competition?: string | null;
  home_score?: number | null;
  away_score?: number | null;
  is_home?: boolean | null;
};

export const memberCalendarPageSize = 30;

export function uniqueCalendarEvents(pages: MemberCalendarEvent[][]) {
  return [
    ...new Map(
      pages.flat().map((row) => [`${row.kind}:${row.id}`, row]),
    ).values(),
  ];
}
