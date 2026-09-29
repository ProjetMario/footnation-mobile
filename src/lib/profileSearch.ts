// Quote the complete PostgREST filter value so punctuation stays in the search
// text rather than introducing another predicate. Escape LIKE wildcards too.
export function profileSearchFilter(search: string) {
  const value = JSON.stringify(`%${search.replace(/[%_\\]/g, "\\$&")}%`);
  return ["full_name", "username", "club", "city"]
    .map((column) => `${column}.ilike.${value}`)
    .join(",");
}
