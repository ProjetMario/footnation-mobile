import type { CallBackend, CallDependencies } from "./calls";

/** Creating the provider never requests a permission. Capture begins on start/accept. */
export function browserCallDependencies(
  backend: CallBackend,
): CallDependencies {
  return {
    backend,
    getUserMedia: (constraints) => {
      if (
        !globalThis.isSecureContext ||
        !globalThis.navigator?.mediaDevices?.getUserMedia ||
        typeof globalThis.RTCPeerConnection !== "function"
      ) {
        return Promise.reject(
          new Error(
            "Les appels nécessitent un navigateur compatible et une connexion HTTPS.",
          ),
        );
      }
      return navigator.mediaDevices.getUserMedia(constraints);
    },
    createPeerConnection: (configuration) =>
      new RTCPeerConnection({ ...configuration, iceTransportPolicy: "relay" }),
    createStream: () => new MediaStream(),
  };
}

/** The controller owns the tracks; replacing a view must only detach playback. */
export function attachCallMedia(
  element: HTMLVideoElement,
  stream: MediaStream,
  muted: boolean,
  playbackBlocked: (blocked: boolean) => void,
) {
  let attached = true;
  element.muted = muted;
  element.srcObject = stream;
  void element.play().then(
    () => {
      if (attached) playbackBlocked(false);
    },
    () => {
      if (attached && !muted) playbackBlocked(true);
    },
  );
  return () => {
    attached = false;
    element.pause();
    element.srcObject = null;
  };
}
