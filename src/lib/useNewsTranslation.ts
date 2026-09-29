import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "./i18n";
import { newsTranslationOptions, type NewsCopy } from "./newsTranslation";
import { translationRequestError } from "./postTranslation";
import { supabase } from "./supabase";

export function useNewsTranslation(item: NewsCopy, active: boolean) {
  const { language, ready } = useLanguage();
  const options = newsTranslationOptions(
    item,
    language,
    async (texts, source, target, signal) => {
      const { data, error } = await supabase.functions.invoke("translate", {
        body: { texts, source_lang: source, target_lang: target },
        signal,
        timeout: 20000,
      });
      if (error) throw await translationRequestError(error);
      return data;
    },
  );
  return useQuery({ ...options, enabled: options.enabled && ready && active });
}
