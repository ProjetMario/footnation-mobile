/** Remove squad suffixes while preserving a club's identity (including 73, 38…). */
export function clubTeamBaseName(name: string) {
  return name
    .replace(/\s+U\s*\d{1,2}(?:\s*[/\-]\s*(?:U\s*)?\d{1,2})?(?=\s|$).*$/i, "")
    .replace(
      /\s+(?:s[eé]niors?|f[eé]minines?|masculins?|v[eé]t[eé]rans?|r[eé]serve|[FM]\s*\d+)(?=\s|$).*$/i,
      "",
    )
    .replace(/\s+[1-9]$/, "")
    .trim();
}

export function clubLogoIdentity(name: string) {
  return clubTeamBaseName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/football\s+club/g, "fc")
    .replace(/\bf[.\s]+c\b/g, "fc")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(
      (word) =>
        word && !["d", "de", "du", "des", "l", "le", "la"].includes(word),
    )
    .sort()
    .join(" ");
}

export function matchingClubLogo(
  name: string,
  rows: { name: string; logo: string | null }[],
) {
  const identity = clubLogoIdentity(name);
  if (!identity) return null;
  const matches = rows.filter(
    (row) => row.logo && clubLogoIdentity(row.name) === identity,
  );
  // Never choose arbitrarily between different clubs with an ambiguous identity.
  const logos = [...new Set(matches.map((row) => row.logo!))];
  return logos.length === 1 ? logos[0] : null;
}
