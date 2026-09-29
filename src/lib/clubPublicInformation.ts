import bundledInformation from "../data/clubPublicInformation.json";

type EnrichmentRecord = {
  numero: string;
  status: number;
  data?: {
    club?: {
      name?: string | null;
      normalized_name?: string | null;
      fff_affiliation_number?: string | null;
      league?: string | null;
      district?: string | null;
      full_address?: string | null;
      shirt_colors?: string[] | null;
    } | null;
    facilities?: Array<{
      name?: string | null;
      full_address?: string | null;
      additional_info?: string | null;
    }> | null;
  } | null;
};

type EnrichmentReport = {
  results?: EnrichmentRecord[];
};

function normalizeClubName(name: unknown) {
  return String(name || "")
    .toUpperCase()
    .replace(/[.'\u2018\u2019-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function textValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return null;
}

export function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function parseFacilities(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { name: item.trim() };
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        return {
          name: textValue(row.name, row.label, row.title, row.type),
          additional_info: textValue(row.additional_info, row.description),
          full_address: textValue(row.full_address, row.address),
        };
      }
      return { name: null };
    })
    .filter((item) => item.name || item.full_address);
}

export function buildAddress(
  club: Record<string, any>,
  enriched?: string | null,
) {
  const fallback = [
    textValue(club.address),
    [textValue(club.postal_code), textValue(club.city)]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join(", ");
  return textValue(enriched, fallback);
}

export function findClubEnrichment(club: Record<string, any>) {
  // Expo/native cannot fetch the web project's relative /data URL.
  // This bundle is generated from the same public report, without staff/contact data.
  const rows = (bundledInformation as EnrichmentReport).results || [];
  const externalId = textValue(club.fff_affiliation_number, club.external_id);
  const byId = externalId
    ? rows.find((row) => row.numero === externalId)
    : null;
  if (byId) return byId;
  const target = normalizeClubName(club.name);
  if (!target) return null;
  return (
    rows.find(
      (row) =>
        normalizeClubName(row.data?.club?.name) === target ||
        normalizeClubName(row.data?.club?.normalized_name) === target,
    ) || null
  );
}

export function clubShirtColors(club: Record<string, any>) {
  const enriched = findClubEnrichment(club)?.data?.club;
  const metadata =
    club.metadata && typeof club.metadata === "object" ? club.metadata : {};
  for (const value of [
    enriched?.shirt_colors,
    metadata.shirt_colors,
    metadata.colors,
    club.shirt_colors,
    club.colors,
  ]) {
    const list = stringArray(value);
    if (list.length) return list;
  }
  return [];
}
