export type ClubSearchType = "all" | "club" | "five_center";
// Preserve the original directory's name-based indoor classification.
const indoorKeywords = ["five", "soccer", "urban", "foot indoor", "futsal"];
export function clubSearchFilter(search: string, type: ClubSearchType) {
  const clauses: string[] = [];
  if (search.trim()) {
    const value = JSON.stringify(
      `%${search.trim().replace(/[%_\\]/g, "\\$&")}%`,
    );
    clauses.push(
      `or(${["name", "short_name", "city"].map((key) => `${key}.ilike.${value}`).join(",")})`,
    );
  }
  if (type !== "all") {
    const operator = type === "club" ? "not.ilike" : "ilike";
    clauses.push(
      `${type === "club" ? "and" : "or"}(${indoorKeywords.map((word) => `name.${operator}.${JSON.stringify(`%${word}%`)}`).join(",")})`,
    );
  }
  return clauses.length ? `and(${clauses.join(",")})` : null;
}
