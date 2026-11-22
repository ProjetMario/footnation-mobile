// Framework-independent contract shared by the native and web admin consoles.
export const categoryLabels: Record<string, string> = {
  emploi_cdi: "Emploi CDI",
  emploi_cdd: "Emploi CDD",
  benevolat: "Bénévolat",
  mission_ponctuelle: "Mission ponctuelle",
  recherche_joueur: "Recherche de joueur",
  recherche_staff: "Recherche de staff",
  autre: "À préciser",
};
export const signalLabels: Record<string, string> = {
  payment_guarantee: "Paiement avec promesse de recrutement garanti",
  sensitive_data: "Demande de codes ou de données bancaires",
  pressure: "Pression pour un paiement difficilement réversible",
  spam: "Promotion hors sujet ou gains garantis",
};
export const decisionFilters = [
  ["review", "À examiner"],
  ["pending", "En attente"],
  ["failed", "En échec"],
  ["reviewed", "Examinées"],
  ["all", "Toutes"],
] as const;
export type DecisionFilter = (typeof decisionFilters)[number][0];
export type ReviewOutcome =
  "validated" | "dismissed" | "escalated" | "apply_category";
export const outcomeLabels: Record<ReviewOutcome, string> = {
  validated: "Analyse validée",
  dismissed: "Alerte écartée",
  escalated: "À approfondir",
  apply_category: "Catégorie appliquée",
};
export type DecisionStatus = {
  ready: boolean;
  schedulerConfigured: boolean;
  enabled: boolean;
  dailyLimit: number;
  usedToday: number;
  pending: number;
  review: number;
  failed: number;
  lastWorkerAt: string | null;
};
export type DecisionRow = {
  opportunity_id: string;
  revision: string;
  title: string;
  description: string | null;
  opportunity_type: string;
  listing_kind: string;
  is_active: boolean;
  status: "pending" | "processing" | "completed" | "failed";
  review_outcome: ReviewOutcome | null;
  review_note: string | null;
  reviewed_at: string | null;
  needs_review: boolean;
  result: null | {
    category: string | null;
    categoryConfidence: number | null;
    listingKind: string | null;
    kindConfidence: number | null;
    signals: Record<string, number | null>;
    incomplete: boolean;
    policyVersion: string;
    inputTokens: number;
  };
};
export type DecisionPage = {
  rows: DecisionRow[];
  total: number;
  nextOffset: number | null;
};
export type DecisionClient = {
  auth: {
    getSession(): Promise<{
      data: { session: { user: { id: string }; access_token: string } | null };
      error: unknown;
    }>;
  };
  functions: {
    invoke(
      name: string,
      options: {
        body: Record<string, unknown>;
        headers: Record<string, string>;
      },
    ): Promise<{ data: any; error: any }>;
  };
};
export const confidenceLabel = (value: number | null) =>
  value === null ? "Indéterminée" : `${Math.round(value * 100)} %`;
export function createDecisionApi(uid: string, client: DecisionClient) {
  async function session() {
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== uid)
      throw new Error("La session a changé. Rouvrez l’administration.");
    return data.session.access_token;
  }
  async function call(action: string, payload: Record<string, unknown> = {}) {
    const jwt = await session();
    const result = await client.functions.invoke("opportunity-decisions", {
      body: { action, ...payload },
      headers: { Authorization: `Bearer ${jwt}` },
    });
    await session();
    if (result.error) {
      if (result.error.context instanceof Response) {
        const body = await result.error.context
          .clone()
          .json()
          .catch(() => null);
        if (typeof body?.error === "string" && body.error.length < 250)
          throw new Error(body.error);
      }
      throw new Error(
        "Le service d’analyse est indisponible. Vérifiez son activation côté serveur.",
      );
    }
    if (!result.data || typeof result.data !== "object" || result.data.error)
      throw new Error("L’opération n’a pas été confirmée.");
    return result.data;
  }
  return {
    async status(): Promise<DecisionStatus> {
      const data = await call("status");
      if (
        !["ready", "schedulerConfigured", "enabled"].every(
          (k) => typeof data[k] === "boolean",
        ) ||
        !["dailyLimit", "usedToday", "pending", "review", "failed"].every(
          (k) => Number.isSafeInteger(data[k]) && data[k] >= 0,
        )
      )
        throw new Error("État du service invalide.");
      return data;
    },
    async page(filter: DecisionFilter, offset: number): Promise<DecisionPage> {
      const data = await call("list", { filter, offset });
      if (
        !Array.isArray(data.rows) ||
        !Number.isSafeInteger(data.total) ||
        data.total < 0 ||
        !(
          data.nextOffset === null ||
          (Number.isInteger(data.nextOffset) && data.nextOffset > offset)
        ) ||
        data.rows.some(
          (r: DecisionRow) =>
            typeof r.opportunity_id !== "string" ||
            typeof r.revision !== "string" ||
            typeof r.title !== "string" ||
            !["pending", "processing", "completed", "failed"].includes(
              r.status,
            ),
        )
      )
        throw new Error("Liste d’analyses invalide.");
      return data;
    },
    async configure(enabled: boolean, dailyLimit: number) {
      if ((await call("configure", { enabled, dailyLimit })).ok !== true)
        throw new Error("Réglages non confirmés.");
    },
    async backfill() {
      const data = await call("backfill");
      if (!Number.isInteger(data.queued))
        throw new Error("Ajout non confirmé.");
      return data.queued as number;
    },
    async run() {
      const data = await call("run");
      if (!Number.isInteger(data.completed) || !Number.isInteger(data.failed))
        throw new Error("Traitement non confirmé.");
      return data as {
        processed: number;
        completed: number;
        failed: number;
        superseded: number;
      };
    },
    async retry(row: DecisionRow) {
      if (
        (
          await call("retry", {
            id: row.opportunity_id,
            revision: row.revision,
          })
        ).ok !== true
      )
        throw new Error("Relance non confirmée.");
    },
    async review(row: DecisionRow, outcome: ReviewOutcome, note: string) {
      if (note.trim().length < 3 || note.length > 1000)
        throw new Error("Ajoutez un motif de 3 à 1 000 caractères.");
      if (
        (
          await call("review", {
            id: row.opportunity_id,
            revision: row.revision,
            outcome,
            note: note.trim(),
          })
        ).ok !== true
      )
        throw new Error("Décision non confirmée.");
    },
  };
}
