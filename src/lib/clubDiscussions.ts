import { createClient } from "@supabase/supabase-js";
import { supabase, requireBackend } from "./supabase";
import { readAsset } from "./readAsset";
import { discussionLanguage } from "./communityLanguage";

export const discussionCategories = {
  matches: "Matchs", transfers: "Mercato", club: "Vie du club",
  questions: "Questions", other: "Autres",
} as const;
export type DiscussionCategory = keyof typeof discussionCategories;
export type DiscussionSort = "recent" | "popular" | "best";
export type DiscussionMedia = { id: string; mime_type: string; size_bytes: number };
export type DiscussionAuthor = { id: string; name: string; avatar_url: string | null };
export type DiscussionReply = {
  id: string; topic_id: string; parent_id: string | null; content: string;
  created_at: string; updated_at: string; author: DiscussionAuthor | null;
  score: number; deleted: boolean; media: DiscussionMedia | null;
  my_vote: number; can_edit: boolean; can_moderate: boolean;
};
export type DiscussionTopic = Omit<DiscussionReply, "topic_id" | "parent_id"> & {
  club_id: string; club_name: string; club_slug: string; title: string;
  category: DiscussionCategory; language: string; replies_count: number;
  is_locked: boolean; is_pinned: boolean; following: boolean;
};
export type DiscussionPage<T> = { items: T[]; total: number; has_more: boolean };
export type DiscussionDetail = {
  topic: DiscussionTopic | null; replies: DiscussionReply[]; total: number; has_more: boolean;
};
export type DiscussionFilters = {
  clubId?: string; query?: string; category?: string; sort?: DiscussionSort;
  country?: string; language?: string;
};
export type DiscussionAttachment = { id: string; uri: string; mime: string; name: string };
export const discussionRoot = (club: string) => `/club/${encodeURIComponent(club)}/discussions`;
export const discussionPath = (topic: Pick<DiscussionTopic, "club_slug" | "club_id" | "id">) =>
  `${discussionRoot(topic.club_slug || topic.club_id)}/${encodeURIComponent(topic.id)}`;
export const discussionMediaUrl = (id: string) =>
  `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/discussion-media?id=${encodeURIComponent(id)}`;

/** Public reads must not leave a spinner running indefinitely on a stalled connection. */
async function readDiscussionRpc(name: string, params: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const result = await supabase.rpc(name, params).abortSignal(controller.signal);
    if (controller.signal.aborted) throw new Error("Les discussions sont momentanément indisponibles.");
    return result;
  } finally { clearTimeout(timer); }
}

export async function listDiscussions(filters: DiscussionFilters, offset = 0, limit = 20): Promise<DiscussionPage<DiscussionTopic>> {
  requireBackend();
  const { data, error } = await readDiscussionRpc("get_club_discussions", {
    p_club_id: filters.clubId || null, p_query: filters.query?.trim() || null,
    p_category: filters.category || null, p_sort: filters.sort || "recent",
    p_country: filters.country?.trim().toUpperCase() || null,
    p_language: discussionLanguage(filters.language) || filters.language?.trim() || null,
    p_limit: limit, p_offset: offset,
  });
  if (error) throw error;
  if (!data || !Array.isArray(data.items)) throw new Error("Les discussions sont momentanément indisponibles.");
  return data;
}
export async function getDiscussion(id: string, offset = 0): Promise<DiscussionDetail> {
  requireBackend();
  const { data, error } = await readDiscussionRpc("get_club_discussion", { p_topic_id: id, p_limit: 50, p_offset: offset });
  if (error) throw error;
  if (!data || !Array.isArray(data.replies)) throw new Error("Ce sujet est momentanément indisponible.");
  return data;
}

/** Freeze the bearer identity for this operation; account changes cannot redirect a pending upload. */
export async function discussionWriter(userId: string) {
  requireBackend();
  const current = await supabase.auth.getSession();
  if (current.error || current.data.session?.user.id !== userId) throw new Error("Votre session a changé. Reconnectez-vous avant de publier.");
  const token = current.data.session.access_token;
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createClient(base, key, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  async function assertAccount() {
    const latest = await supabase.auth.getSession();
    if (latest.error || latest.data.session?.user.id !== userId) throw new Error("Votre session a changé. Cette opération a été interrompue.");
  }
  return {
    async rpc<T = unknown>(name: string, params: Record<string, unknown>): Promise<T> {
      await assertAccount();
      const result = await client.rpc(name, params);
      if (result.error) throw result.error;
      await assertAccount();
      return result.data as T;
    },
    async upload(asset: DiscussionAttachment): Promise<string> {
      await assertAccount();
      const video = asset.mime === "video/mp4";
      if (!["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(asset.mime))
        throw new Error("Choisissez une image JPEG, PNG, WebP ou une vidéo MP4.");
      const bytes = await readAsset(asset.uri, (video ? 50 : 10) * 1024 * 1024);
      if (!bytes.byteLength) throw new Error("Le fichier sélectionné est vide.");
      await assertAccount();
      const response = await fetch(`${base}/functions/v1/discussion-media`, {
        method: "POST", headers: { authorization: `Bearer ${token}`, apikey: key,
          "content-type": asset.mime, "x-upload-id": asset.id }, body: bytes,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const error = new Error(typeof payload?.error === "string" ? payload.error : "L’envoi du média n’a pas pu être confirmé. Réessayez le même envoi.") as Error & { code?: string };
        if ([400, 409, 413, 415].includes(response.status)) error.code = "22023";
        else if ([401, 403].includes(response.status)) error.code = "42501";
        throw error;
      }
      const media = await response.json();
      if (media?.id !== asset.id) throw new Error("Le média reçu ne correspond pas à votre pièce jointe.");
      await assertAccount();
      return media.id;
    },
  };
}
