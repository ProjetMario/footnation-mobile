import {
  parseProfileInfoSearchField,
  profileInfoArrayFields,
} from "./profileInfoActions";
import { supabase } from "./supabase";
import { isSuspended } from "./validation";
export const searchCategories = [
  { key: "all", label: "Tout" },
  { key: "profiles", label: "Profils" },
  { key: "clubs", label: "Clubs" },
  { key: "posts", label: "Publications" },
  { key: "events", label: "Événements" },
] as const;
export type SearchCategory = (typeof searchCategories)[number]["key"];
export type SearchResult = {
  id: string;
  kind: Exclude<SearchCategory, "all">;
  title: string;
  subtitle: string;
  link: string;
  image: string | null;
  reason?: string;
};
function fieldSearchFilter(fields: string[], term: string) {
  const pattern = JSON.stringify(`%${term.replace(/[%_\\]/g, "\\$&")}%`);
  return fields.map((column) => `${column}.ilike.${pattern}`).join(",");
}
export function eventSearchFilter(term: string) {
  return fieldSearchFilter(
    [
      "title",
      "description",
      "location",
      "location_city",
      "location_department_name",
    ],
    term,
  );
}
export async function searchFootNation(
  uid: string,
  term: string,
  category: SearchCategory,
  offset: number,
  profileField?: string,
  browse = false,
  excludedIds: string[] = [],
): Promise<{ rows: SearchResult[]; hasMore: boolean }> {
  term = term.trim();
  if ((!term && !browse) || !uid) return { rows: [], hasMore: false };
  const blocks = await supabase
    .from("user_blocks")
    .select("blocker_id,blocked_id")
    .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
  if (blocks.error) throw blocks.error;
  const blocked = (blocks.data || []).map((row) =>
    row.blocker_id === uid ? row.blocked_id : row.blocker_id,
  );
  const kinds: Exclude<SearchCategory, "all">[] =
    category === "all" ? ["profiles", "clubs", "posts", "events"] : [category];
  const pages = await Promise.all(
    kinds.map(async (kind) => {
      let query;
      if (kind === "profiles") {
        query = supabase
          .from("profiles")
          .select(
            "id,full_name,username,avatar_url,club,city,is_suspended,suspended_until",
          )
          .neq("id", uid);
        const field = parseProfileInfoSearchField(profileField);
        if (term)
          query = field
            ? profileInfoArrayFields.includes(field)
              ? query.contains(field, [term])
              : query.eq(field, term)
            : query.or(
                fieldSearchFilter(
                  ["full_name", "username", "club", "city", "position"],
                  term,
                ),
              );
        else
          query = query
            .or("primary_role.ilike.joueu%,position.not.is.null")
            .or("account_type.is.null,account_type.eq.personal")
            .or(
              `is_suspended.is.null,is_suspended.eq.false,suspended_until.lte.${new Date().toISOString()}`,
            );
        query = query.order("full_name");
      } else if (kind === "clubs") {
        query = supabase
          .from("fff_clubs")
          .select("id,name,city,department_code,logo_url");
        if (term)
          query = query.or(
            fieldSearchFilter(
              ["name", "short_name", "city", "department_name"],
              term,
            ),
          );
        query = query.order("name");
      } else if (kind === "posts") {
        query = supabase
          .from("posts")
          .select("id,user_id,content,hashtags,image_url,created_at")
          .or("moderation_hidden.is.null,moderation_hidden.eq.false");
        if (term)
          query = query.ilike(
            "content",
            `%${term.replace(/[%_\\]/g, "\\$&")}%`,
          );
        query = query.order("created_at", { ascending: false });
      } else {
        query = supabase
          .from("events")
          .select("id,title,location,location_city,start_date,organizer_id")
          .eq("status", "published");
        if (term) query = query.or(eventSearchFilter(term));
        query = query.order("start_date", { ascending: !browse });
      }
      if (blocked.length && kind !== "clubs")
        query = query.not(
          kind === "profiles"
            ? "id"
            : kind === "posts"
              ? "user_id"
              : "organizer_id",
          "in",
          `(${blocked.join(",")})`,
        );
      if (excludedIds.length)
        query = query.not("id", "in", `(${excludedIds.join(",")})`);
      const result = await query.order("id").range(offset, offset + 19);
      if (result.error) throw result.error;
      const raw = result.data as unknown as {
        id: string;
        full_name?: string;
        username?: string;
        avatar_url?: string;
        logo_url?: string;
        club?: string;
        city?: string;
        is_suspended?: boolean;
        suspended_until?: string;
        name?: string;
        department_code?: string;
        content?: string;
        image_url?: string;
        created_at?: string;
        hashtags?: string[] | null;
        title?: string;
        location_city?: string;
        location?: string;
        start_date?: string;
      }[];
      const rows: SearchResult[] = raw
        .filter((row) => kind !== "profiles" || !isSuspended(row))
        .map((row) => ({
          id: `${kind}:${row.id}`,
          kind,
          title:
            kind === "profiles"
              ? row.full_name || row.username || "Membre FootNation"
              : kind === "clubs"
                ? row.name || "Club"
                : kind === "posts"
                  ? [row.content, ...(row.hashtags || []).map((tag) => `#${tag}`)].filter(Boolean).join(" ") || "Publication"
                  : row.title || "Événement",
          subtitle:
            kind === "profiles"
              ? [row.club, row.city].filter(Boolean).join(" · ")
              : kind === "clubs"
                ? [row.city, row.department_code].filter(Boolean).join(" · ")
                : kind === "posts"
                  ? new Date(row.created_at!).toLocaleDateString("fr-FR")
                  : [
                      row.location_city || row.location,
                      new Date(row.start_date!).toLocaleDateString("fr-FR"),
                    ]
                      .filter(Boolean)
                      .join(" · "),
          link: `/${kind === "profiles" ? "profile" : kind === "clubs" ? "club" : kind}/${row.id}`,
          image:
            kind === "profiles"
              ? row.avatar_url || null
              : kind === "clubs"
                ? row.logo_url || null
                : kind === "posts"
                  ? row.image_url || null
                  : null,
        }));
      return { rows, hasMore: raw.length === 20 };
    }),
  );
  return {
    rows: pages.flatMap((page) => page.rows),
    hasMore: pages.some((page) => page.hasMore),
  };
}
