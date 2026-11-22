import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { StatusBar } from "expo-status-bar";
import {
  stopLiveCapture,
  LiveRtcPublisher,
  LiveRtcViewer,
  type LiveRtcSnapshot,
} from "../lib/liveRtc";
import { createLiveRtcDependencies } from "../lib/liveRtcPlatform";
import { liveNeedsProfile, liveFailureMessage } from "../lib/livePresentation";
import { SafeAreaView } from "react-native-safe-area-context";
import { SafeAreaModal as Modal } from "../components/SafeAreaModal";
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
import { useTheme } from "../theme";
import { ClubDesignProvider } from "../components/ClubDesign";
import { ClubLiveScore } from "../components/ClubLiveSection";
import { ClubMatchComments } from "../components/ClubMatchComments";
import { NativeVideo } from "../components/Video";
import { useConnectivity } from "../components/ConnectivityProvider";
import { useAuth } from "../lib/auth";
import { AuthGate } from "../components/AuthGate";
import { authGateReturnPath } from "../lib/authReturn";
import { liveLinkId, managedLiveClubId } from "../lib/liveLinkResolver";
import { loadManagedClubs } from "../lib/managedClubs";
import { supabase } from "../lib/supabase";
import {
  useClubLiveMatch,
  useClubLiveStream,
  useLiveStreams,
  useLiveLink,
} from "../lib/useClubLive";
import {
  isActiveLiveStream,
  liveStreamPath,
  streamVideoUrl,
} from "../lib/clubLive";
import {
  livePersonName,
  liveCommentText,
  useLiveInteractions,
  type LivePerson,
} from "../lib/useLiveInteractions";
import { PostShareSheet } from "../components/PostShareSheet";
import { FollowAuthor } from "../components/FollowAuthor";
import {
  Camera,
  Heart,
  MessageCircle,
  Radio,
  Send,
  Users,
  Video,
  X,
} from "lucide-react-native";

