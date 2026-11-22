import { AppState } from "react-native";
import {
  MediaStream as NativeStream,
  RTCPeerConnection as NativePeer,
} from "react-native-webrtc";
import { createLiveRtcBackend } from "./liveRtcBackend";
import type { LiveRtcDependencies } from "./liveRtc";

export async function createLiveRtcDependencies(
  userId: string,
): Promise<LiveRtcDependencies> {
  return {
    backend: await createLiveRtcBackend(userId),
    createPeerConnection: (configuration) =>
      new NativePeer({
        iceServers: configuration.iceServers,
        iceTransportPolicy: "relay",
      }) as unknown as RTCPeerConnection,
    createStream: () => new NativeStream() as unknown as MediaStream,
    watchBackground: (listener) => {
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "background") listener();
      });
      return () => subscription.remove();
    },
  };
}
