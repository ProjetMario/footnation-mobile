export const adminSections = [
  ["overview", "Vue d’ensemble"],
  ["performance", "Performances"],
  ["users", "Utilisateurs"],
  ["incomplete-profiles", "Profils incomplets"],
  ["clubs", "Clubs"],
  ["sports-sync", "Données sportives"],
  ["claims", "Revendications"],
  ["premium", "Premium"],
  ["publications", "Publications"],
  ["moderation", "Modération"],
  ["posthog", "PostHog"],
] as const;
export type AdminSection = (typeof adminSections)[number][0];
export const userSections = [
  ["profile", "Profil"],
  ["content", "Contenu"],
  ["social", "Réseau"],
  ["favorites", "Favoris"],
  ["opportunities", "Annonces"],
  ["activity", "Activité"],
  ["completion", "Complétude"],
  ["admin", "Administration"],
] as const;
export type UserSection = (typeof userSections)[number][0];
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json | undefined };
export type AdminRecord = {
  id: string;
  _version: string;
  [key: string]: Json | undefined;
};
export type Page = {
  rows: AdminRecord[];
  total: number;
  nextOffset: number | null;
};
export type Filters = {
  search?: string;
  role?: string;
  department?: string;
  country?: string;
  status?: string;
  completion?: string;
  sort?: string;
  direction?: string;
  userId?: string;
  id?: string;
  period?: string;
};
export const resources = [
  "users",
  "incomplete-profiles",
  "premium",
  "clubs",
  "publications",
  "shorts",
  "photos",
  "connections",
  "followers",
  "following",
  "likes",
  "blocks",
  "blocked-by",
  "reports-received",
  "reports-sent",
  "favorite-clubs",
  "club-follows",
  "saved-posts",
  "match-follows",
  "opportunities",
  "applications",
  "events",
  "profile-views",
  "sessions",
  "page-views",
  "interactions",
  "post-reactions",
  "short-likes",
  "reactions-received",
  "short-likes-received",
  "ratings",
  "ratings-given",
  "reminders",
  "message-reports",
] as const;
export type Resource = (typeof resources)[number];
export type AdminAction =
  | "profile.update"
  | "profile.premium"
  | "profile.suspend"
  | "profile.completion"
  | "club.update"
  | "club.suspend"
  | "club.delete"
  | "post.delete"
  | "short.delete"
  | "photo.delete"
  | "connection.delete"
  | "follower.delete"
  | "block.delete"
  | "rating.update"
  | "rating.delete"
  | "message.review"
  | "message.block";
export type Command = {
  action: AdminAction;
  record: AdminRecord;
  values?: Record<string, Json>;
  reason?: string;
};
export type Receipt = { id: string; action: AdminAction; target_id: string };
export type Overview = {
  generatedAt: string;
  counts: Record<string, number | null>;
  breakdowns: Record<string, { label: string; count: number }[]>;
  topUsers: AdminRecord[];
  topClubs: AdminRecord[];
  recent: AdminRecord[];
  signups: { period: string; value: number }[];
};
export const completionFields = {
  full_name: "Nom",
  club: "Club",
  primary_role: "Rôle",
  highest_level: "Niveau",
  favorite_pro_club: "Club favori",
  avatar_url: "Photo",
  gender: "Genre",
} as const;
export function completion(row: Record<string, unknown>) {
  const missing = Object.keys(completionFields).filter(
    (k) => typeof row[k] !== "string" || !(row[k] as string).trim(),
  );
  return { missing, percent: Math.round(((7 - missing.length) * 100) / 7) };
}
export function sectionFrom(value: unknown): AdminSection {
  return adminSections.some(([id]) => id === value)
    ? (value as AdminSection)
    : "overview";
}
export function userSectionFrom(value: unknown): UserSection {
  return userSections.some(([id]) => id === value)
    ? (value as UserSection)
    : "profile";
}
export function textValue(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim()
    ? value
    : typeof value === "number"
      ? String(value)
      : fallback;
}
export function objectValue(value: unknown): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}
export function profileName(row: Record<string, unknown>) {
  return textValue(row.full_name, textValue(row.username, "Profil sans nom"));
}
export function isSuspended(row: Record<string, unknown>, now = Date.now()) {
  return (
    row.is_suspended === true &&
    (!row.suspended_until || Date.parse(String(row.suspended_until)) > now)
  );
}
export function formatCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("fr-FR")
    : "Indisponible";
}
export function formatDate(value: unknown) {
  const date = typeof value === "string" ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
    : "—";
}
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function parsePage(value: unknown): Page {
  const data = objectValue(value);
  if (
    !Array.isArray(data.rows) ||
    typeof data.total !== "number" ||
    data.total < 0 ||
    !Number.isInteger(data.total) ||
    !(
      data.nextOffset === null ||
      (typeof data.nextOffset === "number" &&
        Number.isInteger(data.nextOffset) &&
        data.nextOffset > 0)
    )
  )
    throw new Error("Réponse d’administration incomplète. Actualisez.");
  const rows = data.rows.map((row) => {
    const item = objectValue(row);
    if (typeof item.id !== "string" || typeof item._version !== "string")
      throw new Error("Une donnée d’administration est invalide.");
    return item as AdminRecord;
  });
  return {
    rows,
    total: data.total,
    nextOffset: data.nextOffset as number | null,
  };
}
export function validateCommand(command: Command) {
  if (!command.record.id || !command.record._version)
    throw new Error("Actualisez la fiche avant de la modifier.");
  if ((command.reason || "").trim().length < 3)
    throw new Error(
      "Précisez le motif de cette action (3 caractères minimum).",
    );
  if ((command.reason || "").length > 1000)
    throw new Error("Le motif est trop long.");
  return {
    p_action: command.action,
    p_id: command.record.id,
    p_expected: command.record._version,
    p_values: command.values || {},
    p_reason: command.reason!.trim(),
  };
}
export function adminError(error: unknown): Error {
  const code = objectValue(error).code;
  if (["PGRST202", "42883"].includes(String(code)))
    return new Error(
      "Le service Super admin doit être activé sur le serveur. Aucune modification n’a été effectuée.",
    );
  if (code === "42501")
    return new Error(
      "Accès administrateur refusé ou révoqué. Reconnectez-vous.",
    );
  if (code === "40001")
    return new Error(
      "Cette fiche a été modifiée entre-temps. Actualisez avant de réessayer.",
    );
  if (code === "23503")
    return new Error(
      "Cet élément est encore utilisé. Sa suppression n’a pas été effectuée.",
    );
  return error instanceof Error
    ? error
    : new Error(
        "Cette opération n’a pas été confirmée. Actualisez et réessayez.",
      );
}
