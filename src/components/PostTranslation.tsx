import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLanguage, useTranslation } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { useTheme } from "../theme";

import { translationPair, TRANSLATION_LANGUAGES } from "../lib/postLanguage";
import { discussionTranslationLabel } from "../lib/discussionTranslationUi";
import { discussionUi } from "../lib/discussionUi";
import {
  translatePostText,
  translationRequestError,
  TranslationQuotaError,
} from "../lib/postTranslation";

export function PostTranslation({
  text,
  overlay = false,
  targetLanguage,
  sourceLanguage,
  autoDetectUnknown = false,
  communityUiLanguage,
}: {
  text?: string | null;
  overlay?: boolean;
  targetLanguage?: string;
  sourceLanguage?: string | null;
  autoDetectUnknown?: boolean;
  communityUiLanguage?: string;
}) {
  const { language: preferredLanguage } = useLanguage();
  const language = targetLanguage || preferredLanguage;
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [choosingSource, setChoosingSource] = useState(false);
  const { destination, source } = translationPair(text || "", language, selectedSource || sourceLanguage, autoDetectUnknown);
  const t = useTranslation(destination);
  const label = (action: "show" | "original" | "hide" | "loading" | "retry" | "unavailable" | "quota") =>
    discussionTranslationLabel(communityUiLanguage, action) || t(`translation.${action}`);
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(false); setSelectedSource(null); setChoosingSource(false); }, [text, language, sourceLanguage]);
  const translation = useQuery({
    queryKey: ["post-translation", text, language, source],
    enabled: visible && !choosingSource && !!source && source !== 'auto' && !!destination,
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
              target_lang: destination?.toUpperCase(),
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
      {!!(visible && !choosingSource && translation.data) && (
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
      {!!(visible && (source === 'auto' || choosingSource) && destination) && (
        <View>
          <Text style={{ color, fontSize: 12 }}>
            {discussionUi(communityUiLanguage || language, 'Langue du sujet (fr, en, sr-Latn…)')}
          </Text>
          <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
            {TRANSLATION_LANGUAGES.filter(code => code !== destination).map(code => {
              let name: string = code;
              try { name = new Intl.DisplayNames([code], { type: 'language' }).of(code) || code; } catch { /* ISO code remains usable. */ }
              return (
                <Pressable key={code} accessibilityRole="button" onPress={(event) => { event.stopPropagation(); setSelectedSource(code); setChoosingSource(false); }} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ color, fontSize: 12 }}>{name} ({code})</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
      {!!(visible && !choosingSource && (translation.isError || !destination)) && (
        <Text accessibilityRole="alert" style={{ color, fontSize: 12 }}>
          {quotaReached ? label("quota") : label("unavailable")}
        </Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        {!!(visible && autoDetectUnknown && destination && source !== 'auto' && !choosingSource) && (
          <Pressable accessibilityRole="button" onPress={(event) => { event.stopPropagation(); setChoosingSource(true); }} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ color: overlay ? "#FFFFFF" : colors.muted, fontSize: 11 }}>
              {discussionUi(communityUiLanguage || language, 'Langue du sujet (fr, en, sr-Latn…)')}
            </Text>
          </Pressable>
        )}
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
                ? `${label("loading")} · ${label("hide")}`
                : translation.data
                  ? label("original")
                  : label("hide")
              : label("show")}
          </Text>
        </Pressable>
        {!!(visible && !choosingSource && destination && translation.isError && !quotaReached) && (
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
              {label("retry")}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
