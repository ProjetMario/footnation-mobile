import { createLiveRtcBackend } from "./liveRtcBackend";
import type { LiveRtcDependencies } from "./liveRtc";

export async function createLiveRtcDependencies(
  userId: string,
): Promise<LiveRtcDependencies> {
  return {
    backend: await createLiveRtcBackend(userId),
    createPeerConnection: (configuration) =>
      new RTCPeerConnection(configuration),
    createStream: () => new MediaStream(),
    watchBackground: (listener) => {
      const changed = () => {
        if (document.visibilityState === "hidden") listener();
      };
      document.addEventListener("visibilitychange", changed);
      window.addEventListener("pagehide", listener);
      return () => {
        document.removeEventListener("visibilitychange", changed);
        window.removeEventListener("pagehide", listener);
      };
    },
  };
}
