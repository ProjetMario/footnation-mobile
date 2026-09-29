import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Empty,
  ErrorState,
  Loading,
  Screen,
  useUIStyles,
} from "../components/ui";
import { ClubDesignProvider } from "../components/ClubDesign";
import { ClubLiveScore } from "../components/ClubLiveSection";
import { ClubMatchComments } from "../components/ClubMatchComments";
import { NativeVideo } from "../components/Video";
import { useConnectivity } from "../components/ConnectivityProvider";
import { useAuth } from "../lib/auth";
import { loadManagedClubs } from "../lib/managedClubs";
import { supabase } from "../lib/supabase";
import {
  useClubLiveMatch,
  useClubLiveStream,
  useLiveStreams,
} from "../lib/useClubLive";
import { liveStreamPath, streamVideoUrl } from "../lib/clubLive";
import { livePersonName, useLiveInteractions, type LivePerson } from "../lib/useLiveInteractions";
import { PostShareSheet } from "../components/PostShareSheet";
import { FollowAuthor } from "../components/FollowAuthor";
import { Heart, MessageCircle, Radio, Send, Users, Video, X } from "lucide-react-native";


type LiveCreateMode = "match" | "simple";

type ManagedClubRow = Awaited<ReturnType<typeof loadManagedClubs>>[number];

type SelectableMatch = {
  id: string;
  opponent_name: string | null;
  match_date: string | null;
  status: string | null;
  competition: string | null;
};

export function ClubLiveCreate() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const selectedMode: LiveCreateMode | null =
    mode === "match" || mode === "simple" ? mode : null;
  if (selectedMode === "simple") return <SimpleLiveStudio />;
  if (selectedMode === "match") return <ClubLiveSetup mode={selectedMode} />;
  return <ClubLiveCreateChoice />;
}

function ClubLiveCreateChoice() {
  const s = useUIStyles();
  const actions = [
    {
      title: "Faire un direct d’un match",
      subtitle: "Choisis ton club puis associe le direct à un match.",
      icon: Video,
      path: "/live/create?mode=match",
    },
    {
      title: "Faire un live simple",
      subtitle: "Lance un direct libre sans le rattacher à un match.",
      icon: Radio,
      path: "/live/create?mode=simple",
    },
    {
      title: "Voir les lives en cours",
      subtitle: "Regarde les directs et replays déjà disponibles sur FootNation.",
      icon: Radio,
      path: "/live",
    },
  ] as const;
  return (
    <Screen title="Diffuser un match">
      <Text style={s.subtitle}>
        Sélectionne ce que tu veux faire. Tu pourras choisir ton club avant de continuer.
      </Text>
      <View style={{ gap: 14 }}>
        {actions.map(({ title, subtitle, icon: Icon, path }) => (
          <Pressable
            key={title}
            accessibilityRole="button"
            accessibilityLabel={title}
            onPress={() => router.push(path)}
            style={({ pressed }) => [
              s.card,
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                opacity: pressed ? 0.72 : 1,
              },
            ]}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#EEF4FF",
              }}
            >
              <Icon size={25} color="#0967FF" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.h2}>{title}</Text>
              <Text style={s.small}>{subtitle}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <Button
        title="Créer ou revendiquer un club"
        secondary
        onPress={() => router.push("/club-claim")}
      />
    </Screen>
  );
}


type LiveStreamInsert = {
  match_id: string;
  club_id: string | null;
  broadcaster_id: string;
  title: string;
  status: "live";
  started_at: string;
  home_team?: string | null;
  away_team?: string | null;
};

type LiveStudioConfig = {
  mode: LiveCreateMode;
  title: string;
  clubId: string | null;
  matchId: string;
  eyebrow: string;
  subtitle: string;
  badge: string;
};

function profileDisplayName(profile: ReturnType<typeof useAuth>["profile"]) {
  return profile?.full_name || profile?.username || "FootNation";
}

async function networkRecipients(profileId: string) {
  const [followers, outgoing, incoming] = await Promise.all([
    supabase
      .from("profile_followers")
      .select("follower_id")
      .eq("followed_id", profileId),
    supabase
      .from("connections")
      .select("connected_user_id")
      .eq("user_id", profileId)
      .eq("status", "accepted"),
    supabase
      .from("connections")
      .select("user_id")
      .eq("connected_user_id", profileId)
      .eq("status", "accepted"),
  ]);
  const ids = new Set<string>();
  for (const row of followers.data || [])
    if (row.follower_id !== profileId) ids.add(row.follower_id);
  for (const row of outgoing.data || [])
    if (row.connected_user_id !== profileId) ids.add(row.connected_user_id);
  for (const row of incoming.data || [])
    if (row.user_id !== profileId) ids.add(row.user_id);
  return [...ids];
}