const nativeWebRtc =
  Platform.OS === "web" ? null : require("react-native-webrtc");

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
  const { mode, clubId } = useLocalSearchParams<{
    mode?: string;
    clubId?: string;
  }>();
  const uid = useAuth().session?.user.id;
  const selectedMode: LiveCreateMode | null =
    mode === "match" || mode === "simple" ? mode : null;
  if (selectedMode === "simple") return <SimpleLiveStudio />;
  if (selectedMode === "match")
    return (
      <AuthGate>
        <ClubLiveSetup
          key={`${uid}:${liveLinkId(clubId) || ""}`}
          mode={selectedMode}
          requestedClubId={liveLinkId(clubId)}
        />
      </AuthGate>
    );
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
      subtitle:
        "Regarde les directs et replays déjà disponibles sur FootNation.",
      icon: Radio,
      path: "/live",
    },
  ] as const;
  return (
    <Screen title="Diffuser un match">
      <Text style={s.subtitle}>
        Sélectionne ce que tu veux faire. Tu pourras choisir ton club avant de
        continuer.
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
  const matchId = useRef(`simple:${uid || "guest"}:${Date.now()}`).current;
  return (
    <LiveStudioFullscreen
      key={uid || "guest"}
      config={{
        mode: "simple",
        title: "",
        clubId: null,
        matchId,
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
}: {
  config: LiveStudioConfig;
  displayName: string;
  avatarUrl?: string | null;
  profileId?: string | null;
}) {
  const { session, profileStatus } = useAuth();
  const uid = session?.user.id;
  const { colors } = useTheme();
  const videoRef = useRef<any>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const publisher = useRef<LiveRtcPublisher | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const operation = useRef(false);
  const captureBusy = useRef(false);
  const attemptId = useRef<string | null>(null);
  const [title, setTitle] = useState(config.title);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "user",
  );
  const [startingCamera, setStartingCamera] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [rtc, setRtc] = useState<LiveRtcSnapshot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [titleMissing, setTitleMissing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [chatText, setChatText] = useState("");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const needsProfile = profileStatus === "missing" || profileMissing;
  const onAir = rtc?.phase === "live";
  const interactions = useLiveInteractions(onAir ? liveId : null, false);
  const draftKey = uid ? `footnation-live-title:${uid}:${config.mode}` : null;

  function stopCamera() {
    generation.current++;
    stopLiveCapture(mediaRef.current);
    mediaRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mounted.current) setCameraReady(false);
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      unsubscribe.current?.();
      publisher.current?.dispose();
      stopCamera();
    };
  }, [uid]);
  useEffect(() => {
    if (!draftKey) return;
    let canceled = false;
    void AsyncStorage.getItem(draftKey)
      .then((saved) => {
        if (!canceled && saved)
          setTitle((current) => current || saved.slice(0, 80));
      })
      .catch(() => {});
    return () => {
      canceled = true;
    };
  }, [draftKey]);
  useEffect(() => {
    if (!onAir) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [onAir]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "background") return;
      // iOS cannot keep this foreground camera live while the app is hidden.
      stopCamera();
      if (publisher.current) void publisher.current.end().catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  async function completeProfile() {
    if (operation.current) return;
    stopCamera();
    if (draftKey) await AsyncStorage.setItem(draftKey, title).catch(() => {});
    if (!mounted.current) return;
    router.replace({
      pathname: "/onboarding",
      params: { next: `/live/create?mode=${config.mode}` },
    });
  }

  async function acquireCamera(facing: "user" | "environment") {
    if (captureBusy.current || operation.current) return;
    if (needsProfile) {
      await completeProfile();
      return;
    }
    captureBusy.current = true;
    const currentGeneration = ++generation.current;
    setStartingCamera(true);
    setNotice(null);
    const devices =
      Platform.OS === "web"
        ? globalThis.navigator?.mediaDevices
        : nativeWebRtc?.mediaDevices;
    let next: MediaStream | null = null;
    try {
      if (!devices?.getUserMedia) throw new Error("camera-unavailable");
      const currentTrack = mediaRef.current?.getVideoTracks()[0];
      if (Platform.OS !== "web" && currentTrack && facing !== cameraFacing) {
        // Native WebRTC switches the existing camera without opening a second
        // capture session or interrupting the tracks already sent to viewers.
        await currentTrack.applyConstraints({
          facingMode: facing,
          width: 640,
          height: 360,
          frameRate: 24,
        });
        if (mounted.current && generation.current === currentGeneration)
          setCameraFacing(facing);
        return;
      }
      // Keep mobile uplink reasonable; the camera is opened only by this explicit action.
      next = await devices.getUserMedia({
        video: { facingMode: facing, width: 640, height: 360, frameRate: 24 },
        audio: true,
      });
      if (!mounted.current || generation.current !== currentGeneration) {
        stopLiveCapture(next);
        return;
      }
      if (publisher.current?.getSnapshot().phase === "live" && next)
        await publisher.current.replaceStream(next);
      if (!mounted.current || generation.current !== currentGeneration) {
        stopLiveCapture(next);
        return;
      }
      const previous = mediaRef.current;
      mediaRef.current = next;
      stopLiveCapture(previous);
      setCameraFacing(facing);
      setCameraReady(true);
    } catch {
      stopLiveCapture(next);
      if (mounted.current)
        setNotice(
          "Impossible d’activer la caméra et le micro. Vérifiez les autorisations de FootNation.",
        );
    } finally {
      captureBusy.current = false;
      if (mounted.current) setStartingCamera(false);
    }
  }

  async function startLive() {
    if (operation.current || captureBusy.current) return;
    if (needsProfile) {
      await completeProfile();
      return;
    }
    if (!uid) {
      setNotice("Connectez-vous pour lancer un live.");
      return;
    }
    if (!title.trim()) {
      setTitleMissing(true);
      return;
    }
    if (!mediaRef.current) {
      await acquireCamera(cameraFacing);
      return;
    }
    operation.current = true;
    setPublishing(true);
    setNotice(null);
    const captured = mediaRef.current;
    const currentGeneration = generation.current;
    try {
      const dependencies = await createLiveRtcDependencies(uid);
      if (!mounted.current || generation.current !== currentGeneration) return;
      unsubscribe.current?.();
      publisher.current?.dispose();
      const controller = new LiveRtcPublisher(dependencies);
      publisher.current = controller;
      unsubscribe.current = controller.subscribe(() => {
        if (mounted.current) setRtc(controller.getSnapshot());
      });
      attemptId.current ||= randomUUID();
      const created = await controller.start(
        {
          id: attemptId.current,
          title: title.trim(),
          matchId: config.matchId,
          clubId: config.clubId,
          homeTeam: config.mode === "match" ? config.eyebrow : displayName,
          awayTeam: config.mode === "match" ? config.subtitle : null,
        },
        captured,
      );
      if (
        !mounted.current ||
        generation.current !== currentGeneration ||
        controller.getSnapshot().phase !== "live"
      )
        return;
      setLiveId(created.id);
      setElapsed(0);
      if (draftKey) void AsyncStorage.removeItem(draftKey).catch(() => {});
      // Notification delivery never changes the outcome of a successful broadcast.
      void notifyLiveNetwork({
        streamId: created.id,
        profileId: uid,
        displayName,
        kind: config.mode === "match" ? "match_live" : "simple_live",
      }).catch(() => {
        if (mounted.current && controller.getSnapshot().phase === "live")
          setNotice(
            "Le live est en cours. Les invitations à votre réseau n’ont pas pu être envoyées.",
          );
      });
    } catch (reason) {
      stopCamera();
      attemptId.current = null;
      if (mounted.current) {
        setProfileMissing(liveNeedsProfile(reason));
        setNotice(liveFailureMessage(reason));
      }
    } finally {
      operation.current = false;
      if (mounted.current) setPublishing(false);
    }
  }

  async function endLive() {
    if (operation.current) return;
    operation.current = true;
    setPublishing(true);
    stopCamera();
    try {
      if (publisher.current) await publisher.current.end();
      if (mounted.current) router.replace("/live");
    } catch {
      if (mounted.current)
        setNotice(
          "La caméra et le micro sont coupés. Réessayez pour confirmer la fin du live au serveur.",
        );
    } finally {
      operation.current = false;
      if (mounted.current) setPublishing(false);
    }
  }

  if (!liveId)
    return (
      <Screen
        title="Préparer un live"
        onBack={() => {
          if (!operation.current) void endLive();
        }}
      >
        <View style={preparationStyles.content}>
          <View style={preparationStyles.identity}>
            <Avatar uri={avatarUrl} name={displayName} size={32} />
            <Text style={[preparationStyles.name, { color: colors.ink }]}>
              {displayName}
            </Text>
          </View>
          <View style={preparationStyles.preview}>
            <CameraSurface
              videoRef={videoRef}
              stream={mediaRef.current}
              active={cameraReady}
              onActivate={() => void acquireCamera(cameraFacing)}
              compact
              mirror={cameraFacing === "user"}
            />
          </View>
          <View style={preparationStyles.field}>
            <Text style={[preparationStyles.label, { color: colors.ink }]}>
              Titre du live
            </Text>
            <TextInput
              accessibilityLabel="Titre du live"
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                if (value.trim()) setTitleMissing(false);
              }}
              placeholder="Ex. Entraînement avec l’équipe"
              placeholderTextColor={colors.muted}
              maxLength={80}
              editable={!publishing}
              style={[
                preparationStyles.input,
                {
                  color: colors.ink,
                  backgroundColor: colors.surface,
                  borderColor: titleMissing ? colors.danger : colors.border,
                },
              ]}
            />
            {titleMissing && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                Ajoutez un titre pour continuer.
              </Text>
            )}
          </View>
          {needsProfile && (
            <Text accessibilityRole="alert" style={{ color: colors.ink }}>
              Complétez votre profil pour diffuser. Votre titre sera conservé.
            </Text>
          )}
          {!!notice && (
            <Text
              accessibilityRole="alert"
              style={[preparationStyles.hint, { color: colors.danger }]}
            >
              {notice}
            </Text>
          )}
          <Button
            title={
              needsProfile
                ? "Compléter mon profil"
                : cameraReady
                  ? "Lancer le live"
                  : "Activer la caméra"
            }
            busy={startingCamera || publishing}
            onPress={() =>
              void (needsProfile
                ? completeProfile()
                : cameraReady
                  ? startLive()
                  : acquireCamera(cameraFacing))
            }
          />
          {cameraReady && (
            <View style={preparationStyles.cameraActions}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Changer de caméra"
                  secondary
                  disabled={publishing || startingCamera}
                  onPress={() =>
                    void acquireCamera(
                      cameraFacing === "user" ? "environment" : "user",
                    )
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Couper"
                  accessibilityLabel="Couper la caméra"
                  secondary
                  disabled={publishing || startingCamera}
                  onPress={stopCamera}
                />
              </View>
            </View>
          )}
          <Text style={[preparationStyles.hint, { color: colors.muted }]}>
            Le direct commence uniquement après « Lancer le live ». Gardez
            FootNation ouvert pendant la diffusion.
          </Text>
        </View>
      </Screen>
    );

  return (
    <SafeAreaView style={liveStyles.fullscreen}>
      <StatusBar style="light" />
      <View style={StyleSheet.absoluteFill}>
        <CameraSurface
          videoRef={videoRef}
          stream={mediaRef.current}
          active={cameraReady && onAir}
          onActivate={() => {}}
          mirror={cameraFacing === "user"}
          compact
        />
        <View pointerEvents="none" style={liveStyles.dimOverlay} />
      </View>
      <View pointerEvents="box-none" style={liveStyles.safeContent}>
        <View style={liveStyles.topBar}>
          <View style={liveStyles.creatorRow}>
            <Avatar uri={avatarUrl} name={displayName} size={42} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={liveStyles.creatorName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={liveStyles.creatorMeta}>
                {onAir ? formatElapsed(elapsed) : "Diffusion arrêtée"}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer et arrêter le live"
            disabled={publishing}
            onPress={() => void endLive()}
            style={liveStyles.closeButton}
          >
            <X size={30} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={liveStyles.missionRow}>
          <View style={[liveStyles.liveBadge, onAir && liveStyles.liveBadgeOn]}>
            <Text style={liveStyles.liveBadgeText}>
              {onAir ? "LIVE" : "ARRÊTÉ"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir les connectés"
            onPress={() => setPeopleOpen((value) => !value)}
            style={liveStyles.softPill}
          >
            <Text style={liveStyles.softPillText}>
              👥 {rtc?.connectedViewers ?? 0}
            </Text>
          </Pressable>
          <View style={liveStyles.softPill}>
            <Text style={liveStyles.softPillText}>❤️ {interactions.likes}</Text>
          </View>
        </View>
        <View style={liveStyles.bottomPanel}>
          <Text style={liveStyles.viewerTitle} numberOfLines={2}>
            {title}
          </Text>
          {!!(notice || rtc?.message) && (
            <Text accessibilityRole="alert" style={liveStyles.notice}>
              {notice || rtc?.message}
            </Text>
          )}
          <LiveCommentFeed comments={interactions.commentLines} />
          {onAir && (
            <LiveMessageComposer
              value={chatText}
              onChangeText={setChatText}
              onSend={() => {
                interactions.sendComment(chatText);
                setChatText("");
              }}
              placeholder="Écrire un commentaire..."
            />
          )}
          <View style={liveStyles.actionRow}>
            {onAir && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Partager le live"
                onPress={() => setShareOpen(true)}
                style={liveStyles.primaryLiveButton}
              >
                <Text style={liveStyles.primaryLiveText}>Partager</Text>
              </Pressable>
            )}
            {onAir && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Changer de caméra"
                disabled={startingCamera || publishing}
                onPress={() =>
                  void acquireCamera(
                    cameraFacing === "user" ? "environment" : "user",
                  )
                }
                style={liveStyles.roundAction}
              >
                <Camera size={22} color="#FFFFFF" />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                onAir ? "Arrêter le live" : "Confirmer la fin du live"
              }
              disabled={publishing}
              onPress={() => void endLive()}
              style={[
                liveStyles.primaryLiveButton,
                { backgroundColor: "#FFFFFF" },
              ]}
            >
              <Text style={[liveStyles.primaryLiveText, { color: "#111827" }]}>
                {publishing ? "Arrêt…" : onAir ? "Arrêter" : "Terminer"}
              </Text>
            </Pressable>
          </View>
        </View>
        {peopleOpen && (
          <LiveActivityPanel
            viewers={rtc?.connectedViewers ?? 0}
            likes={interactions.likes}
            comments={interactions.commentLines.length}
            viewerPeople={interactions.viewerPeople}
            likePeople={interactions.likePeople}
          />
        )}
        {shareOpen && (
          <PostShareSheet
            link={{
              url: `https://www.foot-nation.com${liveStreamPath(liveId)}`,
              title,
              description: "Regarde ce live sur FootNation",
              kind: "live",
            }}
            onClose={() => setShareOpen(false)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
function CameraSurface({
  videoRef,
  stream,
  active,
  onActivate,
  compact = false,
  mirror = true,
}: {
  videoRef: React.RefObject<any>;
  stream: any;
  active: boolean;
  onActivate: () => void;
  compact?: boolean;
  mirror?: boolean;
}) {
  // Keep the local preview attached when preparation becomes the live screen.
  useEffect(() => {
    if (Platform.OS === "web" && active && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play?.().catch(() => {});
    }
  }, [active, stream, videoRef]);
  const NativeRtcView = Platform.OS === "web" ? null : nativeWebRtc?.RTCView;
  return (
    <View style={liveStyles.videoFill}>
      {Platform.OS === "web" ? (
        React.createElement("video", {
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
      ) : NativeRtcView && active ? (
        <NativeRtcView
          streamURL={stream?.toURL?.()}
          style={StyleSheet.absoluteFill}
          mirror={mirror}
          objectFit="cover"
        />
      ) : null}
      {!active &&
        (compact ? (
          <View style={preparationStyles.placeholder}>
            <Camera size={32} color="#AAB8CC" strokeWidth={1.5} />
            <Text style={preparationStyles.previewLabel}>Aperçu caméra</Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Activer la caméra"
            onPress={onActivate}
            style={liveStyles.cameraPlaceholder}
          >
            <Camera size={40} color="#FFFFFF" />
            <Text style={liveStyles.placeholderText}>Activer la caméra</Text>
          </Pressable>
        ))}
    </View>
  );
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${rest}`;
}

function ClubLiveSetup({
  mode,
  requestedClubId,
}: {
  mode: LiveCreateMode;
  requestedClubId?: string | null;
}) {
  const s = useUIStyles();
  const uid = useAuth().session?.user.id;
  const [clubId, setClubId] = useState("");
  const [matchId, setMatchId] = useState("");
  const clubs = useQuery({
    queryKey: ["live-create-managed-clubs", uid],
    enabled: !!uid,
    queryFn: () => loadManagedClubs(uid!, 0),
  });
  const validatedClub = managedLiveClubId(requestedClubId, clubs.data);
  useEffect(() => {
    if (validatedClub) setClubId(validatedClub);
  }, [validatedClub]);
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
        key={uid || "guest"}
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
    const clubName =
      selectedClub.club?.short_name || selectedClub.club?.name || "Club";
    const matchName = selectedMatch?.opponent_name || "Match FootNation";
    setStudio({
      mode: "match",
      title: selectedMatch
        ? `${clubName} - ${matchName}`
        : `${clubName} en direct`,
      clubId: selectedClub.club_id,
      matchId:
        selectedMatch?.id || `club:${selectedClub.club_id}:${Date.now()}`,
      eyebrow: clubName,
      subtitle: selectedMatch
        ? matchName
        : "Live match sans rencontre associée",
      badge: "MATCH LIVE",
    });
  };
  return (
    <Screen title={mode === "match" ? "Direct d’un match" : "Live simple"}>
      <Text style={s.subtitle}>
        {mode === "match"
          ? "Choisis le club, puis un match si tu veux rattacher le direct à une rencontre précise."
          : "Choisis le club qui diffuse ce live. Aucun match n’est obligatoire."}
      </Text>
      {!!requestedClubId &&
        !clubs.isPending &&
        !clubs.error &&
        !validatedClub && (
          <Text style={s.small}>
            Ce club n’est pas disponible parmi ceux que vous gérez. Choisissez
            un autre club.
          </Text>
        )}
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
                    borderColor:
                      clubId === row.club_id ? "#0967FF" : "transparent",
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Avatar
                  uri={row.club?.logo_url}
                  name={row.club?.name || "Club"}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.h2}>
                    {row.club?.short_name || row.club?.name || "Club"}
                  </Text>
                  {!!row.club?.city && (
                    <Text style={s.small}>{row.club.city}</Text>
                  )}
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
                <ErrorState
                  error={matches.error}
                  retry={() => void matches.refetch()}
                />
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: !matchId }}
                    onPress={() => setMatchId("")}
                    style={[
                      s.card,
                      {
                        borderWidth: 2,
                        borderColor: !matchId ? "#0967FF" : "transparent",
                      },
                    ]}
                  >
                    <Text style={s.h2}>Aucun match précis</Text>
                    <Text style={s.small}>
                      Le direct sera préparé sans rencontre associée.
                    </Text>
                  </Pressable>
                  {matches.data?.map((match) => (
                    <Pressable
                      key={match.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: matchId === match.id }}
                      onPress={() => setMatchId(match.id)}
                      style={[
                        s.card,
                        {
                          borderWidth: 2,
                          borderColor:
                            matchId === match.id ? "#0967FF" : "transparent",
                        },
                      ]}
                    >
                      <Text style={s.h2}>
                        {match.opponent_name || "Adversaire à confirmer"}
                      </Text>
                      <Text style={s.small}>
                        {[
                          match.competition,
                          match.status,
                          match.match_date
                            ? new Date(match.match_date).toLocaleString("fr-FR")
                            : null,
                        ]
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

function returnToLives() {
  if (router.canGoBack()) router.back();
  else router.replace("/live");
}

export function ClubLiveWatch() {
  const {
    streamId,
    id,
    stream: explicitStream,
  } = useLocalSearchParams<{
    streamId?: string;
    id?: string;
    stream?: string;
  }>();
  const query = useLiveLink(streamId || id, explicitStream);
  const { isOffline } = useConnectivity();
  const stream = query.data;
  const video = stream ? streamVideoUrl(stream) : null;

  if (query.isPending && !isOffline)
    return (
      <Screen title="Live" onBack={returnToLives}>
        <Loading />
      </Screen>
    );
  if (query.isError)
    return (
      <Screen title="Live" onBack={returnToLives}>
        <ErrorState
          error={new Error("La diffusion n’a pas pu être actualisée.")}
          retry={() => void query.refetch()}
        />
      </Screen>
    );
  if (!stream)
    return (
      <Screen title="Live" onBack={returnToLives}>
        <Empty
          title={isOffline ? "Vous êtes hors ligne" : "Diffusion introuvable"}
          description={
            isOffline
              ? "Reconnectez-vous pour regarder ce direct."
              : "Ce live n’est plus disponible."
          }
          action={<Button title="Retour aux lives" onPress={returnToLives} />}
        />
      </Screen>
    );
  return (
    <LiveViewerFullscreen
      stream={stream}
      videoUrl={video}
      offline={isOffline}
      refresh={() => void query.refetch()}
    />
  );
}

function RtcLiveSurface({ streamId }: { streamId: string }) {
  const { session, profileStatus } = useAuth();
  const uid = session?.user.id;
  const [snapshot, setSnapshot] = useState<LiveRtcSnapshot | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [muted, setMuted] = useState(Platform.OS === "web");
  const videoRef = useRef<any>(null);
  const NativeRtcView = Platform.OS === "web" ? null : nativeWebRtc?.RTCView;

  useEffect(() => {
    let canceled = false;
    let viewer: LiveRtcViewer | null = null;
    let unsubscribe: (() => void) | undefined;
    setSnapshot(null);
    setFailure(null);
    if (!uid || profileStatus === "missing") return;
    void (async () => {
      try {
        const dependencies = await createLiveRtcDependencies(uid);
        if (canceled) return;
        viewer = new LiveRtcViewer(dependencies);
        unsubscribe = viewer.subscribe(() => {
          if (!canceled) setSnapshot(viewer!.getSnapshot());
        });
        await viewer.start(streamId);
      } catch (error) {
        if (!canceled) setFailure(liveFailureMessage(error));
      }
    })();
    return () => {
      canceled = true;
      unsubscribe?.();
      viewer?.dispose();
    };
  }, [uid, profileStatus, streamId, attempt]);

  const remote = snapshot?.remoteStream;
  useEffect(() => {
    if (Platform.OS !== "web" || !videoRef.current) return;
    videoRef.current.srcObject = remote || null;
    if (remote) void videoRef.current.play().catch(() => setMuted(true));
  }, [remote]);
  const ready = snapshot?.phase === "connected" && !!remote;
  const needsProfile = profileStatus === "missing";
  const needsLogin = !uid;
  const failed = !!failure || snapshot?.phase === "error";
  const ended = snapshot?.phase === "ended";
  return (
    <View style={liveStyles.videoFill}>
      {Platform.OS === "web" ? (
        React.createElement("video", {
          ref: videoRef,
          autoPlay: true,
          muted,
          playsInline: true,
          style: {
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: ready ? "block" : "none",
          },
        })
      ) : NativeRtcView && ready ? (
        <NativeRtcView
          streamURL={(remote as any)?.toURL?.()}
          objectFit="contain"
          mirror={false}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {!ready && (
        <View style={liveStyles.viewerGradient}>
          <Radio size={60} color="#FFFFFF" />
          <Text style={liveStyles.placeholderTitle}>
            {needsLogin
              ? "Connectez-vous"
              : needsProfile
                ? "Complétez votre profil"
                : ended
                  ? "Live terminé"
                  : failed
                    ? "Connexion interrompue"
                    : "Connexion au direct…"}
          </Text>
          <Text style={liveStyles.placeholderText}>
            {needsLogin
              ? "Connectez-vous pour rejoindre ce direct."
              : needsProfile
                ? "Complétez votre profil pour rejoindre ce direct."
                : failure ||
                  snapshot?.message ||
                  "La vidéo et le son arrivent dans quelques instants."}
          </Text>
          {(failed || ended) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rejoindre le direct"
              onPress={() => setAttempt((value) => value + 1)}
              style={[liveStyles.softPill, { marginTop: 12 }]}
            >
              <Text style={liveStyles.softPillText}>Réessayer</Text>
            </Pressable>
          )}
          {needsLogin && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Se connecter"
              onPress={() =>
                router.replace({
                  pathname: "/login",
                  params: { next: liveStreamPath(streamId) },
                })
              }
              style={[liveStyles.softPill, { marginTop: 12 }]}
            >
              <Text style={liveStyles.softPillText}>Se connecter</Text>
            </Pressable>
          )}
          {needsProfile && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Compléter mon profil"
              onPress={() =>
                router.replace({
                  pathname: "/onboarding",
                  params: { next: liveStreamPath(streamId) },
                })
              }
              style={[liveStyles.softPill, { marginTop: 12 }]}
            >
              <Text style={liveStyles.softPillText}>Compléter mon profil</Text>
            </Pressable>
          )}
        </View>
      )}
      {ready && Platform.OS === "web" && muted && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Activer le son"
          onPress={() => {
            setMuted(false);
            if (videoRef.current) {
              videoRef.current.muted = false;
              void videoRef.current.play().catch(() => setMuted(true));
            }
          }}
          style={[
            liveStyles.softPill,
            { position: "absolute", top: "40%", alignSelf: "center" },
          ]}
        >
          <Text style={liveStyles.softPillText}>Activer le son</Text>
        </Pressable>
      )}
    </View>
  );
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
  const { height, width } = useWindowDimensions();
  const compact = height < 720 || width < 360;
  const broadcasterName =
    stream.broadcaster?.full_name ||
    stream.broadcaster?.username ||
    stream.home_team ||
    "FootNation";
  const started = stream.started_at ? new Date(stream.started_at) : null;
  const timeLabel = started
    ? started.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "maintenant";
  const interactions = useLiveInteractions(stream.id);
  const { session } = useAuth();
  const pathname = usePathname();
  const routeParams = useLocalSearchParams();
  const [chatText, setChatText] = useState("");
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const sendingComment = useRef(false);
  const connectedCount = interactions.viewers;
  const sendComment = () => {
    if (!chatText.trim() || sendingComment.current) return;
    const submitted = chatText;
    sendingComment.current = true;
    void interactions.sendCommentAsync(submitted).then(() => {
      setChatText((current) => current === submitted ? "" : current);
    }).catch(() => {
      // The mutation exposes its error; keep the user's draft for retry.
    }).finally(() => {
      sendingComment.current = false;
    });
  };
  return (
    <SafeAreaView style={liveStyles.fullscreen}>
      <StatusBar style="light" />
      <View style={StyleSheet.absoluteFill}>
        {videoUrl ? (
          <NativeVideo
            uri={videoUrl}
            controls={false}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
        ) : stream.transport === "webrtc" && isActiveLiveStream(stream) ? (
          <RtcLiveSurface streamId={stream.id} />
        ) : (
          <View style={liveStyles.viewerGradient}>
            <Radio size={74} color="#FFFFFF" />
            <Text style={liveStyles.placeholderTitle}>
              {isActiveLiveStream(stream)
                ? "Vidéo indisponible"
                : "Live terminé"}
            </Text>
            <Text style={liveStyles.placeholderText}>
              {isActiveLiveStream(stream)
                ? "Ce direct ne transmet pas de vidéo. Le diffuseur doit le relancer avec la nouvelle version de FootNation."
                : "La diffusion est terminée."}
            </Text>
          </View>
        )}
        <View pointerEvents="none" style={liveStyles.dimOverlay} />
      </View>

      {/* Keep the video edge-to-edge and all controls inside the safe area. */}
      <View pointerEvents="box-none" style={liveStyles.safeContent}>
        <View style={liveStyles.topBar}>
          <View style={liveStyles.creatorRow}>
            <Avatar
              uri={stream.broadcaster?.avatar_url}
              name={broadcasterName}
              size={46}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={liveStyles.creatorName} numberOfLines={1}>
                {broadcasterName}
              </Text>
              <Text style={liveStyles.creatorMeta} numberOfLines={1}>
                ❤️ {interactions.likes} · {timeLabel}
              </Text>
            </View>
            {stream.broadcaster?.id ? (
              <FollowAuthor
                id={stream.broadcaster.id}
                name={broadcasterName}
                variant="button"
              />
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            onPress={returnToLives}
            style={liveStyles.closeButton}
          >
            <X size={30} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={liveStyles.missionRow}>
          <View style={liveStyles.softPill}>
            <Text style={liveStyles.softPillText}>
              ⚽ {stream.club_id ? "Match live" : "Live simple"}
            </Text>
          </View>
          <View style={liveStyles.softPill}>
            <Text style={liveStyles.softPillText}>👥 {connectedCount}</Text>
          </View>
          <View style={liveStyles.softPill}>
            <Text style={liveStyles.softPillText}>
              {offline ? "Hors ligne" : "FootNation"}
            </Text>
          </View>
        </View>

        <View
          style={[
            liveStyles.viewerSideActions,
            compact && liveStyles.viewerSideActionsCompact,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir les connectés"
            style={liveStyles.sideCircle}
            onPress={() => {
              interactions.refresh();
              setPeopleOpen((value) => !value);
            }}
          >
            <Users size={24} color="#FFFFFF" />
          </Pressable>
          <View style={liveStyles.sideLabelPill}>
            <Text style={liveStyles.sideLabelText}>{connectedCount}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Aimer le live"
            style={liveStyles.sideCircle}
            onPress={interactions.toggleLike}
          >
            <Heart
              size={24}
              color="#FFFFFF"
              fill={interactions.liked ? "#FF2D55" : "transparent"}
            />
          </Pressable>
          <View style={liveStyles.sideLabelPill}>
            <Text style={liveStyles.sideLabelText}>{interactions.likes}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir les commentaires"
            style={liveStyles.sideCircle}
            onPress={() => {
              interactions.refresh();
              setCommentsOpen(true);
            }}
          >
            <MessageCircle size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Partager le live"
            style={[liveStyles.sideCircle, liveStyles.shareCircle]}
            onPress={() => setShareOpen(true)}
          >
            <Send size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <View
          style={[
            liveStyles.viewerBottomPanel,
            compact && liveStyles.viewerBottomPanelCompact,
          ]}
        >
          <Text
            style={[
              liveStyles.viewerTitle,
              compact && liveStyles.viewerTitleCompact,
            ]}
            numberOfLines={2}
          >
            {stream.title}
          </Text>
          <Text
            style={[
              liveStyles.viewerDescription,
              compact && liveStyles.viewerDescriptionCompact,
            ]}
            numberOfLines={3}
          >
            Bienvenue sur FootNation LIVE ! Interagis avec la communauté en
            temps réel.
          </Text>
          <LiveCommentFeed
            comments={[
              ...(isActiveLiveStream(stream)
                ? [`👋 ${broadcasterName} est en direct`]
                : []),
              ...interactions.commentLines,
            ]}
          />
          <LiveMessageComposer
            value={chatText}
            onChangeText={setChatText}
            onSend={sendComment}
            busy={interactions.commentSendPending}
            placeholder="Saisis ton message..."
          />
          {!!interactions.commentSendError && (
            <Text accessibilityRole="alert" style={liveStyles.joinLine}>
              {session
                ? "Envoi impossible. Ton message est conservé."
                : "Connecte-toi pour commenter. Ton message est conservé."}
            </Text>
          )}
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
        {commentsOpen && (
          <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={() => setCommentsOpen(false)}
          >
            <SafeAreaView style={liveStyles.commentsOverlay}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer les commentaires"
                onPress={() => setCommentsOpen(false)}
                style={liveStyles.commentsBackdrop}
              />
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={liveStyles.commentsKeyboard}
              >
                <View style={liveStyles.commentsSheet} accessibilityViewIsModal>
                  <View style={liveStyles.commentsHeader}>
                    <Text accessibilityRole="header" style={liveStyles.commentsTitle}>
                      Commentaires du live
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Fermer les commentaires"
                      onPress={() => setCommentsOpen(false)}
                      style={liveStyles.commentsClose}
                    >
                      <X size={22} color="#FFFFFF" />
                    </Pressable>
                  </View>
                  <ScrollView
                    style={liveStyles.commentsScroll}
                    contentContainerStyle={liveStyles.commentsContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    {!!interactions.commentsError && (
                      <>
                        <Text accessibilityRole="alert" style={liveStyles.joinLine}>
                          Impossible d’actualiser les commentaires.
                        </Text>
                        <Pressable accessibilityRole="button" onPress={interactions.refresh} style={liveStyles.commentsRetry}>
                          <Text style={liveStyles.joinLine}>Réessayer</Text>
                        </Pressable>
                      </>
                    )}
                    {interactions.isPending && !interactions.comments.length ? (
                      <Text style={liveStyles.joinLine}>Chargement des commentaires…</Text>
                    ) : interactions.comments.length ? (
                      interactions.comments.map((comment) => (
                        <Text key={comment.id} style={liveStyles.joinLine}>
                          {liveCommentText(comment)}
                        </Text>
                      ))
                    ) : !interactions.commentsError ? (
                      <Text style={liveStyles.joinLine}>Aucun commentaire pour le moment.</Text>
                    ) : null}
                  </ScrollView>
                  {session ? (
                    <LiveMessageComposer
                      value={chatText}
                      onChangeText={setChatText}
                      onSend={sendComment}
                      busy={interactions.commentSendPending}
                      placeholder="Saisis ton message..."
                    />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        const next = authGateReturnPath(pathname, routeParams);
                        setCommentsOpen(false);
                        router.push({ pathname: "/login", params: next ? { next } : {} });
                      }}
                      style={liveStyles.commentsRetry}
                    >
                      <Text style={liveStyles.joinLine}>Se connecter pour commenter</Text>
                    </Pressable>
                  )}
                  {!!interactions.commentSendError && (
                    <Text accessibilityRole="alert" style={liveStyles.joinLine}>
                      Envoi impossible. Ton message est conservé.
                    </Text>
                  )}
                </View>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </Modal>
        )}
      </View>
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
        Likes ·{" "}
        {likeNames.length ? likeNames.join(", ") : "aucun pour le moment"}
      </Text>
    </View>
  );
}

function LiveCommentFeed({ comments }: { comments: string[] }) {
  return (
    <View style={liveStyles.joinFeed}>
      {comments.slice(0, 4).map((comment, index) => (
        <Text
          key={`${comment}-${index}`}
          style={liveStyles.joinLine}
          numberOfLines={2}
        >
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
  busy = false,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  busy?: boolean;
  placeholder: string;
}) {
  return (
    <View style={liveStyles.messageComposer}>
      <TextInput
        accessibilityLabel="Message du live"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.78)"
        style={liveStyles.messageInput}
        maxLength={160}
        returnKeyType="send"
        onSubmitEditing={onSend}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Envoyer le message"
        accessibilityState={{ disabled: busy || !value.trim(), busy }}
        disabled={busy || !value.trim()}
        onPress={onSend}
        style={liveStyles.messageIcon}
      >
        <Send size={19} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const liveStyles = StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: "#050814" },
  safeContent: { flex: 1, minHeight: 0 },
  videoFill: { flex: 1, backgroundColor: "#050814" },
  dimOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(2,6,23,0.34)",
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingBottom: 140,
    gap: 10,
  },
  placeholderTitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  placeholderText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  topBar: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  creatorRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    paddingRight: 14,
    borderRadius: 28,
    backgroundColor: "rgba(8,12,24,0.54)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  creatorName: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  creatorMeta: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 12,
    fontWeight: "700",
  },
  followPill: {
    backgroundColor: "#FF2D55",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  followText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,12,24,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  missionRow: {
    position: "absolute",
    top: 90,
    left: 18,
    right: 18,
    flexDirection: "row",
    gap: 7,
    flexWrap: "wrap",
  },
  softPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  softPillMuted: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(8,12,24,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  softPillText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "800",
  },
  bottomPanel: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 16,
    gap: 10,
  },
  liveBadgeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 9 },
  liveBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  liveBadgeOn: { backgroundColor: "#EF233C" },
  liveBadgeText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  viewerText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "800",
  },
  inputLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  titleCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 13,
    backgroundColor: "rgba(8,12,24,0.54)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  titleCardAlert: {
    borderColor: "rgba(255,45,85,0.9)",
    backgroundColor: "rgba(255,45,85,0.14)",
  },
  titleInput: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    paddingTop: 8,
    paddingBottom: 2,
    outlineStyle: "none" as any,
  },
  titleHelp: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 7,
    lineHeight: 18,
  },
  titleAlert: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "rgba(255,45,85,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,45,85,0.65)",
  },
  titleAlertText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  titleAlertSubtext: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  notice: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "700" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  primaryLiveButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF2D55",
    paddingHorizontal: 18,
  },
  primaryLiveText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  primaryLiveButtonDisabled: { backgroundColor: "#64748B" },
  roundAction: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  roundActionText: { color: "#FFFFFF", fontWeight: "900" },
  endButton: {
    width: 64,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  endButtonText: { color: "#111827", fontWeight: "900" },
  viewerFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  viewerGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 30,
    backgroundColor: "#111827",
  },
  viewerSideActions: { position: "absolute", right: 18, bottom: 236, gap: 10 },
  viewerSideActionsCompact: { right: 10, bottom: 172, gap: 6 },
  sideCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,12,24,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  shareCircle: { backgroundColor: "rgba(9,103,255,0.72)" },
  sideLabelPill: {
    minWidth: 30,
    alignSelf: "center",
    marginTop: -8,
    marginBottom: -2,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: "rgba(8,12,24,0.72)",
  },
  sideLabelText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "900",
  },
  viewerBottomPanel: {
    position: "absolute",
    left: 18,
    right: 84,
    bottom: 18,
    gap: 10,
  },
  viewerBottomPanelCompact: { left: 12, right: 70, bottom: 10, gap: 6 },
  viewerTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
  viewerTitleCompact: { fontSize: 20, lineHeight: 24 },
  viewerDescription: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
  },
  viewerDescriptionCompact: { fontSize: 14, lineHeight: 19 },
  joinFeed: { gap: 5, marginTop: 2 },
  joinLine: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    fontWeight: "800",
  },
  messageComposer: {
    marginTop: 4,
    minHeight: 48,
    borderRadius: 24,
    paddingLeft: 18,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  messagePlaceholder: {
    flex: 1,
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
    fontWeight: "700",
  },
  messageInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 10,
    outlineStyle: "none" as any,
  },
  messageIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  messageIconText: { fontSize: 20 },
    commentsOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(2,6,23,0.62)",
    },
    commentsBackdrop: { flex: 1 },
    commentsKeyboard: { width: "100%", maxHeight: "80%" },
    commentsSheet: {
      width: "100%",
      maxWidth: 600,
      maxHeight: "100%",
      alignSelf: "center",
      padding: 18,
      gap: 12,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: "#101827",
    },
    commentsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    commentsTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", flex: 1 },
    commentsClose: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
    commentsScroll: { maxHeight: 360 },
    commentsContent: { gap: 10, paddingVertical: 6 },
    commentsRetry: { minHeight: 44, justifyContent: "center" },
  activityOverlayPanel: {
    position: "absolute",
    left: 18,
    right: 84,
    bottom: 180,
    borderRadius: 22,
    padding: 14,
    gap: 7,
    backgroundColor: "rgba(0,0,0,0.48)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  activityHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  activityTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  activityMiniStats: { flexDirection: "row", alignItems: "center", gap: 8 },
  activityMiniText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  activityLine: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    fontWeight: "800",
  },
});

const preparationStyles = StyleSheet.create({
  content: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 16 },
  identity: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { flex: 1, fontFamily: "Inter-SemiBold", fontSize: 14, lineHeight: 20 },
  preview: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#101C2C",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#101C2C",
  },
  previewLabel: {
    color: "#AAB8CC",
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 20,
  },
  field: { gap: 8 },
  label: { fontFamily: "Inter-SemiBold", fontSize: 13, lineHeight: 20 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter-Regular",
    fontSize: 15,
  },
  cameraActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
