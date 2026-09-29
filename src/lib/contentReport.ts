import { clubReportReasons } from "./clubReport";

export const profileReportReasons: Record<string, string> = {
  ...clubReportReasons,
  violence: "Violence ou menaces",
  sexual_content: "Contenu sexuel",
  child_safety: "Sécurité d’un mineur",
};
const contexts = {
  post: {
    table: "posts",
    link: "https://www.foot-nation.com/posts/",
    label: "cette publication",
  },
  short: {
    table: "shorts",
    link: "https://www.foot-nation.com/shorts?id=",
    label: "ce short",
  },
  // The main website has no /stories/:id route. Use the registered native route.
  story: {
    table: "stories",
    link: "com.footnation.app://stories/",
    label: "cette story",
  },
} as const;
export type ReportContentKind = keyof typeof contexts;
export type ReportContent = {
  kind: ReportContentKind;
  id: string;
  authorId: string;
  url: string;
  label: string;
};
type ContentTable = (typeof contexts)[ReportContentKind]["table"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Parameters select only an owned table; the readable row proves attribution. */
export async function resolveReportContent(
  input: { kind: unknown; contentId: unknown; authorId: unknown },
  read: (
    table: ContentTable,
    id: string,
  ) => Promise<{ id: string; user_id: string } | null>,
): Promise<ReportContent | null> {
  if (input.kind === undefined && input.contentId === undefined) return null;
  if (
    typeof input.kind !== "string" ||
    !Object.hasOwn(contexts, input.kind) ||
    typeof input.contentId !== "string" ||
    !uuid.test(input.contentId) ||
    typeof input.authorId !== "string" ||
    !uuid.test(input.authorId)
  )
    throw new Error(
      "Le lien de signalement est invalide. Rouvrez-le depuis le contenu concerné.",
    );
  const kind = input.kind as ReportContentKind;
  const config = contexts[kind];
  const row = await read(config.table, input.contentId);
  if (!row || row.id !== input.contentId || row.user_id !== input.authorId)
    throw new Error(
      "Ce contenu n’est plus disponible pour ce signalement. Vous pouvez toujours signaler son auteur depuis son profil.",
    );
  return {
    kind,
    id: row.id,
    authorId: row.user_id,
    url: `${config.link}${row.id}`,
    label: config.label,
  };
}

export function profileReportPayload(
  reason: string,
  details: string,
  content: ReportContent | null,
) {
  if (!Object.hasOwn(profileReportReasons, reason))
    throw new Error("Choisissez un motif de signalement.");
  const prefix = content ? `Contenu signalé : ${content.url}\n\n` : "";
  const text = `${prefix}${details.trim()}`.trim();
  if (text.length > 3000)
    throw new Error("Les précisions sont trop longues pour ce signalement.");
  return { reason, details: text || null };
}

export function contentReportPath(
  authorId: string,
  kind: ReportContentKind,
  contentId: string,
) {
  return {
    pathname: "/report/[id]" as const,
    params: { id: authorId, kind, contentId },
  };
}
