import { queryOptions } from "@tanstack/react-query";
import { translatedTexts } from "./postTranslation";

export type NewsCopy = { id: string; title: string; description: string };
type TranslateNews = (
  texts: string[],
  source: string,
  target: string,
  signal: AbortSignal,
) => Promise<unknown>;

// The news_cache feed is imported in French. Unlike short user captions, its
// source is known even when a headline contains mostly names.
export function newsTranslationOptions(
  item: NewsCopy,
  language: string,
  invoke: TranslateNews,
) {
  const target = language.toLowerCase();
  return queryOptions({
    queryKey: [
      "news-translation",
      item.id,
      item.title,
      item.description,
      "fr",
      target,
    ],
    enabled: target !== "fr",
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
    queryFn: async ({ signal }) => {
      const original = { title: item.title, description: item.description };
      if (target === "fr") return original;
      const fields = (["title", "description"] as const).filter((field) =>
        /\p{L}/u.test(original[field]),
      );
      if (!fields.length) return original;
      const result = await invoke(
        fields.map((field) => original[field]),
        "FR",
        target.toUpperCase(),
        signal,
      );
      if (signal.aborted) throw new Error("Translation cancelled");
      const translated = translatedTexts(result, fields.length);
      return Object.fromEntries(
        Object.entries(original).map(([field, value]) => {
          const index = fields.indexOf(field as (typeof fields)[number]);
          return [field, index < 0 ? value : translated[index]];
        }),
      ) as typeof original;
    },
  });
}
