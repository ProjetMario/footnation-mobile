import { PagedMediaViewer } from "./PagedMediaViewer";
import { LinearGradient } from "expo-linear-gradient";
import { MediaGrid } from "./MediaGrid";
import {
  Grid3X3,
  Image as ImageIcon,
  PlaySquare,
  Newspaper,
  X,
} from "lucide-react-native";
import { useTheme } from "../theme";
import {
  ClubButton as Button,
  useClubUIStyles as useUIStyles,
  ClubSectionHeading,
} from "./ClubDesign";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { NativeVideo } from "./Video";
import { Chip, Empty, ErrorState, Loading } from "./ui";
import { NewsCard, type News } from "./ClubNews";
import {
  clubPublicationPage,
  initialFeedCursor,
  type PublicationSource,
} from "../lib/clubPublicationFeed";

type Item = {
  source: PublicationSource;
  id: string;
  title: string | null;
  content?: string;
  description?: string | null;
  created_at: string;
  published_at?: string | null;
  is_pinned?: boolean | null;
  media_urls?: string[] | null;
  media_type?: string | null;
  video_url?: string;
  thumbnail_url?: string | null;
  views_count?: number | null;
};
type MediaMode =
  "all" | "publications" | "photos" | "videos" | "shorts" | "news";
type FeedItem = Item & Partial<News>;

