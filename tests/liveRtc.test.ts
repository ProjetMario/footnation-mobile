import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LiveRtcPublisher,
  LiveRtcViewer,
  gatherLiveDescription,
  stopLiveCapture,
  type LiveRtcBackend,
  type LiveRtcDependencies,
  type LiveRtcPeer,
  type LiveRtcStream,
} from "../src/lib/liveRtc";

const streamId = "11111111-1111-4111-8111-111111111111";
const peerId = "22222222-2222-4222-8222-222222222222";
const input = { id: streamId, title: "Entraînement" };
const relayCandidate =
  "a=candidate:1 1 udp 1 203.0.113.1 9999 typ relay raddr 0.0.0.0 rport 0\r\n";
const offerSdp = `viewer-offer\r\n${relayCandidate}`;
const answerSdp = `publisher-answer\r\n${relayCandidate}`;
const expiry = () => new Date(Date.now() + 90_000).toISOString();
const streamRecord = (): LiveRtcStream => ({
  id: streamId,
  transport: "webrtc",
  broadcaster_id: "owner",
  status: "live",
  started_at: new Date().toISOString(),
  ended_at: null,
  expires_at: expiry(),
});
const peerRecord = (id = peerId): LiveRtcPeer => ({
  id,
  stream_id: streamId,
  viewer_id: "viewer",
  status: "waiting",
  offer: { type: "offer", sdp: "test-offer" },
  answer: null,
  expires_at: expiry(),
});
function track(kind = "video") {
  const value = {
    id: `${kind}-${Math.random()}`,
    kind,
    readyState: "live",
    onended: null,
    stop: vi.fn(() => {
      value.readyState = "ended";
    }),
  };
  return value as unknown as MediaStreamTrack;
}
function media(tracks: MediaStreamTrack[] = []) {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((value) => value.kind === "video"),
    getAudioTracks: () => tracks.filter((value) => value.kind === "audio"),
    addTrack: (value: MediaStreamTrack) => tracks.push(value),
  } as unknown as MediaStream;
}
class Peer extends EventTarget {
  connectionState = "new";
  iceGatheringState = "complete";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  ontrack: ((event: any) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  senders: any[] = [];
  close = vi.fn(() => {
    this.connectionState = "closed";
  });
  addTrack = vi.fn((value: MediaStreamTrack) => {
    const sender = {
      track: value,
      replaceTrack: vi.fn(async (next) => {
        sender.track = next;
      }),
    };
    this.senders.push(sender);
    return sender;
  });
  getSenders = () => this.senders;
  addTransceiver = vi.fn();
  createOffer = vi.fn(async () => ({
    type: "offer" as const,
    sdp: offerSdp,
  }));
  createAnswer = vi.fn(async () => ({
    type: "answer" as const,
    sdp: answerSdp,
  }));
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
  connect() {
    this.connectionState = "connected";
    this.onconnectionstatechange?.();
  }
}
function fixture() {
  let stream = streamRecord();
  const rows = new Map<string, LiveRtcPeer>();
  const peers: Peer[] = [];
  const refresh: (() => void)[] = [];
  let background = () => {};
  const backend: LiveRtcBackend = {
    start: vi.fn(async () => stream),
    stream: vi.fn(async () => stream),
    manage: vi.fn(async (_id, action) => {
      stream =
        action === "end"
          ? { ...stream, status: "ended", ended_at: new Date().toISOString() }
          : { ...stream, expires_at: expiry() };
      return stream;
    }),
    ice: vi.fn(async () => [
      {
        urls: "turns:relay.example.test:5349",
        username: "short-lived",
        credential: "synthetic",
      },
    ]),
    peers: vi.fn(async () => [...rows.values()]),
    peer: vi.fn(async (id) => rows.get(id) || null),
    join: vi.fn(async (_streamId, id, offer) => {
      const row = { ...peerRecord(id), offer };
      rows.set(id, row);
      return row;
    }),
    respond: vi.fn(async (id, action, answer) => {
      const existing = rows.get(id) || peerRecord(id);
      const row = {
        ...existing,
        status:
          action === "leave"
            ? ("ended" as const)
            : action === "answer"
              ? ("connected" as const)
              : existing.status,
        answer: answer || existing.answer,
        expires_at: expiry(),
      };
      rows.set(id, row);
      return row;
    }),
    watch: vi.fn((_streamId, fn) => {
      refresh.push(fn);
      return vi.fn();
    }),
  };
  const dependencies: LiveRtcDependencies = {
    backend,
    createPeerConnection: vi.fn(() => {
      const pc = new Peer();
      peers.push(pc);
      return pc as unknown as RTCPeerConnection;
    }),
    createStream: () => media(),
    watchBackground: (fn) => {
      background = fn;
      return vi.fn();
    },
  };
  return {
    backend,
    dependencies,
    peers,
    rows,
    refresh: () => refresh.forEach((fn) => fn()),
    background: () => background(),
  };
}
const flush = () => vi.advanceTimersByTimeAsync(0);
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T21:00:00Z"));
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("live publisher", () => {
  it("uses one stable creation and sends existing camera tracks to gathered receiver offers over relay-only ICE", async () => {
    const f = fixture(),
      publisher = new LiveRtcPublisher(f.dependencies),
      capture = media([track(), track("audio")]);
    const a = publisher.start(input, capture),
      b = publisher.start(input, capture);
    expect(a).toBe(b);
    await a;
    expect(f.backend.start).toHaveBeenCalledOnce();
    f.rows.set(peerId, peerRecord());
    f.refresh();
    await flush();
    expect(f.dependencies.createPeerConnection).toHaveBeenCalledWith(
      expect.objectContaining({ iceTransportPolicy: "relay" }),
    );
    expect(f.peers[0].close).toHaveBeenCalledOnce(); // Relay probe.
    expect(f.peers[1].addTrack).toHaveBeenCalledTimes(2);
    expect(f.backend.respond).toHaveBeenCalledWith(peerId, "answer", {
      type: "answer",
      sdp: answerSdp,
    });
    f.peers[1].connect();
    expect(publisher.getSnapshot().connectedViewers).toBe(1);
    await publisher.end();
    expect(
      capture.getTracks().every((value) => value.readyState === "ended"),
    ).toBe(true);
    expect(f.peers[1].close).toHaveBeenCalledOnce();
  });
  it("does not mark a server-ended start as live", async () => {
    const f = fixture(),
      capture = media([track()]),
      publisher = new LiveRtcPublisher(f.dependencies);
    vi.mocked(f.backend.start).mockResolvedValue({
      ...streamRecord(),
      status: "ended",
    });
    await expect(publisher.start(input, capture)).rejects.toThrow("terminé");
    expect(capture.getTracks()[0].stop).toHaveBeenCalled();
    expect(f.backend.ice).not.toHaveBeenCalled();
    expect(publisher.getSnapshot().phase).toBe("error");
  });
  it("fails closed without a TURN relay and ends a created record", async () => {
    const f = fixture(),
      capture = media([track()]),
      publisher = new LiveRtcPublisher(f.dependencies);
    vi.mocked(f.backend.ice).mockResolvedValue([{ urls: "stun:example.test" }]);
    await expect(publisher.start(input, capture)).rejects.toThrow("relais");
    expect(f.backend.manage).toHaveBeenCalledWith(streamId, "end");
    expect(capture.getTracks()[0].stop).toHaveBeenCalled();
    expect(f.dependencies.createPeerConnection).not.toHaveBeenCalled();
  });
  it("never announces LIVE when configured TURN returns no relay candidate", async () => {
    const f = fixture(),
      capture = media([track()]),
      publisher = new LiveRtcPublisher(f.dependencies);
    const probe = new Peer();
    probe.createOffer.mockResolvedValue({
      type: "offer",
      sdp: "v=0\r\na=candidate:1 1 udp 1 192.0.2.1 9999 typ host\r\n",
    });
    vi.mocked(f.dependencies.createPeerConnection).mockReturnValue(
      probe as unknown as RTCPeerConnection,
    );
    const phases: string[] = [];
    publisher.subscribe(() => phases.push(publisher.getSnapshot().phase));
    await expect(publisher.start(input, capture)).rejects.toThrow(
      "relais vidéo",
    );
    expect(phases).not.toContain("live");
    expect(f.backend.manage).toHaveBeenCalledWith(streamId, "end");
    expect(probe.close).toHaveBeenCalledOnce();
    expect(capture.getTracks()[0].stop).toHaveBeenCalledOnce();
  });
  it("closes a pending relay probe immediately when leaving the studio", async () => {
    const f = fixture(),
      capture = media([track()]),
      publisher = new LiveRtcPublisher(f.dependencies);
    const probe = new Peer();
    let resolve!: (description: RTCSessionDescriptionInit) => void;
    probe.createOffer.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    vi.mocked(f.dependencies.createPeerConnection).mockReturnValue(
      probe as unknown as RTCPeerConnection,
    );
    const starting = publisher.start(input, capture),
      rejected = expect(starting).rejects.toMatchObject({ name: "AbortError" });
    await flush();
    publisher.dispose();
    expect(probe.close).toHaveBeenCalledOnce();
    expect(capture.getTracks()[0].stop).toHaveBeenCalledOnce();
    resolve({ type: "offer", sdp: offerSdp });
    await rejected;
    expect(probe.setLocalDescription).not.toHaveBeenCalled();
    expect(probe.close).toHaveBeenCalledOnce();
  });
  it("stops capture synchronously and closes a stream whose creation returns after disposal", async () => {
    const f = fixture(),
      capture = media([track()]),
      publisher = new LiveRtcPublisher(f.dependencies);
    let resolve!: (row: LiveRtcStream) => void;
    vi.mocked(f.backend.start).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const starting = publisher.start(input, capture);
    const rejected = expect(starting).rejects.toMatchObject({
      name: "AbortError",
    });
    publisher.dispose();
    expect(capture.getTracks()[0].stop).toHaveBeenCalled();
    resolve(streamRecord());
    await rejected;
    await flush();
    expect(f.backend.manage).toHaveBeenCalledWith(streamId, "end");
    expect(f.backend.ice).not.toHaveBeenCalled();
  });
  it("does not send an answer completing after the publisher stopped", async () => {
    const f = fixture(),
      publisher = new LiveRtcPublisher(f.dependencies);
    await publisher.start(input, media([track()]));
    let resolve!: (description: RTCSessionDescriptionInit) => void;
    const pc = new Peer();
    pc.createAnswer.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    vi.mocked(f.dependencies.createPeerConnection).mockReturnValue(
      pc as unknown as RTCPeerConnection,
    );
    f.rows.set(peerId, peerRecord());
    f.refresh();
    await flush();
    await publisher.end();
    resolve({ type: "answer", sdp: "late" });
    await flush();
    expect(f.backend.respond).not.toHaveBeenCalledWith(
      peerId,
      "answer",
      expect.anything(),
    );
    expect(pc.close).toHaveBeenCalled();
  });
  it("retains a failed end for explicit retry instead of reporting confirmed success", async () => {
    const f = fixture(),
      capture = media([track()]),
      publisher = new LiveRtcPublisher(f.dependencies);
    await publisher.start(input, capture);
    vi.mocked(f.backend.manage).mockRejectedValueOnce(new Error("offline"));
    await expect(publisher.end()).rejects.toThrow("offline");
    expect(capture.getTracks()[0].stop).toHaveBeenCalled();
    expect(publisher.getSnapshot().phase).toBe("error");
    await publisher.end();
    expect(publisher.getSnapshot().message).toBe("Le live est terminé.");
  });
  it("allows leaving preparation after rejected creation when the stream does not exist", async () => {
    const f = fixture(),
      publisher = new LiveRtcPublisher(f.dependencies);
    vi.mocked(f.backend.start).mockRejectedValue(new Error("profile missing"));
    vi.mocked(f.backend.manage).mockRejectedValue(new Error("stream missing"));
    vi.mocked(f.backend.stream).mockResolvedValue(null);
    await expect(publisher.start(input, media([track()]))).rejects.toThrow(
      "profile missing",
    );
    await expect(publisher.end()).resolves.toBeUndefined();
    expect(f.backend.stream).toHaveBeenCalledWith(streamId);
    expect(publisher.getSnapshot().phase).toBe("ended");
  });
  it("reconciles a lost end response with the server's persisted termination", async () => {
    const f = fixture(),
      publisher = new LiveRtcPublisher(f.dependencies);
    await publisher.start(input, media([track()]));
    await flush();
    const manage = vi.mocked(f.backend.manage).getMockImplementation()!;
    vi.mocked(f.backend.manage).mockImplementationOnce(async (id, action) => {
      await manage(id, action);
      throw new Error("response lost");
    });
    await expect(publisher.end()).resolves.toBeUndefined();
    expect(publisher.getSnapshot().message).toBe("Le live est terminé.");
  });
  it("keeps an end failure when the verification read fails", async () => {
    const f = fixture(),
      publisher = new LiveRtcPublisher(f.dependencies);
    await publisher.start(input, media([track()]));
    await flush();
    const original = new Error("end offline");
    vi.mocked(f.backend.manage).mockRejectedValueOnce(original);
    vi.mocked(f.backend.stream).mockRejectedValueOnce(
      new Error("read offline"),
    );
    await expect(publisher.end()).rejects.toBe(original);
    expect(publisher.getSnapshot().phase).toBe("error");
  });
  it("rejects a stop response that still says live", async () => {
    const f = fixture(),
      publisher = new LiveRtcPublisher(f.dependencies);
    await publisher.start(input, media([track()]));
    vi.mocked(f.backend.manage).mockResolvedValueOnce(streamRecord());
    await expect(publisher.end()).rejects.toThrow("confirmé");
    expect(publisher.getSnapshot().phase).toBe("error");
  });
  it("expires capture when failed heartbeats cannot renew the server lease", async () => {
    const f = fixture(),
      capture = media([track()]),
      publisher = new LiveRtcPublisher(f.dependencies);
    await publisher.start(input, capture);
    vi.mocked(f.backend.manage).mockRejectedValue(new Error("offline"));
    await vi.advanceTimersByTimeAsync(90_001);
    expect(capture.getTracks()[0].stop).toHaveBeenCalled();
    expect(publisher.getSnapshot().phase).toBe("error");
  });
  it("replaces sender tracks when changing cameras and closes capture in background", async () => {
    const f = fixture(),
      previous = media([track(), track("audio")]),
      next = media([track(), track("audio")]),
      publisher = new LiveRtcPublisher(f.dependencies);
    await publisher.start(input, previous);
    f.rows.set(peerId, peerRecord());
    f.refresh();
    await flush();
    await publisher.replaceStream(next);
    expect(f.peers[1].getSenders()[0].replaceTrack).toHaveBeenCalledWith(
      next.getVideoTracks()[0],
    );
    expect(
      previous.getTracks().every((value) => value.readyState === "ended"),
    ).toBe(true);
    f.background();
    await flush();
    expect(
      next.getTracks().every((value) => value.readyState === "ended"),
    ).toBe(true);
    expect(f.backend.manage).toHaveBeenCalledWith(streamId, "end");
  });
  it("bounds publisher fanout to eight connections", async () => {
    const f = fixture(),
      publisher = new LiveRtcPublisher(f.dependencies);
    await publisher.start(input, media([track()]));
    for (let index = 0; index < 10; index++)
      f.rows.set(String(index), peerRecord(String(index)));
    f.refresh();
    await flush();
    expect(f.peers).toHaveLength(9); // One closed relay probe plus eight viewers.
    publisher.dispose();
  });
});

describe("live viewer", () => {
  it("offers receive-only media without capture, applies an answer once and closes on stream end", async () => {
    const f = fixture(),
      viewer = new LiveRtcViewer(f.dependencies);
    await viewer.start(streamId, peerId);
    const pc = f.peers[0];
    expect(pc.addTransceiver.mock.calls).toEqual([
      ["audio", { direction: "recvonly" }],
      ["video", { direction: "recvonly" }],
    ]);
    expect(pc.addTrack).not.toHaveBeenCalled();
    expect(f.backend.join).toHaveBeenCalledWith(streamId, peerId, {
      type: "offer",
      sdp: offerSdp,
    });
    f.rows.set(peerId, {
      ...peerRecord(),
      status: "connected",
      answer: { type: "answer", sdp: "publisher-answer" },
    });
    f.refresh();
    await flush();
    f.refresh();
    await flush();
    expect(pc.setRemoteDescription).toHaveBeenCalledOnce();
    const remoteTrack = track();
    pc.ontrack!({ track: remoteTrack });
    pc.connect();
    expect(viewer.getSnapshot().phase).toBe("connected");
    expect(viewer.getSnapshot().remoteStream?.getTracks()).toEqual([
      remoteTrack,
    ]);
    await f.backend.manage(streamId, "end");
    f.refresh();
    await flush();
    expect(viewer.getSnapshot().phase).toBe("ended");
    expect(remoteTrack.stop).toHaveBeenCalled();
    expect(pc.close).toHaveBeenCalled();
  });
  it("ignores an answer arriving after the viewer leaves", async () => {
    const f = fixture(),
      viewer = new LiveRtcViewer(f.dependencies);
    await viewer.start(streamId, peerId);
    await flush();
    let resolve!: (peer: LiveRtcPeer) => void;
    vi.mocked(f.backend.peer).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    f.refresh();
    await flush();
    viewer.dispose();
    resolve({
      ...peerRecord(),
      status: "connected",
      answer: { type: "answer", sdp: "late" },
    });
    await flush();
    expect(f.peers[0].setRemoteDescription).not.toHaveBeenCalled();
    expect(f.backend.respond).toHaveBeenCalledWith(peerId, "leave");
  });
  it("leaves a peer created after disposal while join was in flight", async () => {
    const f = fixture(),
      viewer = new LiveRtcViewer(f.dependencies);
    let resolve!: (peer: LiveRtcPeer) => void;
    vi.mocked(f.backend.join).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const starting = viewer.start(streamId, peerId);
    const rejected = expect(starting).rejects.toMatchObject({
      name: "AbortError",
    });
    await flush();
    viewer.dispose();
    resolve(peerRecord());
    await rejected;
    expect(f.backend.respond).toHaveBeenCalledWith(peerId, "leave");
    expect(f.peers[0].close).toHaveBeenCalled();
  });
  it("closes playback in background and never applies scrubbed terminal SDP", async () => {
    const f = fixture(),
      viewer = new LiveRtcViewer(f.dependencies);
    await viewer.start(streamId, peerId);
    f.rows.set(peerId, {
      ...peerRecord(),
      status: "ended",
      offer: null,
      answer: null,
    });
    f.refresh();
    await flush();
    expect(viewer.getSnapshot().phase).toBe("ended");
    expect(f.peers[0].setRemoteDescription).not.toHaveBeenCalled();
    f.background();
    expect(f.peers[0].close).toHaveBeenCalledOnce();
  });
});

it("uses gathered relay SDP at the deadline when fallback ICE gathering remains incomplete", async () => {
  const pc = new Peer();
  pc.iceGatheringState = "gathering";
  pc.localDescription = { type: "offer", sdp: "initial-offer" };
  const result = gatherLiveDescription(
    pc as unknown as RTCPeerConnection,
    new AbortController().signal,
  );
  const settled = vi.fn();
  void result.then(settled);
  await vi.advanceTimersByTimeAsync(400);
  pc.localDescription = { type: "offer", sdp: offerSdp };
  await vi.advanceTimersByTimeAsync(14_599);
  expect(settled).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await expect(result).resolves.toEqual({ type: "offer", sdp: offerSdp });
  expect(pc.iceGatheringState).toBe("gathering");
  expect(vi.getTimerCount()).toBe(0);
});

it("rejects incomplete ICE gathering at the deadline when only a host candidate exists", async () => {
  const pc = new Peer();
  pc.iceGatheringState = "gathering";
  pc.localDescription = {
    type: "offer",
    sdp: "a=candidate:1 1 udp 1 192.0.2.1 9999 typ host\r\n",
  };
  const result = gatherLiveDescription(
    pc as unknown as RTCPeerConnection,
    new AbortController().signal,
  );
  const rejected = expect(result).rejects.toThrow("Vérifiez votre réseau");
  await vi.advanceTimersByTimeAsync(15_000);
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels incomplete ICE gathering even when a relay is already available", async () => {
  const pc = new Peer();
  pc.iceGatheringState = "gathering";
  pc.localDescription = { type: "offer", sdp: offerSdp };
  const abort = new AbortController(),
    result = gatherLiveDescription(
      pc as unknown as RTCPeerConnection,
      abort.signal,
    );
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  abort.abort();
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
});

it("releases native capture once when both the controller and preview clean up", () => {
  const camera = track(),
    microphone = track("audio");
  camera.onended = vi.fn();
  microphone.onended = vi.fn();
  const capture = Object.assign(media([camera, microphone]), {
    release: vi.fn(),
  });
  stopLiveCapture(capture);
  stopLiveCapture(capture);
  expect(camera.onended).toBeNull();
  expect(microphone.onended).toBeNull();
  expect(camera.stop).toHaveBeenCalledOnce();
  expect(microphone.stop).toHaveBeenCalledOnce();
  expect(capture.release).toHaveBeenCalledOnce();
});
