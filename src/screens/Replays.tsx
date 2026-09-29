import React, { useCallback, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { HighlightEditor, type Highlight } from "../components/HighlightEditor";
import { playbackTime } from "../lib/playbackTime";
import { FlatList, Image, Platform, Pressable, Text, View, Share, ScrollView, StyleSheet, useWindowDimensions, type ViewStyle } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { AuthGate } from "../components/AuthGate";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { NativeVideo } from "../components/Video";
import { supabase } from "../lib/supabase";

const footNationLogo = require("../../assets/brand/logo-gradient.png");

export default function Replays() {
  return (
    <Screen title="Lives FootNation" scroll={false}>
      <AuthGate>
        <ReplayList />
      </AuthGate>
    </Screen>
  );
}
function ReplayList() {
  const s = useUIStyles();
  const { height } = useWindowDimensions();
  const pageHeight = Math.max(560, height - 112);
  const webSnapPage =
    Platform.OS === "web"
      ? ({ scrollSnapAlign: "start", scrollSnapStop: "always" } as ViewStyle)
      : undefined;
  const webSnapList =
    Platform.OS === "web" ? ({ scrollSnapType: "y mandatory" } as ViewStyle) : undefined;

  const query = useInfiniteQuery({
    queryKey: ["native-replays"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .from("live_streams")
        .select(
          "id,title,home_team,away_team,started_at,expires_at,duration_seconds,status,ended_at,video_url,broadcaster:profiles!live_streams_broadcaster_id_fkey(id,full_name,username,avatar_url)",
        )
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("status", { ascending: false })
        .order("started_at", { ascending: false })
        .order("id")
        .range(pageParam, pageParam + 19);
      if (error) throw error;
      return (data || []).filter((row) => (row.status === "live" && !row.ended_at) || !!row.video_url);
    },
    getNextPageParam: (last, pages) =>
      last.length === 20 ? pages.length * 20 : undefined,
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const rows = query.data?.pages.flat() || [];
  const feedItems = [{ id: "create-live", kind: "create" as const }, ...rows.map((row) => ({ id: row.id, kind: "stream" as const, row }))];
  return (
    <FlatList
      data={feedItems}
      keyExtractor={(item) => item.id}
      pagingEnabled
      snapToInterval={pageHeight}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      style={[liveFeedStyles.feed, webSnapList]}
      contentContainerStyle={liveFeedStyles.feedContent}
      renderItem={({ item }) => {
        if (item.kind === "create") {
          return (
            <View style={[liveFeedStyles.page, { height: pageHeight }, webSnapPage]}>
              <View style={[liveFeedStyles.liveBackground, liveFeedStyles.createBackground]}>
                <View style={liveFeedStyles.liveShade} />
                <View style={liveFeedStyles.createHero}>
                  <Image source={footNationLogo} style={liveFeedStyles.createLogo} resizeMode="contain" />
                  <Text style={liveFeedStyles.liveTitle}>Lance ton live FootNation</Text>
                  <Text style={liveFeedStyles.liveSubtitle}>
                    Passe en plein écran, filme avec ton appareil et préviens ton réseau.
                  </Text>
                </View>
                <View style={liveFeedStyles.liveBottomPanel}>
                  <Pressable style={liveFeedStyles.liveButton} onPress={() => router.push("/live/create?mode=simple")}>
                    <Text style={liveFeedStyles.liveButtonText}>Faire un live plein écran</Text>
                  </Pressable>
                  {!rows.length && (
                    <Text style={liveFeedStyles.liveSubtitle}>Aucun live pour le moment. Sois le premier à lancer un direct.</Text>
                  )}
                </View>
              </View>
            </View>
          );
        }
        const row = item.row;
        const live = row.status === "live" && !row.ended_at;
        const broadcasterProfile = Array.isArray(row.broadcaster) ? row.broadcaster[0] : row.broadcaster;
        const broadcaster = broadcasterProfile?.full_name || broadcasterProfile?.username || "FootNation";
        const title = row.title || "Live FootNation";
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${live ? "Voir le direct" : "Voir le replay"} : ${title}`}
            onPress={() => router.push(live ? `/live/watch/${row.id}` : `/live/replay/${row.id}`)}
            style={[liveFeedStyles.page, { height: pageHeight }, webSnapPage]}
          >
            <View style={liveFeedStyles.liveBackground}>
              <View style={liveFeedStyles.liveCenterMark}>
                <Text style={liveFeedStyles.liveCenterIcon}>{live ? "🔴" : "▶️"}</Text>
                <Text style={liveFeedStyles.liveCenterText}>{live ? "En direct" : "Replay"}</Text>
              </View>
              <View style={liveFeedStyles.liveShade} />
              <View style={liveFeedStyles.liveTopRow}>
                <Avatar uri={broadcasterProfile?.avatar_url} name={broadcaster} size={54} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={liveFeedStyles.broadcasterName} numberOfLines={1}>{broadcaster}</Text>
                  <Text style={liveFeedStyles.liveMeta} numberOfLines={1}>
                    {live ? "🔴 En direct" : "Replay"}{row.started_at ? ` · ${new Date(row.started_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </Text>
                </View>
              </View>
              <View style={liveFeedStyles.liveBottomPanel}>
                <Text style={liveFeedStyles.liveTitle} numberOfLines={2}>{title}</Text>
                <Text style={liveFeedStyles.liveSubtitle} numberOfLines={2}>
                  {[row.home_team, row.away_team].filter(Boolean).join(" · ") || "Live simple"}
                </Text>
                <View style={liveFeedStyles.liveButton}>
                  <Text style={liveFeedStyles.liveButtonText}>{live ? "Voir le direct" : "Voir le replay"}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        );
      }}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={query.isFetchingNextPage ? <Loading /> : null}
    />
  );
}


const liveFeedStyles = StyleSheet.create({
  feed: { flex: 1, marginHorizontal: -18 },
  feedContent: { paddingBottom: 0 },
  emptyCard: { marginHorizontal: 18 },
  page: { paddingHorizontal: 18, paddingVertical: 14 },
  liveBackground: { flex: 1, overflow: "hidden", borderRadius: 30, backgroundColor: "#050814" },
  createBackground: { backgroundColor: "#08111F" },
  liveShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.28)" },
  liveCenterMark: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 8 },
  liveCenterIcon: { fontSize: 64 },
  liveCenterText: { color: "rgba(255,255,255,0.82)", fontSize: 20, fontWeight: "900" },
  createHero: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
  createLogo: { width: 270, height: 82, marginBottom: 12 },
  liveTopRow: { position: "absolute", top: 18, left: 18, right: 18, flexDirection: "row", alignItems: "center", gap: 12, padding: 8, paddingRight: 14, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.38)" },
  broadcasterName: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  liveMeta: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "800" },
  liveBottomPanel: { position: "absolute", left: 18, right: 18, bottom: 18, gap: 10, padding: 18, borderRadius: 26, backgroundColor: "rgba(0,0,0,0.48)" },
  liveTitle: { color: "#FFFFFF", fontSize: 30, lineHeight: 36, fontWeight: "900" },
  liveSubtitle: { color: "rgba(255,255,255,0.82)", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  liveButton: { minHeight: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: "#0967FF", marginTop: 4 },
  secondaryLiveButton: { backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  liveButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
});

export function ReplayDetail() {
  const { streamId, t } = useLocalSearchParams<{
    streamId: string;
    t?: string;
  }>();
  const scroll = useRef<ScrollView>(null);
  return (
    <Screen title="Replay" scrollRef={scroll}>
      <AuthGate>
        <Replay
          key={`${streamId}:${t || ""}`}
          id={streamId}
          start={playbackTime(t)}
          onSeek={() => scroll.current?.scrollTo({ y: 0, animated: true })}
        />
      </AuthGate>
    </Screen>
  );
}
function Replay({
  id,
  start,
  onSeek,
}: {
  id: string;
  start: number | null;
  onSeek: () => void;
}) {
  const s = useUIStyles();

  const uid = useAuth().session!.user.id;
  const [editor, setEditor] = useState<Highlight | "new" | null>(null);
  const progress = useRef({ seconds: start || 0, duration: 0 });
  const onProgress = useCallback((seconds: number, duration: number) => {
    if (Number.isFinite(seconds) && seconds >= 0)
      progress.current = { seconds, duration };
  }, []);
  const [seek, setSeek] = useState<
    { seconds: number; play: boolean; request: number } | undefined
  >(start === null ? undefined : { seconds: start, play: false, request: 0 });
  const query = useQuery({
    queryKey: ["native-replay", id],
    queryFn: async () => {
      const stream = await supabase
        .from("live_streams")
        .select("*,broadcaster:profiles!live_streams_broadcaster_id_fkey(id,full_name,username,avatar_url)")
        .eq("id", id)
        .single();
      if (stream.error) throw stream.error;
      const highlights = await supabase
        .from("video_highlights")
        .select(
          "id,created_by,title,description,player_name,timestamp_seconds,highlight_type,team",
        )
        .eq("stream_id", id)
        .order("timestamp_seconds");
      if (highlights.error) throw highlights.error;
      return { stream: stream.data, highlights: highlights.data };
    },
  });
  const share = useMutation({
    mutationFn: async (time?: number) => {
      const suffix =
        time !== undefined && playbackTime(time) !== null
          ? `?t=${playbackTime(time)}`
          : "";
      await Share.share({
        message: `${query.data?.stream.title || "Replay FootNation"} https://www.foot-nation.com/live/replay/${id}${suffix}`,
      });
    },
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const { stream, highlights } = query.data;
  const expiry = stream.expires_at ? Date.parse(stream.expires_at) : Infinity;
  if (
    !stream.video_url ||
    (!Number.isFinite(expiry) && expiry !== Infinity) ||
    expiry < Date.now()
  )
    return <Empty title="Ce replay n’est plus disponible" />;
  return (
    <>
      <Text style={s.title}>{stream.title}</Text>
      <NativeVideo uri={stream.video_url} seek={seek} onProgress={onProgress} />
      <View style={s.row}>
        <Avatar
          uri={stream.broadcaster?.avatar_url}
          name={stream.broadcaster?.full_name}
        />
        <Text style={s.text}>
          {stream.broadcaster?.full_name || stream.broadcaster?.username}
        </Text>
      </View>
      <Button
        title="Partager le replay"
        secondary
        busy={share.isPending}
        onPress={() => share.mutate(undefined)}
      />
      {!!share.error && <ErrorState error={share.error} />}
      <Text style={s.h2}>Temps forts</Text>
      <Button
        title="Ajouter un temps fort"
        disabled={editor !== null}
        onPress={() => setEditor("new")}
      />
      <Button
        title="Actualiser les temps forts"
        secondary
        disabled={editor !== null}
        busy={query.isRefetching}
        onPress={() => void query.refetch()}
      />
      {editor === "new" && (
        <HighlightEditor
          streamId={id}
          time={progress.current.seconds}
          duration={progress.current.duration || stream.duration_seconds}
          onClose={() => setEditor(null)}
        />
      )}
      {!highlights.length && <Empty title="Aucun temps fort enregistré" />}
      {highlights.map((highlight) => (
        <View key={highlight.id} style={s.card}>
          {!!(
            editor !== null &&
            editor !== "new" &&
            editor.id === highlight.id
          ) && (
            <HighlightEditor
              streamId={id}
              highlight={editor as Highlight}
              time={highlight.timestamp_seconds}
              duration={progress.current.duration || stream.duration_seconds}
              onClose={() => setEditor(null)}
            />
          )}
          <Text style={s.h2}>
            {highlight.title ||
              (
                {
                  goal: "But",
                  save: "Arrêt",
                  action: "Action",
                  card: "Carton",
                  other: "Temps fort",
                } as Record<string, string>
              )[highlight.highlight_type]}
          </Text>
          <Text style={s.subtitle}>
            {Math.floor(highlight.timestamp_seconds / 60)}:
            {String(highlight.timestamp_seconds % 60).padStart(2, "0")} ·{" "}
            {highlight.player_name}
          </Text>
          {playbackTime(highlight.timestamp_seconds) !== null && (
            <Button
              secondary
              title="Lire ce temps fort"
              onPress={() => {
                setSeek((previous) => ({
                  seconds: playbackTime(highlight.timestamp_seconds)!,
                  play: true,
                  request: (previous?.request || 0) + 1,
                }));
                onSeek();
              }}
            />
          )}
          {playbackTime(highlight.timestamp_seconds) !== null && (
            <Button
              secondary
              title="Partager ce temps fort"
              busy={share.isPending}
              onPress={() =>
                share.mutate(playbackTime(highlight.timestamp_seconds)!)
              }
            />
          )}
          {!!highlight.description && (
            <Text style={s.text}>{highlight.description}</Text>
          )}
          {highlight.created_by === uid && (
            <Button
              title="Modifier mon temps fort"
              secondary
              disabled={editor !== null}
              onPress={() => setEditor(highlight as Highlight)}
            />
          )}
        </View>
      ))}
    </>
  );
}
