import { SafeAreaView } from "react-native-safe-area-context";
import { SafeAreaModal as Modal } from "./SafeAreaModal";
import { NewsActions } from "./NewsActions";
import { MediaActionShade } from "./MediaActionShade";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { readNewsFeed } from "../lib/newsFeed";
import type { NewsItem } from "../types/news";
import { Button, useUIStyles } from "./ui";
import { useLanguage, useTranslation } from "../lib/i18n";
import { useNewsTranslation } from "../lib/useNewsTranslation";
import { TranslationQuotaError } from "../lib/postTranslation";
import { NewsVisual } from "./NewsVisual";
import { PostSoundtrack } from "./PostCard";
import { getMusicForPublication } from "../data/shortMusicLibrary";

function NewsPublication({
  item,
  height,
  bottomInset,
  active,
}: {
  item: NewsItem;
  height: number;
  bottomInset: number;
  active: boolean;
}) {
  const s = useUIStyles();
  const t = useTranslation();
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [originalLanguage, setOriginalLanguage] = useState<string | null>(null);
  const translation = useNewsTranslation(item, active || expanded);
  const showOriginal = originalLanguage === language;
  const copy =
    !showOriginal && language !== "fr" && translation.data
      ? translation.data
      : item;
  const translationControls = language !== "fr" && (
    <View style={{ gap: 4 }}>
      {translation.isFetching ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: "#D1D5DB", fontSize: 12 }}
        >
          {t("translation.loading")}
        </Text>
      ) : translation.isError ? (
        <>
          <Text
            accessibilityRole="alert"
            style={{ color: "#D1D5DB", fontSize: 12 }}
          >
            {t(
              translation.error instanceof TranslationQuotaError
                ? "translation.quota"
                : "translation.unavailable",
            )}
          </Text>
          {!(translation.error instanceof TranslationQuotaError) && (
            <Pressable
              accessibilityRole="button"
              onPress={() => void translation.refetch()}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: "white", fontSize: 12 }}>
                {t("translation.retry")}
              </Text>
            </Pressable>
          )}
        </>
      ) : translation.data ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOriginalLanguage(showOriginal ? null : language)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: "#D1D5DB", fontSize: 12 }}>
            {t(showOriginal ? "translation.show" : "translation.original")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
  return (
    <View
      style={[
        { height, backgroundColor: "#07182E", overflow: "hidden" },
        Platform.OS === "web"
          ? ({ scrollSnapAlign: "start" } as ViewStyle)
          : undefined,
      ]}
    >
      <NewsVisual
        imageUrl={item.imageUrl}
        sourceName={item.sourceName}
        topic={item.topic}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        fallbackOverlay={false}
        contentFit="contain"
      />
      <MediaActionShade />
      <View style={{ position: "absolute", top: 16, left: 16, right: 16 }}>
        <Text
          style={{
            color: "white",
            fontSize: 15,
            fontWeight: "700",
            textShadowColor: "black",
            textShadowRadius: 4,
          }}
        >
          {item.sourceName || t("news.headline")}
        </Text>
      </View>
      <View
        style={{
          position: "absolute",
          bottom: bottomInset + 16,
          left: 16,
          right: 88,
          padding: 14,
          borderRadius: 16,
          backgroundColor: "rgba(0,0,0,0.56)",
          gap: 10,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("news.read")}
          onPress={() => setExpanded(true)}
          style={{ gap: 10 }}
        >
          <Text
            numberOfLines={3}
            style={{
              color: "white",
              fontSize: 22,
              lineHeight: 28,
              fontWeight: "700",
            }}
          >
            {copy.title}
          </Text>
          <Text style={{ color: "white", fontSize: 14 }}>{t("news.more")}</Text>
        </Pressable>
        {translationControls}
      </View>
      <View
        style={{
          position: "absolute",
          bottom: bottomInset + 72,
          right: 13,
          width: 52,
          zIndex: 9,
        }}
      >
        <NewsActions item={item} />
      </View>
      <View
        style={{
          position: "absolute",
          right: 13,
          bottom: bottomInset + 16,
          zIndex: 10,
        }}
      >
        <PostSoundtrack
          uri={getMusicForPublication(item.id).audioUrl}
          active={active}
          compact
          overlay
        />
      </View>
      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <SafeAreaView
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "rgba(0,0,0,0.7)",
          }}
        >
          <View style={[s.card, { maxHeight: "85%" }]}>
            <ScrollView>
              <Text style={s.small}>{item.sourceName}</Text>
              <Text style={s.h2}>{copy.title}</Text>
              <Text style={s.text}>{copy.description}</Text>
            </ScrollView>
            <Button
              title={t("common.close")}
              onPress={() => setExpanded(false)}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export function HomeNews({
  pageHeight,
  bottomInset,
  onCount,
  activeIndex,
}: {
  pageHeight: number;
  bottomInset: number;
  onCount: (count: number) => void;
  activeIndex: number;
}) {
  const s = useUIStyles();
  const t = useTranslation();
  const news = useQuery({
    queryKey: ["home-top-news"],
    staleTime: 300_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const data = await readNewsFeed({ topic: "top", limit: 5, signal });
      const seen = new Set<string>();
      return data.items
        .filter((item) => {
          const title = item.title.trim().toLocaleLowerCase();
          if (!title || seen.has(title)) return false;
          seen.add(title);
          return true;
        })
        .slice(0, 5);
    },
  });
  useEffect(() => {
    onCount(news.data?.length || 0);
  }, [news.data?.length, onCount]);
  if (news.isPending)
    return <Text style={[s.small, { padding: 16 }]}>{t("news.loading")}</Text>;
  if (news.isError)
    return (
      <View style={{ padding: 16 }}>
        <Text style={s.small}>{t("news.unavailable")}</Text>
        <Button
          title={t("common.retry")}
          secondary
          onPress={() => void news.refetch()}
        />
      </View>
    );
  if (!news.data?.length) return null;
  return (
    <View>
      {news.data.map((item, index) => (
        <NewsPublication
          key={item.id}
          item={item}
          height={pageHeight}
          bottomInset={bottomInset}
          active={index === activeIndex}
        />
      ))}
    </View>
  );
}
