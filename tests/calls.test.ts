import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CallController,
  gatherDescription,
  type CallBackend,
  type CallMode,
  type CallRecord,
} from "../src/lib/calls";

const selfId = "self";
const peer = { id: "peer", name: "Alex" };
const offer: RTCSessionDescriptionInit = {
  type: "offer",
  sdp: "offer-with-relay-candidate",
};
const answer: RTCSessionDescriptionInit = {
  type: "answer",
  sdp: "answer-with-relay-candidate",
};
const iceServers: RTCIceServer[] = [
  {
    urls: ["turn:relay.example.test:3478"],
    username: "user",
    credential: "secret",
  },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeTrack(kind: "audio" | "video", id = kind as string) {
  return {
    id,
    kind,
    enabled: true,
    onended: null,
    stop: vi.fn(),
  } as unknown as MediaStreamTrack & { stop: ReturnType<typeof vi.fn> };
}

function makeStream(initialTracks: MediaStreamTrack[] = []) {
  const tracks = [...initialTracks];
  return {
    getTracks: () => [...tracks],
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
    addTrack: vi.fn((track: MediaStreamTrack) => {
      tracks.push(track);
    }),
  } as unknown as MediaStream;
}

class FakePeerConnection extends EventTarget {
  iceGatheringState: RTCIceGatheringState = "complete";
  connectionState: RTCPeerConnectionState = "new";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  ontrack: ((event: RTCTrackEvent) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  addTrack = vi.fn();
  createOffer = vi.fn(async () => offer);
  createAnswer = vi.fn(async () => answer);
  setLocalDescription = vi.fn(
    async (description: RTCSessionDescriptionInit) => {
      this.localDescription = description;
    },
  );
  setRemoteDescription = vi.fn(
    async (description: RTCSessionDescriptionInit) => {
      this.remoteDescription = description;
    },
  );
  close = vi.fn(() => {
    this.connectionState = "closed";
  });

  asPeerConnection() {
    return this as unknown as RTCPeerConnection;
  }

  connect() {
    this.connectionState = "connected";
    this.onconnectionstatechange?.();
  }

  receiveTrack(track: MediaStreamTrack) {
    this.ontrack?.({ track } as RTCTrackEvent);
  }

  completeGathering() {
    this.iceGatheringState = "complete";
    this.dispatchEvent(new Event("icegatheringstatechange"));
  }
}

function makeRecord(patch: Partial<CallRecord> = {}): CallRecord {
  return {
    id: "incoming-call",
    caller_id: peer.id,
    callee_id: selfId,
    mode: "video",
    status: "ringing",
    offer,
    answer: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    ...patch,
  };
}

const controllers: CallController[] = [];

function harness(mode: CallMode = "audio") {
  const audio = makeTrack("audio");
  const video = makeTrack("video");
  const localStream = makeStream(mode === "video" ? [audio, video] : [audio]);
  const remoteStream = makeStream();
  const pc = new FakePeerConnection();
  const records = new Map<string, CallRecord>();
  const backend = {
    getIceServers: vi
      .fn<
        Parameters<CallBackend["getIceServers"]>,
        ReturnType<CallBackend["getIceServers"]>
      >()
      .mockResolvedValue(iceServers),
    getPeer: vi
      .fn<
        Parameters<CallBackend["getPeer"]>,
        ReturnType<CallBackend["getPeer"]>
      >()
      .mockResolvedValue(peer),
    create: vi.fn(
      async (
        ...[id, peerId, callMode, description]: Parameters<
          CallBackend["create"]
        >
      ) => {
        const record = makeRecord({
          id,
          caller_id: selfId,
          callee_id: peerId,
          mode: callMode,
          offer: description,
        });
        records.set(id, record);
        return record;
      },
    ),
    respond: vi.fn(
      async (
        ...[id, action, description]: Parameters<CallBackend["respond"]>
      ) => {
        const record = makeRecord({
          ...(records.get(id) ?? {}),
          id,
          status:
            action === "accept"
              ? "accepted"
              : action === "reject"
                ? "rejected"
                : action === "end"
                  ? "ended"
                  : "accepted",
          answer: description ?? records.get(id)?.answer ?? null,
          updated_at: new Date().toISOString(),
        });
        records.set(id, record);
        return record;
      },
    ),
  };
  const getUserMedia = vi
    .fn<[MediaStreamConstraints], Promise<MediaStream>>()
    .mockResolvedValue(localStream);
  const createPeerConnection = vi.fn(() => pc.asPeerConnection());
  const controller = new CallController(selfId, {
    backend,
    getUserMedia,
    createPeerConnection,
    createStream: () => remoteStream,
  });
  controllers.push(controller);
  return {
    controller,
    backend,
    getUserMedia,
    createPeerConnection,
    pc,
    localStream,
    remoteStream,
    audio,
    video,
    records,
  };
}

function expectReleased(h: ReturnType<typeof harness>) {
  for (const track of [
    ...h.localStream.getTracks(),
    ...h.remoteStream.getTracks(),
  ]) {
    expect(track.stop).toHaveBeenCalledTimes(1);
  }
  expect(h.pc.close).toHaveBeenCalledTimes(1);
  expect(h.pc.ontrack).toBeNull();
  expect(h.pc.onconnectionstatechange).toBeNull();
  expect(h.controller.getSnapshot()).toMatchObject({
    phase: "ended",
    localStream: null,
    remoteStream: null,
  });
  expect(h.controller.getActiveId()).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-06T12:00:00.000Z"));
});

afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.dispose());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CallController", () => {
  it("starts an audio call without requesting a camera and publishes the gathered offer", async () => {
    const h = harness();
    await h.controller.start(peer, "audio");

    expect(h.backend.getIceServers).toHaveBeenCalledWith(peer.id);
    expect(h.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    expect(h.createPeerConnection).toHaveBeenCalledWith({
      iceServers,
      iceTransportPolicy: "relay",
    });
    expect(h.pc.addTrack).toHaveBeenCalledWith(h.audio, h.localStream);
    expect(h.pc.setLocalDescription).toHaveBeenCalledWith(offer);
    expect(h.backend.create).toHaveBeenCalledWith(
      h.controller.getActiveId(),
      peer.id,
      "audio",
      offer,
    );
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: "outgoing",
      mode: "audio",
      cameraEnabled: false,
      localStream: h.localStream,
    });
  });

  it("applies the caller's remote answer once and enters connected with a heartbeat", async () => {
    const h = harness();
    await h.controller.start(peer, "audio");
    const id = h.controller.getActiveId()!;
    const accepted = {
      ...h.records.get(id)!,
      status: "accepted" as const,
      answer,
    };
    await Promise.all([
      h.controller.receive(accepted),
      h.controller.receive(accepted),
    ]);

    expect(h.pc.setRemoteDescription).toHaveBeenCalledWith(answer);
    expect(h.pc.setRemoteDescription).toHaveBeenCalledTimes(1);
    expect(h.controller.getSnapshot().phase).toBe("connecting");
    h.pc.connect();
    const connectedAt = Date.now();
    expect(h.controller.getSnapshot()).toMatchObject({
      phase: "connected",
      connectedAt,
    });
    await vi.advanceTimersByTimeAsync(25_000);
    expect(h.backend.respond).toHaveBeenCalledWith(id, "heartbeat");
    h.pc.connect();
    expect(h.controller.getSnapshot().connectedAt).toBe(connectedAt);
    expect(vi.getTimerCount()).toBe(2);
  });

  it("preserves a realtime answer and connection that arrive before create resolves", async () => {
    const h = harness();
    const creation = deferred<CallRecord>();
    h.backend.create.mockReturnValue(creation.promise);
    const operation = h.controller.start(peer, "audio");
    await vi.advanceTimersByTimeAsync(0);
    expect(h.backend.create).toHaveBeenCalledTimes(1);
    const ringing = makeRecord({
      id: h.controller.getActiveId()!,
      caller_id: selfId,
      callee_id: peer.id,
      mode: "audio",
    });
    await h.controller.receive({ ...ringing, status: "accepted", answer });
    h.pc.connect();
    creation.resolve(ringing);
    await operation;

    expect(h.pc.setRemoteDescription).toHaveBeenCalledWith(answer);
    expect(h.controller.getSnapshot().phase).toBe("connected");
    expect(vi.getTimerCount()).toBe(2);
  });

  it("shows an incoming video call without accessing the camera or microphone before acceptance", async () => {
    const h = harness("video");
    await h.controller.receive(makeRecord());

    expect(h.controller.getSnapshot()).toMatchObject({
      phase: "incoming",
      peer,
      mode: "video",
      localStream: null,
      remoteStream: null,
    });
    expect(h.getUserMedia).not.toHaveBeenCalled();
    expect(h.backend.getIceServers).not.toHaveBeenCalled();
    expect(h.createPeerConnection).not.toHaveBeenCalled();
  });

  it("accepts as callee, applies the offer, and sends the gathered video answer", async () => {
    const h = harness("video");
    const incoming = makeRecord();
    await h.controller.receive(incoming);
    await h.controller.accept();

    expect(h.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    expect(h.pc.setRemoteDescription).toHaveBeenCalledWith(offer);
    expect(h.pc.createOffer).not.toHaveBeenCalled();
    expect(h.pc.createAnswer).toHaveBeenCalledTimes(1);
    expect(h.pc.setRemoteDescription.mock.invocationCallOrder[0]).toBeLessThan(
      h.pc.createAnswer.mock.invocationCallOrder[0],
    );
    expect(h.pc.setLocalDescription).toHaveBeenCalledWith(answer);
    expect(h.backend.respond).toHaveBeenCalledWith(
      incoming.id,
      "accept",
      answer,
    );
    expect(h.backend.create).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot().phase).toBe("connecting");
    h.pc.connect();
    expect(h.controller.getSnapshot().phase).toBe("connected");
  });

  it("rejects an incoming call without acquiring media", async () => {
    const h = harness();
    await h.controller.receive(makeRecord());
    h.controller.end();

    expect(h.backend.respond).toHaveBeenCalledWith("incoming-call", "reject");
    expect(h.getUserMedia).not.toHaveBeenCalled();
    expect(h.createPeerConnection).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot().phase).toBe("ended");
    expect(h.controller.getActiveId()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ends a connected call and releases every local and remote track, peer, and timer", async () => {
    const h = harness("video");
    await h.controller.start(peer, "video");
    const id = h.controller.getActiveId();
    const remoteAudio = makeTrack("audio", "remote-audio");
    const remoteVideo = makeTrack("video", "remote-video");
    h.pc.receiveTrack(remoteAudio);
    h.pc.receiveTrack(remoteVideo);
    h.pc.receiveTrack(remoteVideo);
    expect(h.remoteStream.getTracks()).toEqual([remoteAudio, remoteVideo]);
    h.pc.connect();
    h.controller.end();

    expect(h.backend.respond).toHaveBeenCalledWith(id, "end");
    expectReleased(h);
    h.controller.end();
    expect(h.pc.close).toHaveBeenCalledTimes(1);
    expect(h.backend.respond).toHaveBeenCalledTimes(1);
  });

  it("toggles microphone and camera independently without reacquiring media", async () => {
    const h = harness("video");
    await h.controller.start(peer, "video");
    h.controller.toggleMicrophone();
    expect(h.audio.enabled).toBe(false);
    expect(h.video.enabled).toBe(true);
    expect(h.controller.getSnapshot().microphoneEnabled).toBe(false);
    h.controller.toggleCamera();
    expect(h.video.enabled).toBe(false);
    expect(h.controller.getSnapshot().cameraEnabled).toBe(false);
    h.controller.toggleMicrophone();
    h.controller.toggleCamera();
    expect(h.audio.enabled).toBe(true);
    expect(h.video.enabled).toBe(true);
    expect(h.controller.getSnapshot()).toMatchObject({
      microphoneEnabled: true,
      cameraEnabled: true,
    });
    expect(h.getUserMedia).toHaveBeenCalledTimes(1);
    expect(h.audio.stop).not.toHaveBeenCalled();
    expect(h.video.stop).not.toHaveBeenCalled();
  });

  it.each(["start", "accept"] as const)(
    "reports denied permissions during %s without creating a peer",
    async (action) => {
      const h = harness();
      h.getUserMedia.mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError"),
      );
      if (action === "accept") await h.controller.receive(makeRecord());
      await (action === "start"
        ? h.controller.start(peer, "audio")
        : h.controller.accept());

      expect(h.controller.getSnapshot()).toMatchObject({
        phase: "ended",
        localStream: null,
      });
      expect(h.controller.getSnapshot().message).toMatch(
        /Autorisez le microphone/,
      );
      expect(h.createPeerConnection).not.toHaveBeenCalled();
      expect(h.backend.create).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it.each<{ servers: RTCIceServer[] }>([
    { servers: [] },
    { servers: [{ urls: "stun:stun.example.test:3478" }] },
  ])(
    "fails before requesting media when TURN is unconfigured: $servers",
    async ({ servers }) => {
      const h = harness();
      h.backend.getIceServers.mockResolvedValue(servers);
      await h.controller.start(peer, "audio");

      expect(h.controller.getSnapshot()).toMatchObject({
        phase: "ended",
        message: "Le relais des appels n’est pas encore configuré.",
      });
      expect(h.getUserMedia).not.toHaveBeenCalled();
      expect(h.createPeerConnection).not.toHaveBeenCalled();
      expect(h.backend.create).not.toHaveBeenCalled();
    },
  );

  it.each(["start", "accept"] as const)(
    "stops late media after cancelling %s without creating a peer or call",
    async (action) => {
      const h = harness("video");
      const media = deferred<MediaStream>();
      h.getUserMedia.mockReturnValue(media.promise);
      if (action === "accept") await h.controller.receive(makeRecord());
      const operation =
        action === "start"
          ? h.controller.start(peer, "video")
          : h.controller.accept();
      await vi.advanceTimersByTimeAsync(0);
      expect(h.getUserMedia).toHaveBeenCalledTimes(1);
      h.controller.end();
      media.resolve(h.localStream);
      await operation;

      expect(h.audio.stop).toHaveBeenCalledTimes(1);
      expect(h.video.stop).toHaveBeenCalledTimes(1);
      expect(h.createPeerConnection).not.toHaveBeenCalled();
      expect(h.backend.create).not.toHaveBeenCalled();
      expect(
        h.backend.respond.mock.calls.some(([, action]) => action === "accept"),
      ).toBe(false);
      expect(h.controller.getSnapshot()).toMatchObject({
        phase: "ended",
        localStream: null,
      });
    },
  );

  it("ends a late-created call again when creation resolves after cancellation", async () => {
    const h = harness();
    const creation = deferred<CallRecord>();
    h.backend.create.mockReturnValue(creation.promise);
    const operation = h.controller.start(peer, "audio");
    await vi.advanceTimersByTimeAsync(0);
    expect(h.backend.create).toHaveBeenCalledTimes(1);
    const id = h.controller.getActiveId()!;
    h.controller.end();
    expect(h.backend.respond).toHaveBeenCalledWith(id, "end");
    h.backend.respond.mockClear();
    creation.resolve(
      makeRecord({ id, caller_id: selfId, callee_id: peer.id, mode: "audio" }),
    );
    await operation;

    expect(h.backend.respond).toHaveBeenCalledWith(id, "end");
    expectReleased(h);
  });

  it.each(["ended", "rejected"] as const)(
    "releases media for a remote %s update without echoing it",
    async (status) => {
      const h = harness("video");
      await h.controller.start(peer, "video");
      const id = h.controller.getActiveId()!;
      h.pc.receiveTrack(makeTrack("audio", "remote"));
      await h.controller.receive({ ...h.records.get(id)!, status });

      expectReleased(h);
      expect(h.backend.respond).not.toHaveBeenCalled();
      expect(h.controller.getSnapshot().message).toBe(
        status === "rejected" ? "Appel refusé." : "Appel terminé.",
      );
    },
  );

  it("expires an unanswered outgoing call and releases media", async () => {
    const h = harness();
    await h.controller.start(peer, "audio");
    const id = h.controller.getActiveId();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(h.controller.getSnapshot().phase).toBe("outgoing");
    await vi.advanceTimersByTimeAsync(1);

    expectReleased(h);
    expect(h.controller.getSnapshot().message).toMatch(/Aucune réponse/);
    expect(h.backend.respond).toHaveBeenCalledWith(id, "end");
  });

  it("marks an unanswered incoming call as missed without requesting media", async () => {
    const h = harness();
    await h.controller.receive(
      makeRecord({ expires_at: new Date(Date.now() + 1000).toISOString() }),
    );
    await vi.advanceTimersByTimeAsync(1000);

    expect(h.controller.getSnapshot()).toMatchObject({
      phase: "ended",
      message: "Appel manqué.",
    });
    expect(h.getUserMedia).not.toHaveBeenCalled();
    expect(h.backend.respond).toHaveBeenCalledWith("incoming-call", "reject");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not reopen a dismissed invitation when a stale poll arrives", async () => {
    const h = harness();
    const incoming = makeRecord();
    await h.controller.receive(incoming);
    h.controller.end();
    h.controller.dismiss();
    await h.controller.receive(incoming);
    expect(h.controller.getSnapshot().phase).toBe("idle");
    expect(h.getUserMedia).not.toHaveBeenCalled();
  });

  it("does not end a call accepted by another tab when accepting fails", async () => {
    const h = harness();
    const incoming = makeRecord();
    await h.controller.receive(incoming);
    h.backend.respond.mockRejectedValue(new Error("Call is not ringing"));
    await h.controller.accept();
    expect(h.controller.getSnapshot().phase).toBe("ended");
    expect(h.backend.respond).toHaveBeenCalledWith(incoming.id, "reject");
    expect(h.backend.respond).not.toHaveBeenCalledWith(incoming.id, "end");
  });

  it("ignores already expired incoming records", async () => {
    const h = harness();
    await h.controller.receive(
      makeRecord({ expires_at: new Date().toISOString() }),
    );
    expect(h.controller.getSnapshot().phase).toBe("idle");
    expect(h.backend.getPeer).not.toHaveBeenCalled();
    expect(h.getUserMedia).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ends local media when an active remote record expires", async () => {
    const h = harness();
    await h.controller.start(peer, "audio");
    const id = h.controller.getActiveId()!;
    await h.controller.receive({
      ...h.records.get(id)!,
      expires_at: new Date().toISOString(),
    });
    expectReleased(h);
    expect(h.controller.getSnapshot().message).toBe("L’appel a expiré.");
  });

  it("stops media at lease expiry even when heartbeat requests never resolve", async () => {
    const h = harness();
    await h.controller.start(peer, "audio");
    const id = h.controller.getActiveId()!;
    await h.controller.receive({
      ...h.records.get(id)!,
      status: "accepted",
      answer,
      expires_at: new Date(Date.now() + 90000).toISOString(),
    });
    h.pc.connect();
    h.backend.respond.mockReturnValue(new Promise(() => undefined));
    await vi.advanceTimersByTimeAsync(90000);
    expectReleased(h);
    expect(h.controller.getSnapshot().message).toMatch(/connexion au service/);
  });

  it("prevents simultaneous outgoing starts", async () => {
    const h = harness();
    const media = deferred<MediaStream>();
    h.getUserMedia.mockReturnValue(media.promise);
    const first = h.controller.start(peer, "audio");
    await h.controller.start({ id: "other", name: "Other" }, "video");
    await vi.advanceTimersByTimeAsync(0);
    expect(h.getUserMedia).toHaveBeenCalledTimes(1);
    expect(h.backend.getIceServers).toHaveBeenCalledWith(peer.id);
    media.resolve(h.localStream);
    await first;
    expect(h.backend.create).toHaveBeenCalledTimes(1);
    expect(h.controller.getSnapshot().peer).toEqual(peer);
  });

  it("prevents simultaneous accepts", async () => {
    const h = harness("video");
    const media = deferred<MediaStream>();
    h.getUserMedia.mockReturnValue(media.promise);
    await h.controller.receive(makeRecord());
    const first = h.controller.accept();
    await h.controller.accept();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.getUserMedia).toHaveBeenCalledTimes(1);
    media.resolve(h.localStream);
    await first;
    expect(h.pc.createAnswer).toHaveBeenCalledTimes(1);
    expect(h.backend.respond).toHaveBeenCalledWith(
      "incoming-call",
      "accept",
      answer,
    );
  });

  it("disposes an active call, stops its heartbeat and removes subscribers", async () => {
    const h = harness("video");
    const listener = vi.fn();
    h.controller.subscribe(listener);
    await h.controller.start(peer, "video");
    h.pc.receiveTrack(makeTrack("video", "remote"));
    h.pc.connect();
    const id = h.controller.getActiveId();
    h.controller.dispose();

    expectReleased(h);
    expect(h.backend.respond).toHaveBeenCalledWith(id, "end");
    listener.mockClear();
    h.controller.dismiss();
    expect(listener).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.backend.respond).toHaveBeenCalledTimes(1);
  });

  it("disposes while awaiting permissions and stops media when it eventually arrives", async () => {
    const h = harness("video");
    const media = deferred<MediaStream>();
    h.getUserMedia.mockReturnValue(media.promise);
    const operation = h.controller.start(peer, "video");
    await vi.advanceTimersByTimeAsync(0);
    h.controller.dispose();
    media.resolve(h.localStream);
    await operation;
    expect(h.audio.stop).toHaveBeenCalledTimes(1);
    expect(h.video.stop).toHaveBeenCalledTimes(1);
    expect(h.createPeerConnection).not.toHaveBeenCalled();
    expect(h.backend.create).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("gatherDescription", () => {
  it("returns an already gathered local description without installing a timer", async () => {
    const pc = new FakePeerConnection();
    pc.localDescription = offer;
    await expect(
      gatherDescription(pc.asPeerConnection(), new AbortController().signal),
    ).resolves.toEqual(offer);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for ICE completion and returns the final candidate-bearing SDP", async () => {
    const pc = new FakePeerConnection();
    pc.iceGatheringState = "gathering";
    pc.localDescription = { type: "offer", sdp: "offer-before-candidates" };
    const abort = new AbortController();
    const removePeerListener = vi.spyOn(pc, "removeEventListener");
    const removeAbortListener = vi.spyOn(abort.signal, "removeEventListener");
    const settled = vi.fn();
    const result = gatherDescription(pc.asPeerConnection(), abort.signal);
    void result.then(settled);
    pc.dispatchEvent(new Event("icegatheringstatechange"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(settled).not.toHaveBeenCalled();
    pc.localDescription = offer;
    pc.completeGathering();

    await expect(result).resolves.toEqual(offer);
    expect(removePeerListener).toHaveBeenCalledWith(
      "icegatheringstatechange",
      expect.any(Function),
    );
    expect(removeAbortListener).toHaveBeenCalledWith(
      "abort",
      expect.any(Function),
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects an already aborted operation without waiting for ICE", async () => {
    const pc = new FakePeerConnection();
    pc.iceGatheringState = "gathering";
    const abort = new AbortController();
    abort.abort();
    await expect(
      gatherDescription(pc.asPeerConnection(), abort.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts an ICE wait and removes its listeners and timer", async () => {
    const pc = new FakePeerConnection();
    pc.iceGatheringState = "gathering";
    const abort = new AbortController();
    const removePeerListener = vi.spyOn(pc, "removeEventListener");
    const removeAbortListener = vi.spyOn(abort.signal, "removeEventListener");
    const result = gatherDescription(pc.asPeerConnection(), abort.signal);
    const assertion = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    abort.abort();
    await assertion;
    expect(removePeerListener).toHaveBeenCalledWith(
      "icegatheringstatechange",
      expect.any(Function),
    );
    expect(removeAbortListener).toHaveBeenCalledWith(
      "abort",
      expect.any(Function),
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out incomplete ICE after 15 seconds instead of sending partial SDP", async () => {
    const pc = new FakePeerConnection();
    pc.iceGatheringState = "gathering";
    pc.localDescription = offer;
    const abort = new AbortController();
    const removePeerListener = vi.spyOn(pc, "removeEventListener");
    const removeAbortListener = vi.spyOn(abort.signal, "removeEventListener");
    const result = gatherDescription(pc.asPeerConnection(), abort.signal);
    const rejected = vi.fn();
    void result.catch(rejected);
    const assertion = expect(result).rejects.toThrow(
      "Le relais d’appel ne répond pas",
    );
    await vi.advanceTimersByTimeAsync(14_999);
    expect(rejected).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(removePeerListener).toHaveBeenCalledWith(
      "icegatheringstatechange",
      expect.any(Function),
    );
    expect(removeAbortListener).toHaveBeenCalledWith(
      "abort",
      expect.any(Function),
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([null, { type: "offer" as const, sdp: "" }])(
    "rejects a missing local SDP after gathering: %j",
    async (description) => {
      const pc = new FakePeerConnection();
      pc.localDescription = description;
      await expect(
        gatherDescription(pc.asPeerConnection(), new AbortController().signal),
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
