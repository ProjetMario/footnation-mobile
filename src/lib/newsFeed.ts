import { requireBackend, supabase } from "./supabase";
import type { NewsListResponse, NewsTopic } from "../types/news";

export async function readNewsFeed({
  topic = "top",
  page = 1,
  limit = 20,
  query = "",
  signal,
}: {
  topic?: NewsTopic;
  page?: number;
  limit?: number;
  query?: string;
  signal?: AbortSignal;
}): Promise<NewsListResponse> {
  requireBackend();
  let request = supabase
    .from("news_cache")
    .select("id,title,description,source_name,published_at,url,image_url,topic")
    .eq("topic", topic)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  const search = query.trim().replace(/[\\%_]/g, "\\$&");
  if (search) request = request.ilike("title", `%${search}%`);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timeout = setTimeout(cancel, 15_000);
  const { data, error } = await (async () => {
    try {
      return await request.abortSignal(controller.signal);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }
  })();
  if (error) throw error;
  return {
    topic,
    query,
    lang: "fr",
    limit,
    page,
    totalArticles: null,
    fromCache: true,
    items: (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description || "",
      sourceName: row.source_name || "",
      publishedAt: row.published_at,
      url: row.url,
      imageUrl: row.image_url,
      topic: row.topic as NewsTopic,
    })),
  };
}
