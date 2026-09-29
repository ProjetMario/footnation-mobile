export type ContentReport = {
  id: string;
  reported_id: string;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  content_kind: "post" | "short" | "story" | null;
  content_id: string | null;
  revision: number;
};
export const reportStatuses = {
  pending: "À traiter",
  reviewed: "En cours",
  resolved: "Contenu retiré",
  dismissed: "Classé sans suite",
} as const;
export const reportReasons: Record<string, string> = {
  inappropriate: "Contenu inapproprié",
  harassment: "Harcèlement",
  spam: "Spam",
  other: "Autre",
  violence: "Violence ou menaces",
  sexual_content: "Contenu sexuel",
  child_safety: "Sécurité d’un mineur",
};
export type ReportAction = "review" | "dismiss" | "remove_content";
export const reportColumns =
  "id,reported_id,reporter_id,reason,details,status,admin_notes,created_at,reviewed_at,content_kind,content_id,revision";
export function reportReviewPayload(
  report: ContentReport,
  action: ReportAction,
  notes: string,
) {
  if (
    !["review", "dismiss", "remove_content"].includes(action) ||
    !["pending", "reviewed"].includes(report.status)
  )
    throw new Error(
      "Ce signalement ne peut plus être modifié. Actualisez la liste.",
    );
  if (!Number.isInteger(report.revision) || report.revision < 0)
    throw new Error("Actualisez ce signalement.");
  if (notes.trim().length < 3 || notes.trim().length > 3000)
    throw new Error(
      "Indiquez un motif de décision entre 3 et 3 000 caractères.",
    );
  if (action === "remove_content" && !reportContentPath(report))
    throw new Error("Ce signalement ne contient pas de contenu identifié.");
  return {
    p_id: report.id,
    p_action: action,
    p_notes: notes.trim(),
    p_revision: report.revision,
  };
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function reportContentPath(
  report: Pick<ContentReport, "content_kind" | "content_id">,
): string | null {
  if (!report.content_id || !uuid.test(report.content_id)) return null;
  const prefix = { post: "/posts/", short: "/shorts/", story: "/stories/" };
  return report.content_kind &&
    Object.prototype.hasOwnProperty.call(prefix, report.content_kind)
    ? prefix[report.content_kind] + report.content_id
    : null;
}
export function reportUrgency(
  report: Pick<ContentReport, "status" | "reason" | "created_at">,
  now = Date.now(),
) {
  if (!["pending", "reviewed"].includes(report.status)) return null;
  if (report.reason === "child_safety" || report.reason === "violence")
    return "Prioritaire";
  return now - Date.parse(report.created_at) >= 24 * 60 * 60 * 1000
    ? "En attente depuis plus de 24 h"
    : null;
}
