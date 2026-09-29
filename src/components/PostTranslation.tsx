import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLanguage, useTranslation } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useTheme } from "../theme";

import { translationSource } from "../lib/postLanguage";
import {
  translatePostText,
  translationRequestError,
  TranslationQuotaError,
} from "../lib/postTranslation";

export function PostTranslation({
  text,
  overlay = false,
}: {
  text?: string | null;
  overlay?: boolean;
}) {
  const { language } = useLanguage();
  const t = useTranslation();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const source = translationSource(text || "", language);
  useEffect(() => setVisible(false), [text, language]);
  const translation = useQuery({
    queryKey: ["post-translation", text, language, source],
    enabled: visible && !!source,
    staleTime: Infinity,
    retry: false,
    queryFn: ({ signal }) =>
      translatePostText(
        text || "",
        async (texts, requestSignal) => {
          const { data, error } = await supabase.functions.invoke("translate", {
            body: {
              texts,
              source_lang: source?.toUpperCase(),
              target_lang: language.toUpperCase(),
            },
            signal: requestSignal,
            timeout: 20000,
          });
          if (error) throw await translationRequestError(error);
          return data;
        },
        signal,
      ),
  });
  const quotaReached = translation.error instanceof TranslationQuotaError;
  if (!text?.trim() || !source) return null;
  const color = overlay ? "#FFFFFF" : colors.ink;
  return (
    <View
      style={{
        gap: 6,
        alignItems: "flex-start",
      }}
    >
      {!!(visible && translation.data) && (
        <ScrollView
          style={{
            maxHeight: 160,
            ...(overlay
              ? {
                  backgroundColor: "rgba(6,17,29,0.82)",
                  borderRadius: 10,
                  padding: 10,
                }
              : {}),
          }}
          nestedScrollEnabled
        >
          <Text selectable style={{ color, fontSize: 15, lineHeight: 22 }}>
            {translation.data}
          </Text>
        </ScrollView>
      )}
      {!!(visible && translation.isError) && (
        <Text accessibilityRole="alert" style={{ color, fontSize: 12 }}>
          {quotaReached ? t("translation.quota") : t("translation.unavailable")}
        </Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: visible }}
          onPress={(event) => {
            event.stopPropagation();
            setVisible((value) => !value);
          }}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text
            style={{
              color: overlay ? "rgba(255,255,255,0.78)" : colors.muted,
              fontSize: 11,
              fontWeight: "600",
              ...(overlay
                ? { textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 4 }
                : {}),
            }}
          >
            {visible
              ? translation.isFetching
                ? `${t("translation.loading")} · ${t("translation.hide")}`
                : translation.data
                  ? t("translation.original")
                  : t("translation.hide")
              : t("translation.show")}
          </Text>
        </Pressable>
        {!!(visible && translation.isError && !quotaReached) && (
          <Pressable
            accessibilityRole="button"
            disabled={translation.isFetching}
            onPress={(event) => {
              event.stopPropagation();
              void translation.refetch();
            }}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{
                color: overlay ? "#FFFFFF" : colors.muted,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {t("translation.retry")}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