export function ClubMedia({
  id,
  initialMode = "all",
  name = "Le club",
  fixedMode = false,
  hideHeading = false,
}: {
  id: string;
  initialMode?: MediaMode;
  name?: string;
  fixedMode?: boolean;
  hideHeading?: boolean;
}) {
  const s = useUIStyles();
  const { colors } = useTheme();
  const [opened, setOpened] = useState<string | null>(null);
  const [selected, setSelected] = useState<FeedItem | null>(null);

  const uid = useAuth().session?.user.id;
  const [mode, setMode] = useState<MediaMode>(initialMode);
  const [playing, setPlaying] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["club-public-media", id, uid, mode, "combined-feed-v1"],
    initialPageParam: initialFeedCursor<FeedItem>(),
    queryFn: ({ pageParam }) =>
      clubPublicationPage(
        pageParam,
        mode === "all" || mode === "videos"
          ? ["publications", "shorts", "news"]
          : mode === "shorts"
            ? ["shorts"]
            : mode === "news"
              ? ["news"]
              : mode === "photos"
                ? ["publications", "news"]
                : ["publications"],
        async (source, offset, limit) => {
          const columns =
            source === "publications"
              ? "id,title,content,created_at,published_at,is_pinned,media_urls,media_type"
              : source === "shorts"
                ? "id,title,description,created_at,video_url,thumbnail_url,views_count"
                : "id,title,excerpt,content,media_urls,media_type,likes_count,comments_count,is_pinned,source_type,source_team_id,created_at,comments:club_news_comments(count),likes:club_news_likes(count),author:profiles(full_name,username,avatar_url),source_team:teams(name)";
          let request = supabase
            .from(
              source === "publications"
                ? "club_publications"
                : source === "shorts"
                  ? "club_shorts"
                  : "club_news",
            )
            .select(columns)
            .eq("club_id", id)
            .eq("is_published", true);
          if (source !== "shorts")
            request = request.order("is_pinned", {
              ascending: false,
              nullsFirst: false,
            });
          if (mode === "photos")
            request = request.or(
              "media_type.in.(image,photo,photos,mixed),and(media_type.is.null,media_urls.not.is.null)",
            );
          if (mode === "videos" && source !== "shorts")
            request = request.in("media_type", ["video", "mixed"]);
          const result = await request
            .order("created_at", { ascending: false })
            .order("id")
            .range(offset, offset + limit - 1)
            .returns<Omit<FeedItem, "source">[]>();
          if (result.error) throw result.error;
          return (result.data || []).map((row) => ({ ...row, source }));
        },
      ),
    getNextPageParam: (last) => last.next,
  });
  const renderDetail = (item: FeedItem) =>
    item.source === "news" ? (
      <NewsCard
        key={`news:${item.id}`}
        item={item as News}
        clubId={id}
        clubName={name}
      />
    ) : (
      <View key={`${item.source}:${item.id}`} style={s.card}>
        {!!item.is_pinned && <Text style={s.small}>Épinglée par le club</Text>}
        {!!item.title && <Text style={s.h2}>{item.title}</Text>}
        <Text style={s.small}>
          {new Date(item.published_at || item.created_at).toLocaleDateString(
            "fr-FR",
          )}
        </Text>
        {!!(item.content || item.description) && (
          <Text style={s.text} selectable>
            {item.content || item.description}
          </Text>
        )}
        {(item.source === "shorts"
          ? [item.video_url!]
          : item.media_urls || []
        ).map((uri, index) => {
          const key = `${item.source}:${item.id}:${index}`;
          const video =
            item.source === "shorts" ||
            item.media_type === "video" ||
            /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(uri);
          return (
            <View key={key} style={{ gap: 8 }}>
              {video ? (
                <>
                  {playing === key ? (
                    <>
                      <NativeVideo
                        uri={uri}
                        active
                        muted={false}
                        style={{
                          width: "100%",
                          aspectRatio:
                            item.source === "shorts" ? 9 / 16 : 16 / 9,
                          borderRadius: 12,
                        }}
                      />
                      <Button
                        title="Fermer la vidéo"
                        secondary
                        onPress={() => setPlaying(null)}
                      />
                    </>
                  ) : (
                    <>
                      {!!item.thumbnail_url && (
                        <Image
                          source={{ uri: item.thumbnail_url }}
                          accessibilityLabel={
                            item.title || "Aperçu de la vidéo du club"
                          }
                          contentFit="cover"
                          style={{
                            width: "100%",
                            aspectRatio: 9 / 16,
                            borderRadius: 12,
                          }}
                        />
                      )}
                      <Button
                        title="Ouvrir la vidéo"
                        secondary
                        onPress={() => setPlaying(key)}
                      />
                    </>
                  )}
                </>
              ) : (
                <Image
                  source={{ uri }}
                  accessibilityLabel={`Photo ${index + 1} de la publication du club`}
                  contentFit="contain"
                  style={{
                    width: "100%",
                    aspectRatio: 1,
                    borderRadius: 12,
                  }}
                />
              )}
            </View>
          );
        })}
        {!!(item.source === "shorts" && item.views_count != null) && (
          <Text style={s.small}>{item.views_count} vues</Text>
        )}
      </View>
    );
  return (
    <>
      {!hideHeading && (
        <ClubSectionHeading
          title="Publications"
          refresh={() => void query.refetch()}
          busy={query.isFetching}
        />
      )}
      {!fixedMode && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0, height: 58, maxHeight: 58 }}
          contentContainerStyle={{ flexGrow: 1, alignItems: "center" }}
        >
          {(
            [
              ["all", "Tout", Grid3X3],
              ["photos", "Photos", ImageIcon],
              ["videos", "Shorts", PlaySquare],
              ["news", "Actualités", Newspaper],
            ] as const
          ).map(([key, label, Icon]) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: mode === key }}
              aria-selected={mode === key}
              onPress={() => {
                setPlaying(null);
                setMode(key);
              }}
              style={{
                flex: 1,
                minWidth: 64,
                minHeight: 56,
                gap: 3,
                alignItems: "center",
                justifyContent: "center",
                borderBottomWidth: 2,
                borderBottomColor: mode === key ? colors.ink : "transparent",
              }}
            >
              <Icon
                size={22}
                color={mode === key ? colors.ink : colors.muted}
              />
              <Text
                style={{
                  fontSize: 11,
                  color: mode === key ? colors.ink : colors.muted,
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {!!query.isPending && <Loading />}
      {!!query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
      <MediaGrid
        items={(query.data?.pages.flatMap((page) => page.items) || []).map(
          (item) => {
            const media =
              item.source === "shorts" ? item.video_url : item.media_urls?.[0];
            const video =
              item.source === "shorts" ||
              item.media_type === "video" ||
              !!media?.match(/\.(mp4|mov|webm|m4v)(?:[?#]|$)/i);
            return {
              id: `${item.source}:${item.id}`,
              title: item.title || item.content || item.description,
              image: video ? item.thumbnail_url : media,
              video: video ? media : null,
              pinned: !!item.is_pinned,
              multiple: (item.media_urls?.length || 0) > 1,
            };
          },
        )}
        onOpen={(tile) => {
          const item = query.data?.pages
            .flatMap((page) => page.items)
            .find((item) => `${item.source}:${item.id}` === tile.id);
          if (item) setOpened(`${item.source}:${item.id}`);
        }}
      />
      {!!opened && (
        <PagedMediaViewer
          items={query.data?.pages.flatMap((page) => page.items) || []}
          initialKey={opened}
          keyFor={(item) => `${item.source}:${item.id}`}
          onClose={() => setOpened(null)}
          onLoadMore={() => {
            if (query.hasNextPage && !query.isFetchingNextPage)
              void query.fetchNextPage();
          }}
          loadingMore={query.isFetchingNextPage}
          renderItem={(item, visible, height) => {
            const uri =
              item.source === "shorts" ? item.video_url : item.media_urls?.[0];
            const video =
              item.source === "shorts" ||
              item.media_type === "video" ||
              !!uri?.match(/\.(mp4|mov|webm|m4v)(?:[?#]|$)/i);
            return (
              <View style={{ height, backgroundColor: "#06111D" }}>
                {!!uri &&
                  (video ? (
                    <NativeVideo
                      uri={uri}
                      active={visible && !selected}
                      visible={visible && !selected}
                      posterUri={item.thumbnail_url}
                      controls={false}
                      contentFit="contain"
                      style={{ width: "100%", height: "100%", borderRadius: 0 }}
                    />
                  ) : (
                    <Image
                      source={{ uri }}
                      contentFit="contain"
                      style={{ width: "100%", height: "100%" }}
                    />
                  ))}
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(0,0,0,.7)", "transparent"]}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 120,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    right: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retour à la grille du club"
                    onPress={() => setOpened(null)}
                    style={{ padding: 12 }}
                  >
                    <X size={24} color="white" />
                  </Pressable>
                  <Text
                    style={{
                      color: "white",
                      fontSize: 17,
                      fontFamily: "Inter-SemiBold",
                      flex: 1,
                    }}
                  >
                    {name}
                  </Text>
                </View>
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,.9)"]}
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: 22,
                    paddingTop: 70,
                    paddingBottom: 40,
                    gap: 10,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      fontSize: 19,
                      fontFamily: "Inter-Bold",
                    }}
                  >
                    {item.title || "Publication du club"}
                  </Text>
                  <Text
                    numberOfLines={3}
                    style={{ color: "white", fontSize: 14, lineHeight: 21 }}
                  >
                    {item.content || item.description}
                  </Text>
                  <Button
                    title="Voir la publication"
                    onPress={() => {
                      setSelected(item);
                      setPlaying(`${item.source}:${item.id}:0`);
                    }}
                  />
                </LinearGradient>
              </View>
            );
          }}
        />
      )}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSelected(null);
          setPlaying(null);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.72)",
            justifyContent: "center",
            alignItems: "center",
            padding: 12,
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              width: "100%",
              maxWidth: 680,
              maxHeight: "95%",
              backgroundColor: colors.surface,
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingLeft: 18,
                paddingRight: 6,
              }}
            >
              <Text style={[s.h2, { flex: 1 }]}>{name}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer la publication"
                onPress={() => {
                  setSelected(null);
                  setPlaying(null);
                }}
                style={{
                  minHeight: 48,
                  width: 48,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={22} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12 }}>
              {selected ? renderDetail(selected) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {!!(
        query.data && !query.data.pages.some((page) => page.items.length)
      ) && (
        <Empty
          title={
            mode === "all"
              ? "Aucune publication disponible"
              : "Aucun contenu pour ce filtre"
          }
          description="Les contenus publiés par le club apparaîtront ici."
        />
      )}
      {!!query.hasNextPage && (
        <Button
          title="Charger les publications suivantes"
          busy={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        />
      )}
    </>
  );
}
