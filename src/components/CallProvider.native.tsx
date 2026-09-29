import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { AppState, Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  MediaStream as NativeStream,
  RTCPeerConnection as NativePeer,
  RTCView,
  mediaDevices,
} from "react-native-webrtc";
import { CallController, type CallMode, type CallPeer } from "../lib/calls";
import { callBackend, watchCalls } from "../lib/callBackend";
import { useAuth } from "../lib/auth";
import { Avatar, Button, useUIStyles } from "./ui";
const Context = createContext<CallController | null>(null);
const noCallSubscription = () => () => {};
const idleCallPhase = () => "idle" as const;
export function CallProvider({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const { session } = useAuth();
  const uid = enabled ? session?.user.id : undefined;
  const controller = useMemo(
    () =>
      uid
        ? new CallController(uid, {
            backend: callBackend,
            getUserMedia: async (constraints) =>
              (await mediaDevices.getUserMedia({
                audio: true,
                video: constraints.video
                  ? { facingMode: "user", width: 1280, height: 720 }
                  : false,
              })) as unknown as MediaStream,
            createPeerConnection: (config) =>
              new NativePeer({
                iceServers: config.iceServers,
                iceTransportPolicy: "relay",
              }) as unknown as RTCPeerConnection,
            createStream: () => new NativeStream() as unknown as MediaStream,
          })
        : null,
    [uid],
  );
  useEffect(() => {
    if (!controller || !uid) return;
    const stop = watchCalls(uid, controller.getActiveId, controller.receive);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" && controller.getActiveId()) controller.end();
    });
    return () => {
      stop();
      sub.remove();
      controller.dispose();
    };
  }, [controller, uid]);
  return (
    <Context.Provider value={controller}>
      {children}
      {!!controller && <CallDialog controller={controller} />}
    </Context.Provider>
  );
}
export function useCalls() {
  const c = useContext(Context);
  const phase = useSyncExternalStore(
    c?.subscribe || noCallSubscription,
    c ? () => c.getSnapshot().phase : idleCallPhase,
    idleCallPhase,
  );
  return {
    available: !!c,
    busy: phase !== "idle",
    startCall: async (peer: CallPeer, mode: CallMode) => {
      await c?.start(peer, mode);
    },
  };
}
function CallDialog({ controller }: { controller: CallController }) {
  const s = useUIStyles();

  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  );
  const local = state.localStream as unknown as NativeStream | null;
  const remote = state.remoteStream as unknown as NativeStream | null;
  const labels = {
    idle: "",
    preparing: "Préparation de l’appel…",
    outgoing: "En attente de réponse…",
    incoming:
      state.mode === "video" ? "Appel vidéo entrant" : "Appel vocal entrant",
    connecting: "Connexion en cours…",
    connected: "Appel en cours",
    ended: state.message,
  };
  return (
    <Modal
      visible={state.phase !== "idle"}
      animationType="slide"
      onRequestClose={() =>
        state.phase === "ended" ? controller.dismiss() : controller.end()
      }
    >
      {state.phase !== "idle" && <StatusBar style="light" />}
      <SafeAreaView style={[s.screen, { backgroundColor: "#0F172A" }]}>
        <ScrollView contentContainerStyle={[s.content, { paddingTop: 40 }]}>
          <View style={{ alignItems: "center", gap: 16 }}>
            <Avatar
              uri={state.peer?.avatarUrl}
              name={state.peer?.name}
              size={90}
            />
            <Text style={[s.title, { color: "white", textAlign: "center" }]}>
              {state.peer?.name}
            </Text>
            <Text accessibilityLiveRegion="polite" style={{ color: "#BFDBFE" }}>
              {labels[state.phase]}
            </Text>
          </View>
          {state.phase === "incoming" && (
            <Text style={{ color: "white", textAlign: "center" }}>
              Votre micro et votre caméra restent éteints tant que vous
              n’acceptez pas.
            </Text>
          )}
          {!!(state.mode === "video" && remote) && (
            <RTCView
              streamURL={remote.toURL()}
              objectFit="contain"
              style={{ height: 340, borderRadius: 20 }}
            />
          )}
          {!!(state.mode === "video" && local) && (
            <RTCView
              streamURL={local.toURL()}
              mirror
              objectFit="contain"
              style={{ height: 150, width: 120, alignSelf: "flex-end" }}
            />
          )}
          {state.phase === "incoming" ? (
            <>
              <Button
                title="Accepter"
                onPress={() => void controller.accept()}
              />
              <Button title="Refuser" secondary onPress={controller.end} />
            </>
          ) : state.phase === "ended" ? (
            <Button title="Fermer" onPress={controller.dismiss} />
          ) : (
            <>
              {!!local && (
                <Button
                  title={
                    state.microphoneEnabled
                      ? "Couper le micro"
                      : "Activer le micro"
                  }
                  secondary
                  onPress={controller.toggleMicrophone}
                />
              )}
              {!!(local && state.mode === "video") && (
                <Button
                  title={
                    state.cameraEnabled
                      ? "Couper la caméra"
                      : "Activer la caméra"
                  }
                  secondary
                  onPress={controller.toggleCamera}
                />
              )}
              <Button title="Raccrocher" onPress={controller.end} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
