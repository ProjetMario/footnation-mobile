import { supabase, requireBackend } from "./supabase";

export const supportStatuses = {
  in_progress: "En cours",
  resolved: "Résolu",
  closed: "Terminé",
} as const;
export type SupportStatus = keyof typeof supportStatuses;
export const supportCategories = {
  account: "Mon compte",
  technical: "Problème technique",
  club: "Mon club",
  safety: "Sécurité et signalement",
  other: "Autre demande",
} as const;
export type SupportCategory = keyof typeof supportCategories;
export type SupportTicket = {
  id: string;
  user_id: string;
  ticket_number: string;
  subject: string;
  category: SupportCategory;
  status: SupportStatus;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type SupportMessage = {
  id: string;
  sequence: number;
  author_id: string | null;
  author_kind: "member" | "support";
  kind: "message" | "status";
  body: string;
  created_at: string;
};
export type SupportInbox = {
  staff: boolean;
  tickets: SupportTicket[];
  counts: Record<SupportStatus, number>;
};
export type SupportThread = {
  staff: boolean;
  ticket: SupportTicket;
  messages: SupportMessage[];
};
export function supportUnavailable(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "PGRST202" || code === "42883";
}
export function supportError(error: unknown): string {
  if (supportUnavailable(error))
    return "La messagerie d’aide n’est pas encore activée. Le formulaire de contact reste disponible.";
  return (
    (error as { message?: string })?.message ||
    "Impossible de joindre le centre d’aide. Réessayez."
  );
}
export function supportDraft(
  subject: string,
  category: SupportCategory,
  message: string,
) {
  const clean = { subject: subject.trim(), category, message: message.trim() };
  if (
    clean.subject.length < 3 ||
    clean.subject.length > 160 ||
    !(category in supportCategories) ||
    !clean.message ||
    clean.message.length > 5000
  )
    throw new Error(
      "Précisez un sujet (3 à 160 caractères), une catégorie et un message (5 000 caractères maximum).",
    );
  return clean;
}
// The expected account is verified again before every RPC; server auth.uid()
// remains authoritative, including for reads, staff rights and suspensions.
export async function supportRpc<T>(
  uid: string,
  name: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  requireBackend();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || auth.user?.id !== uid)
    throw new Error("Votre session a changé. Reconnectez-vous.");
  const { data, error } = await supabase.rpc(name, {
    ...params,
    p_actor_id: uid,
  });
  if (error) throw error;
  return data as T;
}