async function notifyLiveNetwork({
  streamId,
  profileId,
  displayName,
  kind,
}: {
  streamId: string;
  profileId: string;
  displayName: string;
  kind: "simple_live" | "match_live";
}) {
  const recipients = await networkRecipients(profileId);
  if (!recipients.length) return 0;
  const rows = recipients.map((receiverId) => ({
    sender_id: profileId,
    receiver_id: receiverId,
    type: "live_started",
    content: `${displayName} est en live sur FootNation`,
    link: liveStreamPath(streamId),
    metadata: { stream_id: streamId, kind },
  }));
  const result = await supabase.from("notifications").insert(rows);
  if (result.error) throw result.error;
  return rows.length;
}

function SimpleLiveStudio() {
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const name = profileDisplayName(profile);
  return (
    <LiveStudioFullscreen
      config={{
        mode: "simple",
        title: "",
        clubId: null,
        matchId: `simple:${uid || "guest"}:${Date.now()}`,
        eyebrow: "Live",
        subtitle: "Filme avec ton appareil et préviens ton réseau.",
        badge: "LIVE",
      }}
      displayName={name}
      avatarUrl={profile?.avatar_url}
      profileId={uid}
    />
  );
}

function LiveStudioFullscreen({
  config,
  displayName,
  avatarUrl,
  profileId,
}: {
  config: LiveStudioConfig;
  displayName: string;
  avatarUrl?: string | null;
  profileId?: string | null;
}) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const videoRef = useRef<any>(null);
  const mediaRef = useRef<any>(null);
  const [title, setTitle] = useState(config.title);
  const [cameraReady, setCameraReady] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [titleMissing, setTitleMissing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [viewerCount, setViewerCount] = useState(1);
  const [chatText, setChatText] = useState("");
  const [comments, setComments] = useState<string[]>([
    "👋 FootNation a rejoint",
    `${displayName} prépare le live`,
  ]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const interactions = useLiveInteractions(liveId);

  useEffect(() => {
    return () => {
      const tracks = mediaRef.current?.getTracks?.() || [];
      tracks.forEach((track: any) => track.stop?.());
    };
  }, []);

  useEffect(() => {
    if (!liveId) return;
    const id = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [liveId]);

  useEffect(() => {
    setComments((value) => {
      const next = [...value];
      const preparingIndex = next.findIndex((comment) => comment.endsWith("prépare le live"));
      if (preparingIndex >= 0) next[preparingIndex] = `${displayName} prépare le live`;
      return next;
    });
  }, [displayName]);

  useEffect(() => {
    if (!liveId) return;
    setViewerCount((value) => Math.max(value, 3));
    setComments((value) => [
      "👋 Ton réseau a été prévenu",
      "FootNation a rejoint",
      ...value,
    ].slice(0, 5));
  }, [liveId]);

  const sendComment = () => {
    const message = chatText.trim();
    if (!message) return;
    setComments((value) => [`Moi : ${message}`, ...value].slice(0, 5));
    setChatText("");
  };

  const attachStream = async (stream: any) => {
    mediaRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play?.();
    }
    setCameraReady(true);
  };

  const startCamera = async () => {
    setNotice(null);
    if (Platform.OS !== "web") {
      setCameraReady(true);
      return;
    }
    const devices = (globalThis.navigator as any)?.mediaDevices;
    if (!devices?.getUserMedia) {
      setNotice("La caméra n’est pas disponible dans ce navigateur.");
      return;
    }
    setStartingCamera(true);
    try {
      await attachStream(await devices.getUserMedia({ video: true, audio: true }));
    } catch {
      setNotice("Autorise l’accès à la caméra et au micro pour lancer le live.");
    } finally {
      setStartingCamera(false);
    }
  };

  const stopCamera = () => {
    const tracks = mediaRef.current?.getTracks?.() || [];
    tracks.forEach((track: any) => track.stop?.());
    mediaRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  };

  const startLive = async () => {
    if (!uid) {
      setNotice("Connecte-toi pour lancer un live.");
      return;
    }
    if (!cameraReady) {
      await startCamera();
      return;
    }
    if (!title.trim()) {
      setTitleMissing(true);
      setNotice(null);
      return;
    }
    setPublishing(true);
    setNotice(null);
    try {
      const now = new Date().toISOString();
      const payload: LiveStreamInsert = {
        match_id: config.matchId,
        club_id: config.clubId,
        broadcaster_id: uid,
        title: title.trim() || config.title,
        status: "live",
        started_at: now,
        home_team: config.mode === "match" ? config.eyebrow : displayName,
        away_team: config.mode === "match" ? config.subtitle : null,
      };
      const created = await supabase
        .from("live_streams")
        .insert(payload as never)
        .select("id")
        .single<{ id: string }>();
      if (created.error) throw created.error;
      setLiveId(created.data.id);
      setElapsed(0);
      await notifyLiveNetwork({
        streamId: created.data.id,
        profileId: uid,
        displayName,
        kind: config.mode === "match" ? "match_live" : "simple_live",
      });
      setNotice("Live lancé · ton réseau a été prévenu.");
    } catch {
      setNotice("Le live n’a pas pu être créé. Réessaie dans un instant.");
    } finally {
      setPublishing(false);
    }
  };

  const endLive = async () => {
    if (!liveId) {
      stopCamera();
      router.back();
      return;
    }
    setPublishing(true);
    try {
      const result = await supabase
        .from("live_streams")
        .update({ status: "ended", ended_at: new Date().toISOString() } as never)
        .eq("id", liveId);
      if (result.error) throw result.error;
      stopCamera();
      router.replace("/live");
    } catch {
      setNotice("Impossible d’arrêter le live pour le moment.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <SafeAreaView style={liveStyles.fullscreen}>
      <View style={StyleSheet.absoluteFill}>
        <CameraSurface videoRef={videoRef} active={cameraReady} />
        <View style={liveStyles.dimOverlay} />
      </View>
      <View style={liveStyles.topBar}>
        <View style={liveStyles.creatorRow}>
          <Avatar uri={avatarUrl} name={displayName} size={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={liveStyles.creatorName} numberOfLines={1}>{displayName}</Text>
            <Text style={liveStyles.creatorMeta} numberOfLines={1}>{config.subtitle}</Text>
          </View>
          {!liveId && profileId ? (
            <FollowAuthor id={profileId} name={displayName} variant="button" />
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={endLive} style={liveStyles.closeButton}>
          <X size={30} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={liveStyles.missionRow}>
        <View style={liveStyles.softPill}><Text style={liveStyles.softPillText}>⚽ {config.eyebrow}</Text></View>
        <View style={liveStyles.softPillMuted}><Text style={liveStyles.softPillText}>{liveId ? formatElapsed(elapsed) : "Prêt"}</Text></View>
        <View style={liveStyles.softPillMuted}><Text style={liveStyles.softPillText}>👥 {liveId ? Math.max(interactions.viewers, viewerCount) : viewerCount}</Text></View>
        <View style={liveStyles.softPillMuted}><Text style={liveStyles.softPillText}>❤️ {liveId ? interactions.likes : likeCount}</Text></View>
      </View>

      <View style={liveStyles.viewerSideActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voir les connectés" style={liveStyles.sideCircle} onPress={() => setPeopleOpen((value) => !value)}><Users size={24} color="#FFFFFF" /></Pressable>
        <View style={liveStyles.sideLabelPill}><Text style={liveStyles.sideLabelText}>{liveId ? Math.max(interactions.viewers, viewerCount) : viewerCount}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Aimer le live" style={liveStyles.sideCircle} onPress={() => liveId ? interactions.toggleLike() : setLikeCount((value) => value + 1)}><Heart size={24} color="#FFFFFF" fill={(liveId ? interactions.liked : likeCount > 0) ? "#FF2D55" : "transparent"} /></Pressable>
        <View style={liveStyles.sideLabelPill}><Text style={liveStyles.sideLabelText}>{liveId ? interactions.likes : likeCount}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Voir les commentaires" style={liveStyles.sideCircle}><MessageCircle size={24} color="#FFFFFF" /></Pressable>
      </View>

      <View style={liveStyles.bottomPanel}>
        <View style={liveStyles.statusLine}>
          <View style={[liveStyles.liveBadge, !!liveId && liveStyles.liveBadgeOn]}><Text style={liveStyles.liveBadgeText}>{liveId ? "LIVE" : config.badge}</Text></View>
          <Text style={liveStyles.viewerText}>{liveId ? "Ton live est en cours" : "Prépare ton direct"}</Text>
        </View>
        <View style={[liveStyles.titleCard, titleMissing && liveStyles.titleCardAlert]}>
          <Text style={liveStyles.inputLabel}>Donne un titre à ton live</Text>
          <TextInput
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              if (value.trim()) setTitleMissing(false);
            }}
            placeholder="Ex : FC New York vs FC Londres"
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={liveStyles.titleInput}
            maxLength={80}
            editable={!liveId}
          />
          {!title.trim() && !liveId ? (
            <Text style={liveStyles.titleHelp}>Les spectateurs verront ce titre dans l’onglet Live.</Text>
          ) : null}
        </View>
        {titleMissing ? (
          <View style={liveStyles.titleAlert}>
            <Text style={liveStyles.titleAlertText}>Ajoute un titre avant de lancer ton live.</Text>
            <Text style={liveStyles.titleAlertSubtext}>Exemple : FC New York vs FC Londres.</Text>
          </View>
        ) : null}
        {!!notice && <Text style={liveStyles.notice}>{notice}</Text>}
        <LiveCommentFeed comments={liveId ? ["👋 Ton réseau est connecté", ...interactions.commentLines] : comments} />
        <LiveMessageComposer
          value={chatText}
          onChangeText={setChatText}
          onSend={() => {
            if (liveId) {
              interactions.sendComment(chatText);
              setChatText("");
            } else sendComment();
          }}
          placeholder="Écrire un commentaire..."
        />
        <View style={liveStyles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cameraReady ? liveId ? "Voir le live" : "Lancer le live" : "Activer la caméra"}
            disabled={startingCamera || publishing}
            onPress={liveId ? () => router.push(liveStreamPath(liveId)) : cameraReady ? startLive : startCamera}
            style={({ pressed }) => [
              liveStyles.primaryLiveButton,
              cameraReady && !liveId && !title.trim() ? liveStyles.primaryLiveButtonDisabled : null,
              { opacity: pressed || startingCamera || publishing ? 0.72 : 1 },
            ]}
          >
            <Text style={liveStyles.primaryLiveText}>{liveId ? "Voir le live" : cameraReady ? "Lancer le live" : "Activer la caméra"}</Text>
          </Pressable>
          {cameraReady && !liveId && (
            <Pressable accessibilityRole="button" accessibilityLabel="Couper la caméra" onPress={stopCamera} style={liveStyles.roundAction}>
              <Text style={liveStyles.roundActionText}>Off</Text>
            </Pressable>
          )}
          {!!liveId && (
            <Pressable accessibilityRole="button" accessibilityLabel="Arrêter le live" onPress={endLive} style={liveStyles.endButton}>
              <Text style={liveStyles.endButtonText}>Stop</Text>
            </Pressable>
          )}
        </View>
      </View>
      {peopleOpen && (
        <LiveActivityPanel
          viewers={liveId ? Math.max(interactions.viewers, viewerCount) : viewerCount}
          likes={liveId ? interactions.likes : likeCount}
          comments={liveId ? interactions.commentLines.length : comments.length}
          viewerPeople={interactions.viewerPeople}
          likePeople={interactions.likePeople}
        />
      )}
    </SafeAreaView>
  );
}

function CameraSurface({ videoRef, active }: { videoRef: React.RefObject<any>; active: boolean }) {
  return (
    <View style={liveStyles.videoFill}>
      {Platform.OS === "web"
        ? React.createElement("video", {
            ref: videoRef,
            autoPlay: true,
            muted: true,
            playsInline: true,
            style: {
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: active ? "block" : "none",
              background: "#050814",
            },
          })
        : null}
      {!active && (
        <View style={liveStyles.cameraPlaceholder}>
          <Radio size={56} color="#FFFFFF" />
          <Text style={liveStyles.placeholderTitle}>Caméra FootNation</Text>
          <Text style={liveStyles.placeholderText}>Active ta caméra pour passer en plein écran.</Text>
        </View>
      )}
    </View>
  );
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function ClubLiveSetup({ mode }: { mode: LiveCreateMode }) {
  const s = useUIStyles();
  const uid = useAuth().session?.user.id;
  const [clubId, setClubId] = useState("");
  const [matchId, setMatchId] = useState("");
  const clubs = useQuery({
    queryKey: ["live-create-managed-clubs", uid],
    enabled: !!uid,
    queryFn: () => loadManagedClubs(uid!, 0),
  });
  const matches = useQuery({
    queryKey: ["live-create-matches", clubId],
    enabled: !!clubId && mode === "match",
    queryFn: async () => {
      const result = await supabase
        .from("club_matches")
        .select("id,opponent_name,match_date,status,competition")
        .eq("club_id", clubId)
        .or("status.eq.scheduled,status.eq.live,status.is.null")
        .order("match_date", { ascending: true })
        .order("id")
        .limit(20);
      if (result.error) throw result.error;
      return (result.data || []) as SelectableMatch[];
    },
  });
  const selectedClub = clubs.data?.find((row) => row.club_id === clubId);
  const selectedMatch = matches.data?.find((row) => row.id === matchId);
  const [studio, setStudio] = useState<LiveStudioConfig | null>(null);
  const profile = useAuth().profile;
  const displayName = profileDisplayName(profile);
  if (studio) {
    return (
      <LiveStudioFullscreen
        config={studio}
        displayName={displayName}
        avatarUrl={profile?.avatar_url}
        profileId={profile?.id}
      />
    );
  }
  const canContinue = !!selectedClub;
  const startSelectedLive = () => {
    if (!selectedClub) return;
    const clubName = selectedClub.club?.short_name || selectedClub.club?.name || "Club";
    const matchName = selectedMatch?.opponent_name || "Match FootNation";
    setStudio({
      mode: "match",
      title: selectedMatch ? `${clubName} - ${matchName}` : `${clubName} en direct`,
      clubId: selectedClub.club_id,
      matchId: selectedMatch?.id || `club:${selectedClub.club_id}:${Date.now()}`,
      eyebrow: clubName,
      subtitle: selectedMatch ? matchName : "Live match sans rencontre associée",
      badge: "MATCH LIVE",
    });
  };
  return (
    <Screen
      title={
        mode === "match" ? "Direct d’un match" : "Live simple"
      }
    >
      <Text style={s.subtitle}>
        {mode === "match"
          ? "Choisis le club, puis un match si tu veux rattacher le direct à une rencontre précise."
          : "Choisis le club qui diffuse ce live. Aucun match n’est obligatoire."}
      </Text>
      {clubs.isPending ? (
        <Loading />
      ) : clubs.error ? (
        <ErrorState error={clubs.error} retry={() => void clubs.refetch()} />
      ) : !clubs.data?.length ? (
        <Empty
          title="Aucun club administré"
          description="Tu dois administrer un club pour lancer un direct."
          action={
            <Button
              title="Créer ou revendiquer un club"
              onPress={() => router.push("/club-claim")}
            />
          }
        />
      ) : (
        <>
          <Text style={s.h2}>Choisir un club</Text>
          <View style={{ gap: 10 }}>
            {clubs.data.map((row: ManagedClubRow) => (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                accessibilityState={{ selected: clubId === row.club_id }}
                onPress={() => {
                  setClubId(row.club_id || "");
                  setMatchId("");
                }}
                style={({ pressed }) => [
                  s.card,
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderWidth: 2,
                    borderColor: clubId === row.club_id ? "#0967FF" : "transparent",
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Avatar uri={row.club?.logo_url} name={row.club?.name || "Club"} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.h2}>{row.club?.short_name || row.club?.name || "Club"}</Text>
                  {!!row.club?.city && <Text style={s.small}>{row.club.city}</Text>}
                </View>
              </Pressable>
            ))}
          </View>
          {mode === "match" && !!clubId && (
            <View style={{ gap: 10 }}>
              <Text style={s.h2}>Match associé facultatif</Text>
              {matches.isPending ? (
                <Loading />
              ) : matches.error ? (
                <ErrorState error={matches.error} retry={() => void matches.refetch()} />
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: !matchId }}
                    onPress={() => setMatchId("")}
                    style={[s.card, { borderWidth: 2, borderColor: !matchId ? "#0967FF" : "transparent" }]}
                  >
                    <Text style={s.h2}>Aucun match précis</Text>
                    <Text style={s.small}>Le direct sera préparé sans rencontre associée.</Text>
                  </Pressable>
                  {matches.data?.map((match) => (
                    <Pressable
                      key={match.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: matchId === match.id }}
                      onPress={() => setMatchId(match.id)}
                      style={[s.card, { borderWidth: 2, borderColor: matchId === match.id ? "#0967FF" : "transparent" }]}
                    >
                      <Text style={s.h2}>{match.opponent_name || "Adversaire à confirmer"}</Text>
                      <Text style={s.small}>
                        {[match.competition, match.status, match.match_date ? new Date(match.match_date).toLocaleString("fr-FR") : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </Pressable>
                  ))}
                </>
              )}
            </View>
          )}
          <Button
            title="Ouvrir la caméra plein écran"
            disabled={!canContinue}
            onPress={startSelectedLive}
          />
          <Button
            title="Retour aux choix"
            secondary
            onPress={() => router.replace("/live/create")}
          />
        </>
      )}
    </Screen>
  );
}

export function ClubLiveMatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useClubLiveMatch(id);
  const s = useUIStyles();
  const { isOffline } = useConnectivity();
  return (
    <Screen title="Match en direct">
      {isOffline && (
        <Text style={s.small}>Hors connexion · dernier score connu.</Text>
      )}
      {query.isPending && !isOffline && <Loading />}
      {query.isError && (
        <ErrorState
          error={new Error("Le score n’a pas pu être actualisé.")}
          retry={() => void query.refetch()}
        />
      )}
      {query.isSuccess && !query.data && (
        <Empty
          title="Match introuvable"
          description="Cette rencontre n’est plus disponible."
        />
      )}
      {!!query.data && (
        <ClubDesignProvider club={query.data.club || {}}>
          <View style={[s.card, { borderRadius: 20 }]}>
            <ClubLiveScore
              match={query.data}
              stale={isOffline || query.isError}
            />
          </View>
          <Text style={s.small}>
            Score renseigné par le club · actualisation automatique toutes les
            30 secondes.
          </Text>
          <Button
            title="Actualiser le score"
            secondary
            busy={query.isFetching}
            onPress={() => void query.refetch()}
          />
          <MatchBroadcastLinks clubId={query.data.club_id} matchId={id} />
          <Button
            title="Voir le club"
            secondary
            onPress={() => router.push(`/club/${query.data!.club_id}`)}
          />
          <ClubMatchComments matchId={id} />
        </ClubDesignProvider>
      )}
    </Screen>
  );
}

function MatchBroadcastLinks({
  clubId,
  matchId,
}: {
  clubId: string;
  matchId: string;
}) {
  const query = useLiveStreams(clubId);
  return (
    <>
      {query.data?.pages
        .flat()
        .filter((stream) => stream.match_id === matchId)
        .map((stream) => (
          <Button
            key={stream.id}
            title={
              streamVideoUrl(stream)
                ? "Regarder le direct"
                : "Voir le suivi du direct"
            }
            onPress={() => router.push(liveStreamPath(stream.id))}
          />
        ))}
    </>
  );
}

export function ClubLiveWatch() {
  const { streamId } = useLocalSearchParams<{ streamId: string }>();
  const query = useClubLiveStream(streamId);
  const { isOffline } = useConnectivity();
  const stream = query.data;
  const video = stream ? streamVideoUrl(stream) : null;

  if (query.isPending && !isOffline) {
    return (
      <SafeAreaView style={liveStyles.fullscreen}>
        <View style={liveStyles.viewerFallback}>
          <Loading />
          <Text style={liveStyles.placeholderText}>Chargement du live…</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (query.isError) {
    return (
      <SafeAreaView style={liveStyles.fullscreen}>
        <View style={liveStyles.viewerFallback}>
          <Text style={liveStyles.placeholderTitle}>Connexion impossible</Text>
          <Text style={liveStyles.placeholderText}>La diffusion n’a pas pu être actualisée.</Text>
          <Pressable style={liveStyles.primaryLiveButton} onPress={() => void query.refetch()}>
            <Text style={liveStyles.primaryLiveText}>Réessayer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
  if (!stream) {
    return (
      <SafeAreaView style={liveStyles.fullscreen}>
        <View style={liveStyles.viewerFallback}>
          <Text style={liveStyles.placeholderTitle}>Diffusion introuvable</Text>
          <Pressable style={liveStyles.primaryLiveButton} onPress={() => router.back()}>
            <Text style={liveStyles.primaryLiveText}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
  return <LiveViewerFullscreen stream={stream} videoUrl={video} offline={isOffline} refresh={() => void query.refetch()} />;
}

function LiveViewerFullscreen({
  stream,
  videoUrl,
  offline,
  refresh,
}: {
  stream: NonNullable<ReturnType<typeof useClubLiveStream>["data"]>;
  videoUrl: string | null;
  offline: boolean;
  refresh: () => void;
}) {
  const broadcasterName = stream.broadcaster?.full_name || stream.broadcaster?.username || stream.home_team || "FootNation";
  const started = stream.started_at ? new Date(stream.started_at) : null;
  const timeLabel = started
    ? started.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "maintenant";
  const interactions = useLiveInteractions(stream.id);
  const [chatText, setChatText] = useState("");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const connectedCount = Math.max(1, interactions.viewers);
  const sendComment = () => {
    interactions.sendComment(chatText);
    setChatText("");
  };
  return (
    <SafeAreaView style={liveStyles.fullscreen}>
      <View style={StyleSheet.absoluteFill}>
        {videoUrl ? (
          <NativeVideo uri={videoUrl} controls={false} contentFit="cover" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={liveStyles.viewerGradient}>
            <Radio size={74} color="#FFFFFF" />
            <Text style={liveStyles.placeholderTitle}>Diffusion en cours</Text>
            <Text style={liveStyles.placeholderText}>Le flux vidéo sera visible ici dès qu’il sera disponible.</Text>
          </View>
        )}
        <View style={liveStyles.dimOverlay} />
      </View>

      <View style={liveStyles.topBar}>
        <View style={liveStyles.creatorRow}>
          <Avatar uri={stream.broadcaster?.avatar_url} name={broadcasterName} size={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={liveStyles.creatorName} numberOfLines={1}>{broadcasterName}</Text>
            <Text style={liveStyles.creatorMeta} numberOfLines={1}>❤️ {interactions.likes} · {timeLabel}</Text>
          </View>
          {stream.broadcaster?.id ? (
            <FollowAuthor id={stream.broadcaster.id} name={broadcasterName} variant="button" />
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => router.back()} style={liveStyles.closeButton}>
          <X size={30} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={liveStyles.missionRow}>
        <View style={liveStyles.softPill}><Text style={liveStyles.softPillText}>⚽ {stream.club_id ? "Match live" : "Live simple"}</Text></View>
        <View style={liveStyles.softPill}><Text style={liveStyles.softPillText}>👥 {connectedCount}</Text></View>
        <View style={liveStyles.softPill}><Text style={liveStyles.softPillText}>{offline ? "Hors ligne" : "FootNation"}</Text></View>
      </View>

      <View style={liveStyles.viewerSideActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voir les connectés" style={liveStyles.sideCircle} onPress={() => { interactions.refresh(); setPeopleOpen((value) => !value); }}><Users size={24} color="#FFFFFF" /></Pressable>
        <View style={liveStyles.sideLabelPill}><Text style={liveStyles.sideLabelText}>{connectedCount}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Aimer le live" style={liveStyles.sideCircle} onPress={interactions.toggleLike}><Heart size={24} color="#FFFFFF" fill={interactions.liked ? "#FF2D55" : "transparent"} /></Pressable>
        <View style={liveStyles.sideLabelPill}><Text style={liveStyles.sideLabelText}>{interactions.likes}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Voir les commentaires" style={liveStyles.sideCircle}><MessageCircle size={24} color="#FFFFFF" /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Partager le live" style={[liveStyles.sideCircle, liveStyles.shareCircle]} onPress={() => setShareOpen(true)}><Send size={24} color="#FFFFFF" /></Pressable>
      </View>

      <View style={liveStyles.viewerBottomPanel}>
        <Text style={liveStyles.viewerTitle}>{stream.title}</Text>
        <Text style={liveStyles.viewerDescription}>
          Bienvenue sur FootNation LIVE ! Interagis avec la communauté en temps réel.
        </Text>
        <LiveCommentFeed comments={[`👋 ${broadcasterName} est en direct`, ...interactions.commentLines]} />
        <LiveMessageComposer
          value={chatText}
          onChangeText={setChatText}
          onSend={sendComment}
          placeholder="Saisis ton message..."
        />
      </View>
      {peopleOpen && (
        <LiveActivityPanel
          viewers={connectedCount}
          likes={interactions.likes}
          comments={interactions.commentLines.length}
          viewerPeople={interactions.viewerPeople}
          likePeople={interactions.likePeople}
        />
      )}
      {shareOpen && (
        <PostShareSheet
          link={{
            url: `https://www.foot-nation.com${liveStreamPath(stream.id)}`,
            title: stream.title || "Live FootNation",
            description: "Regarde ce live sur FootNation",
            kind: "live",
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

function LiveActivityPanel({
  viewers,
  likes,
  comments,
  viewerPeople,
  likePeople,
}: {
  viewers: number;
  likes: number;
  comments: number;
  viewerPeople?: LivePerson[];
  likePeople?: LivePerson[];
}) {
  const connectedNames = (viewerPeople || []).slice(0, 3).map(livePersonName);
  const likeNames = (likePeople || []).slice(0, 3).map(livePersonName);
  return (
    <View style={liveStyles.activityOverlayPanel} pointerEvents="box-none">
      <View style={liveStyles.activityHeaderRow}>
        <Text style={liveStyles.activityTitle}>Activité du live</Text>
        <View style={liveStyles.activityMiniStats}>
          <Text style={liveStyles.activityMiniText}>👥 {viewers}</Text>
          <Text style={liveStyles.activityMiniText}>❤️ {likes}</Text>
          <Text style={liveStyles.activityMiniText}>💬 {comments}</Text>
        </View>
      </View>
      <Text style={liveStyles.activityLine} numberOfLines={1}>
        Connectés · {connectedNames.length ? connectedNames.join(", ") : "toi"}
      </Text>
      <Text style={liveStyles.activityLine} numberOfLines={1}>
        Likes · {likeNames.length ? likeNames.join(", ") : "aucun pour le moment"}
      </Text>
    </View>
  );
}

function LiveCommentFeed({ comments }: { comments: string[] }) {
  return (
    <View style={liveStyles.joinFeed}>
      {comments.slice(0, 4).map((comment, index) => (
        <Text key={`${comment}-${index}`} style={liveStyles.joinLine} numberOfLines={2}>
          {comment}
        </Text>
      ))}
    </View>
  );
}

function LiveMessageComposer({
  value,
  onChangeText,
  onSend,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  placeholder: string;
}) {
  return (
    <View style={liveStyles.messageComposer}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.78)"
        style={liveStyles.messageInput}
        maxLength={160}
        returnKeyType="send"
        onSubmitEditing={onSend}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Envoyer le message" onPress={onSend} style={liveStyles.messageIcon}>
        <Send size={19} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const liveStyles = StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: "#050814" },
  videoFill: { flex: 1, backgroundColor: "#050814" },
  dimOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(2,6,23,0.34)" },
  cameraPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30, paddingBottom: 140, gap: 10 },
  placeholderTitle: { color: "rgba(255,255,255,0.82)", fontSize: 24, fontWeight: "900", textAlign: "center" },
  placeholderText: { color: "rgba(255,255,255,0.58)", fontSize: 15, lineHeight: 21, textAlign: "center" },
  topBar: { position: "absolute", top: 18, left: 18, right: 18, flexDirection: "row", alignItems: "center", gap: 10 },
  creatorRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, padding: 8, paddingRight: 14, borderRadius: 28, backgroundColor: "rgba(8,12,24,0.54)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  creatorName: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  creatorMeta: { color: "rgba(255,255,255,0.66)", fontSize: 12, fontWeight: "700" },
  followPill: { backgroundColor: "#FF2D55", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  followText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  closeButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,12,24,0.58)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  missionRow: { position: "absolute", top: 90, left: 18, right: 18, flexDirection: "row", gap: 7, flexWrap: "wrap" },
  softPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  softPillMuted: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(8,12,24,0.42)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  softPillText: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "800" },
  bottomPanel: { position: "absolute", left: 18, right: 18, bottom: 16, gap: 10 },
  liveBadgeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 9 },
  liveBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  liveBadgeOn: { backgroundColor: "#EF233C" },
  liveBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  viewerText: { color: "rgba(255,255,255,0.72)", fontSize: 13, fontWeight: "800" },
  inputLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.9 },
  titleCard: { borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 13, backgroundColor: "rgba(8,12,24,0.54)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  titleCardAlert: { borderColor: "rgba(255,45,85,0.9)", backgroundColor: "rgba(255,45,85,0.14)" },
  titleInput: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", paddingTop: 8, paddingBottom: 2, outlineStyle: "none" as any },
  titleHelp: { color: "rgba(255,255,255,0.58)", fontSize: 13, fontWeight: "700", marginTop: 7, lineHeight: 18 },
  titleAlert: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "rgba(255,45,85,0.18)", borderWidth: 1, borderColor: "rgba(255,45,85,0.65)" },
  titleAlertText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  titleAlertSubtext: { color: "rgba(255,255,255,0.72)", fontSize: 13, fontWeight: "700", marginTop: 2 },
  notice: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "700" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  primaryLiveButton: { flex: 1, minHeight: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#FF2D55", paddingHorizontal: 18 },
  primaryLiveText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  primaryLiveButtonDisabled: { backgroundColor: "#64748B" },
  roundAction: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  roundActionText: { color: "#FFFFFF", fontWeight: "900" },
  endButton: { width: 64, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.92)" },
  endButtonText: { color: "#111827", fontWeight: "900" },
  viewerFallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  viewerGradient: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 30, backgroundColor: "#111827" },
  viewerSideActions: { position: "absolute", right: 18, bottom: 236, gap: 10 },
  sideCircle: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(8,12,24,0.58)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  shareCircle: { backgroundColor: "rgba(9,103,255,0.72)" },
  sideLabelPill: { minWidth: 30, alignSelf: "center", marginTop: -8, marginBottom: -2, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: "rgba(8,12,24,0.72)" },
  sideLabelText: { color: "#FFFFFF", textAlign: "center", fontSize: 12, fontWeight: "900" },
  viewerBottomPanel: { position: "absolute", left: 18, right: 84, bottom: 18, gap: 10 },
  viewerTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
  viewerDescription: { color: "#FFFFFF", fontSize: 16, lineHeight: 23, fontWeight: "700" },
  joinFeed: { gap: 5, marginTop: 2 },
  joinLine: { color: "rgba(255,255,255,0.82)", fontSize: 14, fontWeight: "800" },
  messageComposer: { marginTop: 4, minHeight: 48, borderRadius: 24, paddingLeft: 18, paddingRight: 6, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  messagePlaceholder: { flex: 1, color: "rgba(255,255,255,0.82)", fontSize: 16, fontWeight: "700" },
  messageInput: { flex: 1, color: "#FFFFFF", fontSize: 15, fontWeight: "700", paddingVertical: 10, outlineStyle: "none" as any },
  messageIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  messageIconText: { fontSize: 20 },
  activityOverlayPanel: { position: "absolute", left: 18, right: 84, bottom: 180, borderRadius: 22, padding: 14, gap: 7, backgroundColor: "rgba(0,0,0,0.48)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  activityHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  activityTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  activityMiniStats: { flexDirection: "row", alignItems: "center", gap: 8 },
  activityMiniText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  activityLine: { color: "rgba(255,255,255,0.84)", fontSize: 13, fontWeight: "800" },
});
